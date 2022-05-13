var AWS = require('aws-sdk');
const stemmer = require("stemmer");
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();

//modified the lookup function to query the user table
var myDB_lookup = function(username, callback) {
	
  var params = {
      KeyConditions: {
        username: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [ { S: username } ]
        }
      },
      TableName: "Users",
      AttributesToGet: [ 'password' ]
  };

  db.query(params, function(err, data) {
    if (err || data.Items.length == 0) {
      callback(err, null);
    } else {
      callback(err, data.Items[0].password.S);
    }	
  });
}

//this is the query to add a user to the users table
var add_User = function(username, password, fullname, email, affiliation,
birth_day, birth_month, birth_year, news, isOnline, callback) {	
					
	var likedArticles = [];
	likedArticles.push({ "N" : "-1" });			
					
	var params = {
      Item: {
        "username": { "S" : username },
        "password": { "S" : password },
		"fullname": { "S" : fullname },
		"email": { "S" : email },
		"affiliation": { "S" : affiliation },
		"birth_day": { "S" : birth_day },
		"birth_month": { "S" : birth_month },
		"birth_year": { "S" : birth_year },
		"news_interest": { "SS" : news },
		"likedArticles": { "L" : likedArticles },
		"isOnline": { "BOOL" : isOnline },
      },
      TableName: "Users",
	  ConditionExpression: "attribute_not_exists(username)",
  };

  db.putItem(params, function(err, data){
    if (err)
      callback(err)
    else
      callback(null, 'Success')
  });
}

//queries a user based on their username
var get_User = function(username, callback) {	
  var params = {
	TableName : "Users",
	KeyConditionExpression: "#un = :string1",
	ExpressionAttributeNames: {
        "#un": "username",
    },
	ExpressionAttributeValues: {
	  ":string1": { "S" : username },
	},
  };
	
	db.query(params, function(err, data) {
      if (err || data.Items.length == 0) {
        callback(err, null);
      } else {
        callback(err, data.Items[0]);
      }
    });
}

//gets a list of all friends of the user
var friendsOfUser = function(username, callback) {	
  var params = {
	TableName : "Friends",
	KeyConditionExpression: "#un = :string1",
	ExpressionAttributeNames: {
        "#un": "username",
    },
	ExpressionAttributeValues: {
	  ":string1": { "S" : username },
	},
  };
	
	db.query(params, function(err, data) {
      if (err) {
        callback(err, null);
      } else {
        callback(err, data.Items);
      }
    });
}

//takes in a list of usernames and returns the subset that is online
var is_Online = function(usernames) {	
    var arrayOfPromises = new Array();
	
	for (var i = 0; i < usernames.length; i++) {
		var username = usernames[i];
		
		var params = {
			TableName : "Users",
			KeyConditionExpression: "#un = :string1",
			ExpressionAttributeNames: {
		        "#bn": "isOnline",
				"#un": "username",
		    },
			ExpressionAttributeValues: {
			  ":bool1": { "BOOL" : true },
			  ":string1": { "S" : username },
			},
			FilterExpression: "#bn = :bool1"
		};

		//pushes to an array of promises for each query
		arrayOfPromises.push(db.query(params).promise())		
	}
	
	return Promise.all(arrayOfPromises).then(
		successfulDataArray => {	
			var onlineUsers = [];
			for (var i = 0; i < successfulDataArray.length; i++)
			{
				if (successfulDataArray[i].Items.length > 0) {
					onlineUsers.push(successfulDataArray[i].Items[0].username.S);
				}
			}
			return onlineUsers;
		},
		errorDataArray => {
			console.log(errorDataArray)
		}
	);
}

//gets all posts by a specific user
var getPosts = function(username, callback) {	
  var params = {
	TableName : "Posts",
	KeyConditionExpression: "#un = :string1",
	ExpressionAttributeNames: {
        "#un": "username",
    },
	ExpressionAttributeValues: {
	  ":string1": { "S" : username },
	}
  };
	
	db.query(params, function(err, data) {
      if (err) {
        callback(err, null);
      } else {
        callback(err, data.Items);
      }
    });
}

