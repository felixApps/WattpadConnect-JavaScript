// use this to get json
// IMPORTANT NOTE: It's not possible to get a full list of an user's stories.
// You can only get THREE of them. 
// With metadataJSON['metadata']['data'][0]['stories']['total] you can get a number of the user's total stories count.
// User lists and conversations/comments are not aviable til yet.
async function extractInformationFromWattpad(url) {
  // wattpad.com/story/-URLs don't include the metadata.
  // Nobody knows why BUT we can still get the information by getting the json of
  // the first part.
  let isstory = false;
  if (url.includes('wattpad.com/story/')) {
    // leave a maricade that it's a story
    isstory = true;
    // save the original url (we'll need it later)
    var originalurl = url;
    // So now we're going to get the URL to the first part of the book:
    const firstparturl = await extractFirstPartLink(url);
    url = firstparturl;
  }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const pageSourceCode = await response.text();
        
        // searching the point 'window.prefetched' in source code, which contains the informations:
        var startIndex = pageSourceCode.indexOf('window.prefetched');
        if (startIndex === -1) {
            // couldn't find 'window.prefetched', so lets return null:
            return null;
        }
    
        // find the beginning of the JSON by searching for a {:
        var openBraceIndex = pageSourceCode.indexOf('{', startIndex);
    
        // find the end of the JSON by counting the number of { and }:
        var openBracesCount = 1;
        var endIndex = openBraceIndex + 1;
    
        while (openBracesCount > 0) {
            if (pageSourceCode[endIndex] === '{') {
                openBracesCount++;
            } else if (pageSourceCode[endIndex] === '}') {
                openBracesCount--;
            }
            endIndex++;
        }
    
        // extract the JSON:
        var jsonCode = pageSourceCode.slice(openBraceIndex, endIndex);
    
        try {
            // try to parse it:
            var parsedData = JSON.parse(jsonCode);
            var originalKey = Object.keys(parsedData)[0];
            var metadata = parsedData[originalKey];
            var metadataJSON = {
                metadata: metadata
            };
            if (url.includes('wattpad.com/user/')) {
                // by default, in the json you get by this function, there aren't the user's stories
                // (if you try to get information about a specific user, e.g. https://www.wattpad.com/user/wattpad)
                // with this, we can get it through the function getUserStories, which returns a JSON with the user's stories
                const storiesjson = await getUserStories(pageSourceCode, metadataJSON['metadata']['data'][0]['username']);
                // now let's combine both JSONs:
                metadataJSON.metadata.data[0].stories = storiesjson.data;

                // by default there aren't the users the user's following - we need to fetch a specific url
                // (https://www.wattpad.com/user/wattpad/following) and extract them.
                // let's use the function getUserFollowing:
                const followingjson = await getUserFollowing(metadataJSON['metadata']['data'][0]['username']);
                // let's add the following json to our main user's json:
                metadataJSON.metadata.data[0].following = followingjson.data.users;
                metadataJSON.metadata.data[0].followingtotal = followingjson.data.total;
            }
            if (isstory) {
              // beacuse we got all the story data by fetching the first part, we now have to correct a few things in the json:
              metadataJSON.metadata.data.title = metadataJSON.metadata.data.group.title;
              metadataJSON.metadata.data.id = metadataJSON.metadata.data.group.id;
              metadataJSON.metadata.data.url = originalurl;
              metadataJSON.metadata.data.bottomBannerTitle = metadataJSON.metadata.data.group.title;
              metadataJSON.metadata.data.createDate = metadataJSON.metadata.data.group.createDate;
              delete metadataJSON.metadata.data.lastPage;
              delete metadataJSON.metadata.data.length;
              delete metadataJSON.metadata.data.modifyDate;
              delete metadataJSON.metadata.data.page;
              delete metadataJSON.metadata.data.pageNumber;
              delete metadataJSON.metadata.data.pages;
              delete metadataJSON.metadata.data.readCount;
              delete metadataJSON.metadata.data.rating;
              delete metadataJSON.metadata.data.storyText;
              delete metadataJSON.metadata.data.text_url;
              delete metadataJSON.metadata.data.voteCount;
              delete metadataJSON.metadata.data.wordCount;
              delete metadataJSON.metadata.data.ampUrl;
              delete metadataJSON.metadata.data.branchLink;
              delete metadataJSON.metadata.data.commentCount;
              delete metadataJSON.metadata.data.descCharLimit;
              delete metadataJSON.metadata.data.firstPage;
              delete metadataJSON.metadata.data.nextPage;
            }
            return metadataJSON;
        } catch (error) {
            console.error('error while parsing JSON: ', error);
            return null;
        }
    } catch (error) {
        console.error('error fetching data: ', error);
        return null;
    }
}