//gets an array of comments for a list of post_ids 
var get_Comments = function(post_ids) {	
    var arrayOfPromises = new Array();
	
	for (var i = 0; i < post_ids.length; i++) {
		var post_id = post_ids[i];
		
		var params = {
	 	    TableName : "Comments",
			KeyConditionExpression: "#un = :string1",
			ExpressionAttributeNames: {
		        "#un": "post_id",
		    },
			ExpressionAttributeValues: {
			  ":string1": { "S" : post_id },
			}
		};

		arrayOfPromises.push(db.query(params).promise())		
	}
	
	return Promise.all(arrayOfPromises).then(
		successfulDataArray => {	
			var comments = [];
			for (var i = 0; i < successfulDataArray.length; i++)
			{
				comments.push(successfulDataArray[i].Items);
			}
			return comments;
		},
		errorDataArray => {
			console.log(errorDataArray)
		}
	);
}

//updates the affiliation of a user
var changeAffiliation = function(username, affiliation, callback) {		
	var params = {
	  Key: {
		"username" : { "S" : username }
	  },
      UpdateExpression: "set affiliation = :un",
	  ExpressionAttributeValues: {
		":un": { "S" : affiliation },
      },
      TableName: "Users",
    };

    db.updateItem(params, function(err, data){
      if (err)
        callback(err)
      else
        callback(null, 'Success')
    });
}

//sets a user to be offline
var setOffline = function(username, callback) {		
	var params = {
	  Key: {
		"username" : { "S" : username }
	  },
      UpdateExpression: "set isOnline = :un",
	  ExpressionAttributeValues: {
		":un": { "BOOL" : false },
      },
      TableName: "Users",
    };

    db.updateItem(params, function(err, data){
      if (err)
        callback(err)
      else
        callback(null, 'Success')
    });
}

//sets a user to be online
var setOnline = function(username, callback) {		
	var params = {
	  Key: {
		"username" : { "S" : username }
	  },
      UpdateExpression: "set isOnline = :un",
	  ExpressionAttributeValues: {
		":un": { "BOOL" : true },
      },
      TableName: "Users",
    };

    db.updateItem(params, function(err, data){
      if (err)
        callback(err)
      else
        callback(null, 'Success')
    });
}

//changes a users password
var changePassword = function(username, password, callback) {		
	var params = {
	  Key: {
		"username" : { "S" : username }
	  },
      UpdateExpression: "set password = :un",
	  ExpressionAttributeValues: {
		":un": { "S" : password },
      },
      TableName: "Users",
    };

    db.updateItem(params, function(err, data){
      if (err)
        callback(err)
      else
        callback(null, 'Success')
    });
}

//changes the news for a user
var changeNews = function(username, news_interest, callback) {		
	var params = {
	  Key: {
		"username" : { "S" : username}
	  },
      UpdateExpression: "set news_interest = :un",
	  ExpressionAttributeValues: {
		":un": { "SS" : news_interest },
      },
      TableName: "Users",
    };

    db.updateItem(params, function(err, data){
      if (err)
        callback(err)
      else
        callback(null, 'Success')
    });
}

//changes the email for a user
var changeEmail = function(username, email, callback) {		
	var params = {
	  Key: {
		"username" : { "S" : username}
	  },
      UpdateExpression: "set email = :un",
	  ExpressionAttributeValues: {
		":un": { "S" : email },
      },
      TableName: "Users",
    };

    db.updateItem(params, function(err, data){
      if (err)
        callback(err)
      else
        callback(null, 'Success')
    });
}

//adds a post to a post table
var addPost = function(username, userpage, destpage, contents, time, callback) {	
	var id = username + "_" + time.getTime().toString();
					
	var params = {
      Item: {
        "username": { "S" : username },
		"userpage": { "S" : userpage },
		"destpage": { "S" : destpage },
		"contents": { "S" : contents },
		"time": { "S" : time.getTime().toString() },
		"id": { "S" : id },
		"timeStr": { "S" : time.toLocaleString("en-US", {timeZone: "UTC"}) },
      },
      TableName: "Posts",
  };

  db.putItem(params, function(err, data){
    if (err)
      callback(err)
    else
      callback(null, 'Success')
  });
}

//adds a comments to the comments table
var addComment = function(post_id, username, contents, time, callback) {		
	var params = {
      Item: {
	    "post_id": { "S" : post_id },
        "username": { "S" : username },
		"contents": { "S" : contents },
		"time": { "S" : time.getTime().toString() },
		"timeStr": { "S" : time.toLocaleString("en-US", {timeZone: "UTC"}) },
      },
      TableName: "Comments",
  };

  db.putItem(params, function(err, data){
    if (err)
      callback(err)
    else
      callback(null, 'Success')
  });
}

//adds a friend for a user
var addFriend = function(user, friend, callback) {		
	var params = {
      Item: {
        "username": { "S" : user },
		"friend": { "S" : friend },
      },
      TableName: "Friends",
  };

  db.putItem(params, function(err, data){
    if (err)
      callback(err)
    else
      callback(null, 'Success')
  });
}

//removes a friend for a user
var removeFriend = function(username, friend, callback) {
	var params = {
	  TableName : "Friends",
	  Key: {
		"username" : { "S" : username },
		"friend" : { "S" : friend },
	  },
    };

    db.deleteItem(params, function(err, data){
	    if (err)
	      callback(err)
	    else
	      callback(null, 'Success')
	});
}

//gets an array of all posts for an array of usernames
var getPostsOfUsers = function(users) {		
	var arrayOfPromises = new Array();
		
	for (var i = 0; i < users.length; i++) {
		var username = users[i];
		
		var params = {
			TableName : "Posts",
			KeyConditionExpression: "#un = :string1",
			ExpressionAttributeNames: {
		        "#un": "username",
		    },
			ExpressionAttributeValues: {
			  ":string1": { "S" : username },
			}
		};

		arrayOfPromises.push(db.query(params).promise())		
	}
	
	return Promise.all(arrayOfPromises).then(
		successfulDataArray => {	
			var posts = [];
						
			for (var i = 0; i < successfulDataArray.length; i++)
			{
				for (var j = 0; j < successfulDataArray[i].Items.length; j++) {					
					posts.push(successfulDataArray[i].Items[j]);
				}
			}	
									
			for (var i = posts.length - 1; i >= 0; i--)
			{
				for (var j = i - 1; j >= 0; j--) {					
					if (posts[i].time.S == posts[j].time.S && posts[i].destpage.S == posts[j].destpage.S && posts[i].userpage.S == posts[j].userpage.S) {
						var temp = posts[i];
						posts[i] = posts[posts.length - 1];
						posts[posts.length - 1] = temp;
						posts.pop();
						break;
					}
				}
			}	
										
			posts.sort(function(a,b){
				return Number(BigInt(a.time.S)) - Number(BigInt(b.time.S));
			});
						
			return posts;
		},
		errorDataArray => {
			console.log(errorDataArray)
		}
	);
}

//gets the list of all users in the table
var getAllUsers = function(callback) {
	var params = {
		TableName : "Users"
	};
	
	db.scan(params, function(err, data) {
		if (err) {
			callback(null);
		} else {
			callback(err, data.Items);
		}
	});
}

//adds a recent friendship to the recent friendships tablee
var addRecentFriendShip = function(added, adder, callback) {	
	var time = new Date();
	var params = {
      Item: {
        "added": { "S" : added },
		"adder": { "S" : adder },
		"time": { "S" : time.getTime().toString() },
      },
      TableName: "RecentFriendship",
  };

  db.putItem(params, function(err, data){
    if (err)
      callback(err)
    else
      callback(null, 'Success')
  });
}