async function getUserStories(pageSourceCode, alias) {
    // search for 'window.prefetched':
    var startIndex = pageSourceCode.indexOf('window.prefetched');
    if (startIndex === -1) {
      // 'window.prefetched' not found:
      return null;
    }
  
    // find the beginning of the second JSON by searching for 'user.alias.profile.works':
    var secondObjStartIndex = pageSourceCode.indexOf('user.' + alias + '.profile.works', startIndex);
  
    if (secondObjStartIndex === -1) {
      // couldn't find the second JSON:
      return null;
    }
  
    // find the beginning of the JSON by searching for a {:
    var openBraceIndex = pageSourceCode.indexOf('{', secondObjStartIndex);
  
    // find the end of the JSON by counting the number of { and }:
    var openBracesCount = 1;
    var endIndex = openBraceIndex + 1;
  
    while (openBracesCount > 0) {
      if (pageSourceCode[endIndex] === '{') {
        openBracesCount++;
      } else if (pageSourceCode[endIndex] === '}') {
        openBracesCount--;
      }
      endIndex++;
    }
  
    // extract the json:
    var jsonCode = pageSourceCode.slice(openBraceIndex, endIndex);
  
    try {
      // try to parse it:
      var parsedData = JSON.parse(jsonCode);
      return parsedData;
    } catch (error) {
      console.error('error while parsing user stories JSON: ', error);
      return null;
    }
  }

  async function getUserFollowing(alias) {
    try {
      // get following url:
      const url = 'https://www.wattpad.com/user/' + alias + '/following';
      var sourcecode = await fetch(url);
      // check if response is ok
      if (sourcecode.ok) {
        // convert to text and parse it
        sourcecode = await sourcecode.text();
        var parser = new DOMParser();
        var doc = await parser.parseFromString(sourcecode, 'text/html');
  
        var startIndex = sourcecode.indexOf('window.prefetched');
        if (startIndex === -1) {
          // 'window.prefetched' not found:
          return null;
        }
      
        // find the beginning of the following JSON by searching for 'user.alias.profile.following':
        var secondObjStartIndex = sourcecode.indexOf('user.' + alias + '.profile.following', startIndex);
      
        if (secondObjStartIndex === -1) {
          // couldn't find the second JSON:
          return null;
        }
      
        // find the beginning of the JSON by searching for a {:
        var openBraceIndex = sourcecode.indexOf('{', secondObjStartIndex);
      
        // // find the end of the JSON by counting the number of { and }:
        var openBracesCount = 1;
        var endIndex = openBraceIndex + 1;
      
        while (openBracesCount > 0) {
          if (sourcecode[endIndex] === '{') {
            openBracesCount++;
          } else if (sourcecode[endIndex] === '}') {
            openBracesCount--;
          }
          endIndex++;
        }
      
        // extract the json:
        var jsonCode = sourcecode.slice(openBraceIndex, endIndex);
      
        try {
          // try to parse it:
          var parsedData = JSON.parse(jsonCode);
          return parsedData;
        } catch (error) {
          console.error('error while parsing user stories JSON: ', error);
          return null;
        }
      } else {
        console.error('error:', response.status);
      }
    } catch(error) {
      console.error('error:', error);
      return 'error';
    }
  }

  // Code to extract the link to the first part of a book of the wattpad.com/story/xyz URL:
  async function extractFirstPartLink(url) {
    try {
      // fetch source code:
      var sourcecode = await fetch(url);
      // check if response is ok
      if (sourcecode.ok) {
        // convert to text and parse it
        sourcecode = await sourcecode.text();
        var parser = new DOMParser();
        var doc = await parser.parseFromString(sourcecode, 'text/html');
  
        // find "start reading" button in source code which contains the link:
        var readBtnElement = doc.querySelector('a.read-btn');
  
        // check if found and return link:
        if (readBtnElement) {
            var link = await readBtnElement.getAttribute('href');
            console.log(link);
            return 'https://www.wattpad.com' + link;
        } else {
          console.log('error :(');
          return 'error!';
        }
      } else {
        console.error('error:', response.status);
      }
    } catch(error) {
      console.error('error:', error);
      return 'error';
    }
  }