//gets all the recent friendships for a user
var getRecentFriendShips = function(user, callback) {		
	var params = {
		TableName : "RecentFriendship",
		KeyConditionExpression: "#un = :string1",
		ExpressionAttributeNames: {
		    "#un": "added",
		},
		ExpressionAttributeValues: {
		  ":string1": { "S" : user },
		}
	};
	
	db.query(params, function(err, data){
	    if (err)
	      callback(err)
	    else
	      callback(null, data.Items)
	});
}

//removes a recent friendship
var removeRecentFriend = function(added, adder, callback) {		
	var params = {
		TableName : "RecentFriendship",
		KeyConditionExpression: "#un = :string1",
		ExpressionAttributeNames: {
		    "#un": "added",
			"#ut": "adder",
		},
		ExpressionAttributeValues: {
		  ":string1": { "S" : added },
		  ":string2": { "S" : adder },
		},
		FilterExpression: "#ut = :string2"
	};
	
	db.query(params, function(err, data){
	    if (err)
	      callback(err)
	    else
		{			
			var entry = data.Items[0];
			
			var params2 = {
			  TableName : "RecentFriendship",
			  Key: {
				"added" : { "S" : entry.added.S },
				"time" : { "S" : entry.time.S },
			  },
		    };
		
		    db.deleteItem(params2, function(err, data){
			    if (err)
			      callback(err);
			    else
			      callback(null, 'Success')
			});
		}
	});
}

//gets the user data for each person in the friends array
var getFriendsData = function(friends, callback) {		
	var arrayOfPromises = new Array();
	
	for (var i = 0; i < friends.length; i++) {
		var friend = friends[i].friend.S;
		
		var params = {
	 	    TableName : "Users",
			KeyConditionExpression: "#un = :string1",
			ExpressionAttributeNames: {
		        "#un": "username",
		    },
			ExpressionAttributeValues: {
			  ":string1": { "S" : friend },
			}
		};

		arrayOfPromises.push(db.query(params).promise())		
	}
	
	return Promise.all(arrayOfPromises).then(
		successfulDataArray => {	
			var friends = [];
			for (var i = 0; i < successfulDataArray.length; i++)
			{
				friends.push(successfulDataArray[i].Items[0]);
			}
			return friends;
		},
		errorDataArray => {
			console.log(errorDataArray)
		}
	);
}

//adds a chat to the chat array
var addChat = function(chat_id, creator, members, is_req, time, isGC,  callback) {
    var time = new Date();
    var isGC = members.length > 2;
    var chat_id = "";
    
    members.sort();
    
    for (var i = 0; i < members.length; i++) {
        chat_id += members[i];
    }
    
    if (isGC) {
        chat_id += time.getTime().toString();
    }
                    
    var params = {
          Item: {
                "chat_id": { "S" : chat_id },
        	"recent_time": { "S" : time.getTime().toString() },
        	"isRequest": { "BOOL" : is_req },
        	"creator": { "S" : creator },
        	"isGC": { "BOOL" : isGC },
        	"members": { "SS" : members },
        	"timeStr": { "S" : time.toLocaleString("en-US", {timeZone: "UTC"}) },
          	},
          TableName: "Chats",
      };
    
    db.putItem(params, function(err, data){
        if (err)
          callback(err)
        else
          callback(null, 'Success')
      });
}

//returns a boolean for whether a chat exists between two users
var getChatExists = function(user1, user2, callback) {
    if (user1 > user2) {
        var temp = user1;
        user1 = user2;
        user2 = temp;
    }
    
    var chat_id = user1 + user2;
    
    var params = {
        TableName : "Chats",
        KeyConditionExpression: "#un = :string1",
        ExpressionAttributeNames: {
            "#un": "chat_id",
        },
        ExpressionAttributeValues: {
          ":string1": { "S" : chat_id },
        }
    };
    
    db.query(params, function(err, data){
        if (err)
          callback(err)
        else
          if (data.Items.length > 0) {
          	callback(null, true);
          } else {
          	callback(null, false)
          }
          
    });
}

//adds a member to a specific chat
var addMemberToChat = function(chat_id, username, callback) {
    var params = {
      Item: {
        "chat_id": { "S" : chat_id },
        "username": { "S" : username },
      },
      TableName: "ChatMembers",
      };
    
    db.putItem(params, function(err, data){
        if (err)
          callback(err)
        else
          callback(null, 'Success')
    });
}

//adds a member to a chat and updates two databases - chat members and chats
var addMemberToChat2 = function(chat_id, members, username, callback) {
    var params = {
      Key: {
        "chat_id" : { "S" : chat_id },
	
      },
      UpdateExpression: "set members = :un",
      ExpressionAttributeValues: {
        ":un": { "SS" : members },
      },
      TableName: "Chats",
    };

    db.updateItem(params, function(err, data){
      if (err)
        callback(err)
    else {
        
    var params2 = {
      Item: {
        "chat_id": { "S" : chat_id },
        "username": { "S" : username },
      },
      TableName: "ChatMembers",
      };
    db.putItem(params2, function(err, data){
        if (err)
          callback(err)
        else
          callback(null, 'Success')
    });
    }
    });

}

//gets all chats the user is in
var getChatsOfUser = function(username, callback) {
    var params = {
        TableName : "ChatMembers",
        KeyConditionExpression: "#un = :string1",
        ExpressionAttributeNames: {
            "#un": "username",
        },
        ExpressionAttributeValues: {
          ":string1": { "S" : username },
        }
    };
    
    db.query(params, function(err, data){
        if (err)
          callback(err)
        else
          callback(null, data.Items)
    });
}

//gets all the information from the chat table for a list of chat_ids
var getChatInfo = function(chat_ids) {
    var arrayOfPromises = new Array();
    
    for (var i = 0; i < chat_ids.length; i++) {
    	
        var chat_id = chat_ids[i].chat_id.S;
        
        
        var params = {
              TableName : "Chats",
            KeyConditionExpression: "#un = :string1",
            ExpressionAttributeNames: {
                "#un": "chat_id",
            },
            ExpressionAttributeValues: {
              ":string1": { "S" : chat_id },
            }
        };

        arrayOfPromises.push(db.query(params).promise())        
    }
    
    return Promise.all(arrayOfPromises).then(
        successfulDataArray => {    
            var chats = [];
            for (var i = 0; i < successfulDataArray.length; i++)
            {
                chats.push(successfulDataArray[i].Items[0]);
            }
            
            chats.sort(function(a,b){
                return Number(BigInt(a.recent_time.S)) - Number(BigInt(b.recent_time.S));
            });
            
            return chats;
        },
        errorDataArray => {
            console.log(errorDataArray)
        }
    );

}

//gets the chat information for a specific chat
var getChat = function(chat_id, callback) {
    var params = {
        TableName : "Chats",
        KeyConditionExpression: "#un = :string1",
        ExpressionAttributeNames: {
            "#un": "chat_id",
        },
        ExpressionAttributeValues: {
          ":string1": { "S" : chat_id },
        }
    };
    
    db.query(params, function(err, data){
        if (err)
          callback(err)
        else
          callback(null, data.Items[0])
    });
}

//gets all the messages in a specific chat
var getMessagesOfChat = function(chat_id, callback) {
    var params = {
        TableName : "Messages",
        KeyConditionExpression: "#un = :string1",
        ExpressionAttributeNames: {
            "#un": "chat_id",
        },
        ExpressionAttributeValues: {
          ":string1": { "S" : chat_id },
        }
    };
    
    db.query(params, function(err, data){
        if (err)
          callback(err)
        else
          callback(null, data.Items)
    });
}

//makes a chat to not be a request
var makeNotRequest = function(chat_id, callback) {
    var params = {
      Key: { 
        "chat_id" : { "S" : chat_id },
	
      },
      UpdateExpression: "set isRequest = :un",
      ExpressionAttributeValues: {
        ":un": { "BOOL" : false },
      },
      TableName: "Chats",
    };

    db.updateItem(params, function(err, data){
      if (err)isRequest
        callback(err)
    });
}

//removes a chat and the last user
var removeChat = function(chat_id, username, callback) {
    var params2 = {
              Key: {
                "chat_id": { "S" : chat_id },
          "username": { "S" : username },
              },
              TableName: "ChatMembers",
      };
    
    db.deleteItem(params2, function(err, data){
        if (err) {
          callback(err)
        } else {
          	var params = {
      			TableName : "Chats",
      			Key: {
      				"chat_id" : { "S" : chat_id },
				
        	
      				},
		};

       	 db.deleteItem(params, function(err, data){
       	 if (err)
         	 	callback(err)
        	else
          		callback(null, 'Success')
    		});
        }
    });  
}

//removes a member from the chat
var removeMemberFromChat = function(chat_id, members, username, callback) {
    var params = {
      Key: {
        "chat_id" : { "S" : chat_id },
	
      },
      UpdateExpression: "set members = :un",
      ExpressionAttributeValues: {
        ":un": { "SS" : members },
      },
      TableName: "Chats",
    };

    db.updateItem(params, function(err, data){
      if (err) {
        callback(err)
      } else {
      	 var params2 = {
              Key: {
                "chat_id": { "S" : chat_id },
          "username": { "S" : username },
              },
              TableName: "ChatMembers",
      };
    
    db.deleteItem(params2, function(err, data){
        if (err)
          callback(err)
        else
          callback(null, 'Success')
    });
      }
    });
      
}

//adds a message to a chat
var addMessage = function(chat_id, username, contents, callback) {
    var time = new Date();
    
    var params = {
      Key: {
        "chat_id" : { "S" : chat_id},
      },
          UpdateExpression: "set recent_time = :un",
      ExpressionAttributeValues: {
        ":un": { "S" : time.getTime().toString() },
      },
      TableName: "Chats",
    };

    db.updateItem(params, function(err, data){
      if (err)
        callback(err)
    else {
        var params2 = {
      Item: {
                "chat_id": { "S" : chat_id },
        "time": { "S" : time.getTime().toString() },
        "username": { "S" : username },
        "contents": { "S" : contents },
        "timeStr": { "S" : time.toLocaleString("en-US", {timeZone: "UTC"}) },
      },
      TableName: "Messages",
  };
    
    db.putItem(params2, function(err, data){
        if (err)
          callback(err)
        else
          callback(null, 'Success')
      });
    }
    });
}
//Gets the articles from the article table, sorted by number of times seen and then by weight
var getArticlesOrd = function(articles){
        var arrayOfPromises = new Array();
        var ordSet = {}
        for(var i=0;i<articles.length;i++)
        {
        var articleID = articles[i].articleID.N
        ordSet[articleID]=(articles[i].ordNum.N);
	var params = {
	TableName : "Articles",
		KeyConditionExpression: "#un = :n1",
		ExpressionAttributeNames: {
		 "#un": "articleID",
		},
		ExpressionAttributeValues: {
                 ":n1": { "N" : articleID },
		}
	};

	arrayOfPromises.push(db.query(params).promise())
	};
	return Promise.all(arrayOfPromises).then(
	    successfulDataArray=>{
	    var results = Array()
	    if(successfulDataArray.length==0||successfulDataArray[0].Items.length==0){
	    return []
	    }
	    for(var i=0;i<successfulDataArray.length;i++){
	       for(var j=0;j<successfulDataArray[i].Items.length;j++){
	           results.push(successfulDataArray[i].Items[j])
	       
	       }
	    
	    
	    }
	    results.sort(function(a,b){
				return ordSet[a.articleID.N] - ordSet[b.articleID.N];
			});
	    return results;
	    },
	    errorDataArray=>{
	    console.log(errorDataArray);
	    
	    }
	)

}
//Gets articles from Seen table to put on newsfeed
var getSeenArticles = function(username){
    var arrayOfPromises = new Array()
    var params = {
        TableName:"SeenArticles",
        KeyConditionExpression: "#un= :string1",
        ExpressionAttributeNames: {
        "#un":"username",
        },
        ExpressionAttributeValues:{
        ":string1":{"S":username},
        
        } 
    };
    arrayOfPromises.push(db.query(params).promise())
    return Promise.all(arrayOfPromises).then(
        successfulDataArray => {
            var results = Array()
            if(successfulDataArray[0].Items.length==0){
            return [];
            }
            for(var i=0;i<successfulDataArray.length;i++)
            {
               for(var j=0;j<successfulDataArray[i].Items.length;j++){
		results.push(successfulDataArray[i].Items[j])
		}
	     }
	     return results;
	    },
            errorDataArray => {
            console.log(errorDataArray);
        })
}
//Get articles by search term entered--no sorting
var getSearchedArticles = function(searchField){
        var searchTerms = searchField.split(" ")
        //console.log(searchTerms);
	var arrPromises = Array()
	for(var i=0;i<searchTerms.length;i++){
	    var searchTerm = stemmer(searchTerms[i].toLowerCase());
        var params = {
      TableName : "searchKeywords",
          KeyConditionExpression: "#kwrd = :k",
          ExpressionAttributeNames:{
          "#kwrd":"keyword"
          },
          ExpressionAttributeValues:{
          ":k":{"S":searchTerm}
          },
          Limit:100
      };
      	 arrPromises.push(db.query(params).promise())   
	}
	return Promise.all(arrPromises).then(
	successfulDataArray =>{
	    var results = {}
	    for(var i=0;i<successfulDataArray.length;i++){
	        for(var j=0;j<successfulDataArray[i].Items.length;j++){
	            results[successfulDataArray[i].Items[j].articleID.N] = (results[successfulDataArray[i].Items[j].articleID.N]||0)+1;
	        
	        }
	    
	    }
	    return results
	},
	errorDataArray=>{
	console.log(errorDataArray);
	}
	
	);

}
//updates a user to include a liked article
var updateLikedArticle = function(username,articleID,callback){
	var params = {
	  Key: {
		"username" : { "S" : username}
	  },
      UpdateExpression: "ADD likedArticles :aS",
	  ExpressionAttributeValues: {
		":aS": { "NS" : [articleID] },
      },
      TableName: "Users",
    };

    db.updateItem(params, function(err, data){
      if (err)
        callback(err)
      else
        callback(null, 'Success')
    });

}
//Gets a user's articles from the weighted graph
var getWeightedArticles = function(username,articles){
    var arrayOfPromises = new Array()
    if(articles.length==0){
        return []
    }
    var params = {
        TableName:"NewsGraph",
        KeyConditionExpression: "#un= :string1",
        ExpressionAttributeNames: {
        "#un":"username",
        },
        ExpressionAttributeValues:{
        ":string1":{"S":username},
        
        } 
    };
    arrayOfPromises.push(db.query(params).promise())
    return Promise.all(arrayOfPromises).then(
        successfulDataArray => {
            var results = Array()
            graphSet = {}
            for(var i=0;i<successfulDataArray.length;i++)
            {
               for(var j=0;j<successfulDataArray[i].Items.length;j++){
               graphSet[successfulDataArray[i].Items[j].articleID.N] = successfulDataArray[i].Items[j].W.N ;
		}
	     }
	     for(var i=0;i<articles.length;i++){
	        if(graphSet[articles[i]]){
	            results.push([articles[i],graphSet[articles[i]]]);
	        
	        }
	        else {
	            results.push([articles[i],-1]);
	        }
	     }
	     return results;
	    },
            errorDataArray => {
            console.log(errorDataArray);
        })

}
//Gets the articles from the article table, sorted by by weight
var getArticlesOrdWeight = function(articles, ordSet){
        var arrayOfPromises = new Array();
        var weightSet = {}
        if(articles.length==0){
        return []
        }
        for(var i=0;i<articles.length;i++)
        {
        var articleID = articles[i][0]
        var weight = articles[i][1]
        weightSet[articleID]=weight
	var params = {
	TableName : "Articles",
		KeyConditionExpression: "#un = :n1",
		ExpressionAttributeNames: {
		 "#un": "articleID",
		},
		ExpressionAttributeValues: {
                 ":n1": { "N" : articleID },
		}
	};

	arrayOfPromises.push(db.query(params).promise())
	};
	return Promise.all(arrayOfPromises).then(
	    successfulDataArray=>{
	    var results = Array()
	    if(successfulDataArray[0].Items.length==0){
	    return []
	    }
	    for(var i=0;i<successfulDataArray.length;i++){
	       for(var j=0;j<successfulDataArray[i].Items.length;j++){
	           results.push(successfulDataArray[i].Items[j])
	       
	       }
	    
	    
	    }
	    results.sort((a,b)=>
				(ordSet[a.articleID.N]>ordSet[b.articleID.N]) ?1
				: (ordSet[a.articleID.N]==ordSet[b.articleID.N])?
				((weightSet[a.articleID.N]>weightSet[b.articleID.N])?1:-1):-1
			);
	    return results.splice(0,10);
	    },
	    errorDataArray=>{
	    console.log(errorDataArray);
	    
	    }
	
	)
}


/* We define an object with one field for each method. For instance, below we have
   a 'lookup' field, which is set to the myDB_lookup function. In routes.js, we can
   then invoke db.lookup(...), and that call will be routed to myDB_lookup(...). */

//Don't forget to add any new functions to this class, so app.js can call them. (The name before the colon is the name you'd use for the function in app.js; the name after the colon is the name the method has here, in this file.)

var database = { 
	lookup: myDB_lookup,
	addUser: add_User,
	getUser: get_User,
	getFriendsOfUser: friendsOfUser,
	isOnline: is_Online,
	get_post: getPosts,
	getComments: get_Comments,
	changeaffliation: changeAffiliation,
	changeemail: changeEmail,
	changenews: changeNews,
	changepassword: changePassword,
	addpost: addPost,
	addcomment: addComment,
	addfriend: addFriend,
	removefriend: removeFriend,
	getPosts: getPostsOfUsers,
	set_offline: setOffline,
	set_online: setOnline,
	getusers: getAllUsers,
	addrecentfriend: addRecentFriendShip,
	getrecentfriend: getRecentFriendShips,
	getfriendsdata: getFriendsData,
	removerecentfriend: removeRecentFriend,
	getChats: getChatsOfUser,
	getChat: getChat,
	addChat: addChat,
	getChatExists: getChatExists,
	addMemberToChat: addMemberToChat,
	addMemberToChat2: addMemberToChat2,
	getMessages: getMessagesOfChat,
	makeNotRequest: makeNotRequest,
	removeChat: removeChat,
	removeMemberFromChat: removeMemberFromChat,
	addMessage: addMessage,
	getChatInfo: getChatInfo,
	getSeenArticles: getSeenArticles,
	getArticlesOrd: getArticlesOrd,
	updateLikedArticle: updateLikedArticle,
	getSearchedArticles: getSearchedArticles,
	getWeightedArticles: getWeightedArticles,
    getArticlesOrdWeight: getArticlesOrdWeight
};

module.exports = database;
                                        
