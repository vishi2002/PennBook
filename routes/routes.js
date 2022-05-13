var db = require('../models/database.js');
var CryptoJS = require("crypto-js");

var path = require('path')
const {exec} = require("child_process")

//go to the login page
var getLogin = function(req, res) {
	res.render('login.ejs', {message: ''});
}

var checkLogins = function(req, res) {  //logs the user in and checks to see if the password is correct
	var username = req.body.username;
	var password = req.body.password;
	db.lookup(username, function(err, data) {
		if (err)
		{
			res.render('login.ejs', {message: 'Your inputs were empty. Please try again'});
		} else if (data) {
			var hashedPassword = CryptoJS.SHA256(password).toString();
			if (data == hashedPassword)
			{
				req.session.user = username;
				req.session.password = password;
				db.set_online(req.session.user, function(err, data)
				{
					res.redirect("/homepage");
				});

			}
			else
			{
				res.render('login.ejs', {message: "You entered the password incorrectly"});
			}
		}
		else
		{
				res.render('login.ejs', {message: "This username does not exist in our database"})
		}

	});
};

//route for the signup page
var getSignups = function(req, res) { //loads the signup page
	res.render('signup.ejs', {alert: ''});

}

//route to create an account
var createAccount = function(req, res) { //creates an account for a user
	var userName = req.body.username;
	db.lookup(userName, function(err, data) {
		if (data)
		{
			res.render('signup.ejs', {alert: "This username is taken."})
		}
		else
		{
			var passWord = req.body.password; //hash the passWord
			var fullName = ""+req.body.firstName+" "+req.body.lastName;
			var emailAddress = req.body.emailAddress;
			var affiliation = req.body.affiliation;
			var birthMonth = req.body.birthMonth;
			var birthDay = req.body.birthDay;
			var birthYear = req.body.birthYear;
			var newsInterests = req.body.newsInterests; //dropdown menu with at least 2
			var isOnline = true;

			if (newsInterests == null) {
				newsInterests = [];
			} else if (typeof newsInterests == "string") {
				newsInterests = [];
				newsInterests.push(req.body.newsInterests);
			}

			if (passWord == "" || fullName == "" || emailAddress == "" || affiliation == "" ||
			birthMonth == "" || birthDay == "" || birthYear == "" || newsInterests.length < 2)
			{
				res.render('signup.ejs', {alert: "An input was empty or insufficient. Fill all the fields."})
			}
			else
			{
				var hashedPassword = CryptoJS.SHA256(passWord).toString();
			db.addUser(userName, hashedPassword, fullName, emailAddress, affiliation, birthDay, birthMonth, birthYear, newsInterests, isOnline, function(err, data) {
				if (err)
				{
					res.render('signup.ejs', {alert: err});
				}
				else if (data) {
					req.session.user = userName;
					req.session.password = passWord;
					res.redirect("/homepage");
				}


				else {
					res.render('signup.ejs', {alert: "Undefined Error"})
				}
			});
			}
		}
	});
};

var makeWallPage = function(req, res)  //renders the wall page
{
	if (req.session.user != null)
	{
	var user = req.params.username;
	//var password = req.session.password;
	db.getUser(user, function(err, data) {  //should query the user Information table by user and return all the relevant information in the data array
		var fullName = data.fullname.S;
		var emailAddress = data.email.S;
		var affiliation = data.affiliation.S;
		var birthDay = data.birth_month.S+ " "+data.birth_day.S+ " "+data.birth_year.S;
		var newsInterests = data.news_interest.SS;

		db.getFriendsOfUser(user, function(err2, friends) //should be the getFriendsOfUser
		{
				db.get_post(user, function(err4, posts) //should be the getPosts method
				{
					var postIDs = []
					for (var k = 0; k < posts.length; k++)
					{

						if (posts[k].userpage.S != "" && posts[k].destpage.S != "") {
							posts[k].username.S = posts[k].userpage.S + " (to " + posts[k].destpage.S + ")";
						}

						postIDs.push(posts[k].id.S);
					}
					let comment = db.getComments(postIDs);
					comment.then(function(comments) {
					const bestfriends = [];
					for (var j = 0; j < friends.length; j++)
					{
						bestfriends.push(friends[j].friend.S);
					}
					let bestOnlineFriends = db.isOnline(bestfriends);
					bestOnlineFriends.then(function(result) {
						const onlineArr = [];
						for (var i = 0; i < bestfriends.length; i++)
						{
							if (result.includes(bestfriends[i]))
							{
								onlineArr.push(true);
							}
							else
							{
								onlineArr.push(false);
							}
						}

						db.getFriendsOfUser(req.session.user, function(err, data) {
							const bestfriends2 = [];
							for (var l = 0; l < data.length; l++)
							{
							bestfriends2.push(data[l].friend.S);
							}
							db.getusers(function(err, data)
							{
						res.render('wall.ejs', {users: data, isFriends: bestfriends2, wallUser: user, currUser: req.session.user, comment: comments, posts: posts, online: onlineArr, friends: bestfriends, name: fullName, email: emailAddress, affiliation: affiliation, birth: birthDay, newsLikes: newsInterests});
							});
						});
					});
					});
				});

		});
	});
	}
	else
	{
		res.redirect("/");
	}

};

//allows for changes to the account to be made like changing the password

var changeAccount = function(req, res)
{
	if (req.session.user != null)
	{
		var userName = req.session.user;
		var passWord = req.session.password;

		db.getUser(userName, function(err, data) {  //should query the user Information table by user and return all the relevant information in the data array

		var fullName = data.fullname.S;
		var emailAddress = data.email.S;
		var affiliation = data.affiliation.S;
		var birthDay = data.birth_month.S+ " "+data.birth_day.S+ " "+data.birth_year.S;
		var newsInterests = data.news_interest.SS;
		res.render('change.ejs', {user: userName, alert: "", password: passWord, name: fullName, email: emailAddress, affiliation: affiliation, birth: birthDay, newsLikes: newsInterests});
		});

	}
	else
	{
		res.redirect("/");
	}
}

//allows for changes to the account to be made like changing the affiliation
var changeAffiliation = function(req, res)
{
	if (req.session.user != null)
	{
		var userName = req.session.user;
		var passWord = req.session.password;
		db.getUser(userName, function(err, data) {  //should query the user Information table by user and return all the relevant information in the data array

		var fullName = data.fullname.S;
		var emailAddress = data.email.S;
		var affiliation = data.affiliation.S;
		var birthDay = data.birth_month.S+ " "+data.birth_day.S+ " "+data.birth_year.S;
		var newsInterests = data.news_interest.SS;
		var newAffiliation = req.body.affiliations;
		if (newAffiliation != "")
		{
		db.changeaffliation(userName, newAffiliation, function(err, data) {
			var contents = userName+" is now affiliated with "+newAffiliation;
			db.addpost(userName, "", "", contents, new Date(), function(err1, data1) {
				res.render('change.ejs', {user: userName, alert: "", password: passWord, name: fullName, email: emailAddress, affiliation: newAffiliation, birth: birthDay, newsLikes: newsInterests});
			});
		});
		}
		else
		{
			res.render('change.ejs', {user: userName, alert: "Input was blank. Try Again", password: passWord, name: fullName, email: emailAddress, affiliation: affiliation, birth: birthDay, newsLikes: newsInterests});
		}
		});
	}
	else
	{
		res.redirect("/"+userName);
	}
}

//allows for changes to the account to be made like changing the password
var changePassword = function(req, res)
{
	if (req.session.user != null)
	{
		var userName = req.session.user;
		var passWord = req.session.password;
		db.getUser(userName, function(err, data) {  //should query the user Information table by user and return all the relevant information in the data array

		var fullName = data.fullname.S;
		var emailAddress = data.email.S;
		var affiliation = data.affiliation.S;
		var birthDay = data.birth_month.S+ " "+data.birth_day.S+ " "+data.birth_year.S;
		var newsInterests = data.news_interest.SS;
		var newPassword = req.body.newpassword;
		if (newPassword != "")
		{
		req.session.password = newPassword;
		var hashedPassword = CryptoJS.SHA256(newPassword).toString();
		db.changepassword(userName, hashedPassword, function(err, data) {
		res.render('change.ejs', {user: userName, alert: "", password: newPassword, name: fullName, email: emailAddress, affiliation: affiliation, birth: birthDay, newsLikes: newsInterests});
		});
		}
		else
		{
			res.render('change.ejs', {user: userName, alert: "Input was blank. Try Again", password: passWord, name: fullName, email: emailAddress, affiliation: affiliation, birth: birthDay, newsLikes: newsInterests});
		}
		});
	}
	else
	{
		res.redirect("/"+userName);
	}
}


//allows for changes to the account to be made like changing the email address
var changeEmailAddress = function(req, res)
{
	if (req.session.user != null)
	{
		var userName = req.session.user;
		var passWord = req.session.password;
		db.getUser(userName, function(err, data) {  //should query the user Information table by user and return all the relevant information in the data array

		var fullName = data.fullname.S;
		var emailAddress = data.email.S;
		var affiliation = data.affiliation.S;
		var birthDay = data.birth_month.S+ " "+data.birth_day.S+ " "+data.birth_year.S;
		var newsInterests = data.news_interest.SS;
		var newEmail = req.body.emailAddress;
		if (newEmail != "")
		{
		db.changeemail(userName, newEmail, function(err, data) {
		res.render('change.ejs', {user: userName, alert: "", password: passWord, name: fullName, email: newEmail, affiliation: affiliation, birth: birthDay, newsLikes: newsInterests});
		});
		}
		else
		{
			res.render('change.ejs', {user: userName, alert: "Input was blank. Try Again", password: passWord, name: fullName, email: emailAddress, affiliation: affiliation, birth: birthDay, newsLikes: newsInterests});
		}
		});
	}
	else
	{
		res.redirect("/"+userName);
	}
}


//allows for changes to the account to be made like changing the news interests

var changeNewsInterests = function(req, res)
{
	if (req.session.user != null)
	{
		var userName = req.session.user;
		var passWord = req.session.password;
		db.getUser(userName, function(err, data) {  //should query the user Information table by user and return all the relevant information in the data array

		var fullName = data.fullname.S;
		var emailAddress = data.email.S;
		var affiliation = data.affiliation.S;
		var birthDay = data.birth_month.S+ " "+data.birth_day.S+ " "+data.birth_year.S;
		var newsInterests = data.news_interest.SS;
		var newInterests = req.body.newsInterests;
			if (newInterests != null && newInterests.toString().includes(','))
			{
                                updateGraph(userName);
				db.changenews(userName, newInterests, function(err, data) {
				var contents = userName+" is now interested in "+newInterests;
					db.addpost(userName, "", "", contents, new Date(), function(err1, data1)
					{
					res.render('change.ejs', {user: userName, alert: "", password: passWord, name: fullName, email: emailAddress, affiliation: affiliation, birth: birthDay, newsLikes: newInterests});
					});
				});
			}
		else
		{
			res.render('change.ejs', {user: userName, alert: "Input was blank or insufficient. Try Again", password: passWord, name: fullName, email: emailAddress, affiliation: affiliation, birth: birthDay, newsLikes: newsInterests});
		}
		});
	}
	else
	{
		res.redirect("/"+userName);
	}
}

//route for adding a post so renders the add post page
var getAddPost = function(req, res) {
	res.render('adding.ejs', {statement: '', wallUser: req.params.username});
}



//route for adding a post
var addpost = function(req, res) //make this Ajax Asynchronous
{
	var userPage = req.params.username;
	if (req.session.user != null)
	{
		if (req.session.user == userPage) {
		var userName = req.session.user;
		var time = new Date(); //have no idea how you want me to store this
		var contents = req.body.content;
		db.addpost(userName, "", "", contents, time,  function(err, data) {
			if (contents == "")
			{
				res.render('adding.ejs', {statement: "There was no content. Fill the field."})
			}
			else
			{
				res.redirect("/wallPage/"+userPage); //or do I need to reload the wallpage manually, shouldn't need to when it's 'async.
			}
		});
		}
		else {
			var userName = req.session.user;
			var time = new Date(); //have no idea how you want me to store this
			var contents = req.body.content;
			db.addpost(userPage, userName, userPage, contents, time,  function(err, data) {
				if (contents == "")
				{
					res.render('adding.ejs', {statement: "There was no content. Fill the field."})
				}
				else
				{
					db.addpost(userName, userName, userPage, contents, time,  function(err, data) {
						if (contents == "")
						{
							res.render('adding.ejs', {statement: "There was no content. Fill the field."})
						}
						else
						{
							res.redirect("/wallPage/"+userPage); //or do I need to reload the wallpage manually, shouldn't need to when it's 'async.
						}
					}); //or do I need to reload the wallpage manually, shouldn't need to when it's 'async.
				}
			});
		}
	}
	else
	{
		res.redirect("/");
	}
}


//route for adding a comment to a post
var addcomment = function(req, res) //make this Ajax Asynchronous
{
	var userPage = req.params.username;
	var page = req.params.page;
	if (req.session.user != null)
	{
		var userName = req.session.user;
		var time = new Date(); //have no idea how you want me to store this
		var contents = req.body;
		var postID = 0;
		for (const x in contents)
		{
			postID = x;
			contents = req.body[x];
			break;
		}
		if (contents != "")
		{
		db.addcomment(postID, userName, contents, time, function(err, data) {
			if (page == "home") {
				res.redirect("/homePage");
			} else {
				res.redirect("/wallPage/"+userPage);
			}
		});
		}
	}
	else
	{
		res.redirect("/");
	}
}


//route for adding a friend
var addFriend = function(req, res)
{
	var userPage = req.params.username;
	var userName = req.session.user;


	if (userName != null)
	{
		db.addfriend(userName, userPage, function(err, data)
		{
			db.addrecentfriend(userPage, userName, function(err1, data1)
			{
				res.redirect("/wallPage/"+userPage);
			});
		});
	}
	else
	{
		res.redirect("/");
	}
}

//route for removing a friend
var removeFriend = function(req, res)
{
	var userPage = req.params.username;
	var userName = req.session.user;


	if (userName != null)
	{
		db.removefriend(userName, userPage, function(err, data)
		{
			db.removerecentfriend(userPage, userName, function(err, data)
			{
				res.redirect("/wallPage/"+userPage);
			});
		});
	}
	else
	{
		res.redirect("/");
	}
}

//route for the home page and rendering it
var getHomePage = function(req, res) {
	var userName = req.session.user;
	if (userName != null)
	{
	db.getFriendsOfUser(userName, function(err, friends)
	{
		const bestfriends = [];
		for (var j = 0; j < friends.length; j++)
		{
			bestfriends.push(friends[j].friend.S);
		}
		bestfriends.push(userName);

		let q = db.getPosts(bestfriends);
		q.then(function(posts) {
			var postIDs = []
			for (var k = 0; k < posts.length; k++)
			{
				if (posts[k].userpage.S != "" && posts[k].destpage.S != "") {
					posts[k].username.S = posts[k].userpage.S + " (to " + posts[k].destpage.S + ")";
				}


				postIDs.push(posts[k].id.S);
			}

			let comment = db.getComments(postIDs);
			comment.then(function(comments) {
				db.getusers(function(err, data)
				{
				db.getrecentfriend(userName, function(err, bestfriends)
				{
				res.render('home.ejs', {friends: bestfriends, users: data, user: userName, posts: posts, comment: comments});
				});
				});
			});
		});
	});
	}
	else
	{
		res.redirect("/");
	}

}


//route for logging out
var logout = function(req, res)
{
	db.set_offline(req.session.user, function(err, data)
	{
		req.session.destroy();
		res.redirect("/");
	});

}

//route to render the visualizer page
var visualizer = function(req, res)
{
	if (req.session.user != null) {
		db.getusers(function(err, data)
		{
			res.render('friendvisualizer.ejs', {users: data, user: req.session.user});
		});
	} else {
		res.redirect("/");
	}
}

//creates the json object to render the visualizer
var friendvisualization = function(req, res) {
	var username = req.session.user;

	db.getUser(username, function(err, user)
	{
		db.getFriendsOfUser(username, function(err, friendsnames)
		{
			var friendJSON = [];

			let q = db.getfriendsdata(friendsnames);
			q.then(function(friends) {
				for (var i = 0; i < friends.length; i++) {
					var friend = friends[i];

					var json = {"id": friend.username.S, "name": friend.fullname.S, "data":{}, "children" : [] };
					friendJSON.push(json);
				}

				var json = {"id": username, "name": user.fullname.S, "data":{}, "children" : friendJSON };
				res.send(json);
			});
		});
	});
}

//adds new nodes to the visualzer based on friendships
var getFriends = function(req, res) {
	var username = req.params.user;
	db.getUser(req.session.user, function(err, login)
	{
		db.getUser(username, function(err, user)
		{
			db.getFriendsOfUser(username, function(err, friendsnames)
			{
				var friendJSON = [];

				let q = db.getfriendsdata(friendsnames);
				q.then(function(friends) {
					for (var i = 0; i < friends.length; i++) {
						var friend = friends[i];
						var json = {"id": friend.username.S, "name": friend.fullname.S, "data":{}, "children" : [] };

						if (login.affiliation.S == friend.affiliation.S) {
							friendJSON.push(json);
						}
					}

					var json = {"id": username, "name": user.fullname.S, "data":{}, "children" : friendJSON };
					res.send(json);
				});
			});
		});
	});
}

//queries a user's chat requests and chats which are both stored in the "Chats" database and sends it to the front end
var loadChats = function(req, res) {
	console.log("XXX");
	if (req.session.user == null) {
		res.redirect("/");
		return;
	}

	//getting chat-ids of the chats the user is in
	db.getChats(req.session.user, function(err, data) {
		if (err) {

			res.send(JSON.stringify({chats:[], message: "Something went wrong getting your chats!"}));

		} else {

			//getting actual chats w/ all information and sending to frontend
			db.getChatInfo(data).then(function(results) {
				res.send(JSON.stringify({chats: results, user: req.session.user}));
			});

		}

	});

}


//loading chat homepage
var chats = function(req, res) {
	if (req.session.user == null) {
		res.redirect("/");
		return;
	}

	res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message: ""});

	return;

}

//route to send a chat request
var addRequest = function(req, res) {
	if (req.session.user == null) {
		res.redirect("/");
		return;
	}



	var user = req.session.user;
	var recipients = [req.body.recipient];
	var members = [req.body.recipient, user];
	//assumes that data goes to friends

	//gets all of the user/sender's friends recipient is in it
	db.getFriendsOfUser(user, function(err, data) {
		if (err) {
			res.send(JSON.stringify({chatId:"", message: "Something went wrong getting your friends!"}));
			return;

		} else {
			var i = 0;


			while (i < data.length && data[i].friend.S != req.body.recipient) {
				i++;
			}

			if (i == data.length) {

				res.send(JSON.stringify({chatId:"", message: "That user is not your friend in PennBook"}));

				return;

			} else {



				//checks if the recipient is online
	var checkOnline = db.isOnline(recipients);
	checkOnline.then(function(data) {

		 if (data.length == 0) {

			res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message: "Your friend is not online"});


		} else {


			var isRequest = true;

			//creating params for new chat
			var time = new Date();
			var isGC = false;
			var chat_id = "";

			members.sort();

			for (var i = 0; i < members.length; i++) {
				chat_id += members[i];


			}




			//checking if the chat exists - only important for private chats which is what adding a request would create
			db.getChatExists(user, req.body.recipient, function(err, data) {
				if (err) {
					res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message: "Something went wrong sending your chat request"});
					return;

				} else if (data) {
					res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message: "This chat already exists!"});
					return;

				}


				//adding chat to database
				db.addChat(chat_id, user, members, isRequest, time, isGC, function(err, data) {

					if (err) {
						res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message: "Couldn't send chat request!"});

						return;

					} else {
						//adding each member to the chat
						db.addMemberToChat(chat_id, members[0], function(err, data) {
							if (err) {
								res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message: "Couldn't send chat request!"});
								return;
							} else {

							}



						});

						db.addMemberToChat(chat_id, members[1], function(err, data) {
							if (err) {
								res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message: "Couldn't send chat request!"});
								return;
							} else {

							}
						});


						res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "all good"});
					}

				});


			});

		}


	});







			}

		}

	});


}

//accepting the request - changes isRequest of the chat to false to indicate it is an actual chat
var acceptRequest = function(req, res) {
	if (req.session.user == null) {
		res.redirect("/");
		return;
	}

	var chat_id = req.query.id;

		//gets chat
	db.getChat(chat_id, function(err, data) {
		if (err) {
			res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Couldn't accept chat request!"});
		} else {

			var i = 0;
			while (i < data.members.SS.length && data.members.SS[i] != req.session.user) {
				i++;
			}


			if (i == data.members.SS.length) {
				res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Sorry you are not authorized to accept this chat!"});
				return;
			}

			//changes isRequest to false
			db.makeNotRequest(chat_id, function(err, data) {
				if (err) {


					res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Couldn't accept chat request!"});
				} else {

					res.redirect("/chat?id=" + chat_id);
				}

			});
		}

	});
}

// rejecting chat - deletes it from the chats database and removes the sender and recipient from the chat
var rejectRequest = function(req, res) {
	if (req.session.user == null) {
		res.redirect("/");
		return;
	}

	var chat_id = req.query.id;

	//getting chat
	db.getChat(chat_id, function(err, data) {
		if (err) {
			res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Couldn't reject chat request!0"});
			return;
		} else {

			var i = 0;
			while (i < data.members.SS.length && data.members.SS[i] != req.session.user) {
				i++;
			}


			if (i == data.members.SS.length) {
				res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Sorry you are not authorized to reject this chat!"});
				return;
			}



			var members1 = [data.members.SS[0]];
			var members2 = [];
			
			//removing members from chats
			db.removeMemberFromChat(chat_id, members1, data.members.SS[1], function(err, data1) {
				if (err) {

					res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Couldn't accept reject request!"});
					return;
				} else {

					db.removeChat(chat_id, data.members.SS[0], function(err, data) {
						if (err) {
							res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Couldn't reject chat request!"});
							return;
						} else {


							res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message: ""});
							return;


						}

					});
				}

			});



		}

	});




}

//loading already existing messages in the chat openned
var loadMessages = function(req, res) {
	var chat_id = req.query.id;

	db.getMessages(chat_id, function(err, data) {
		if (err) {

			res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message: "something went wrong when we tried to get your messages"});
		} else {

			res.send(JSON.stringify({messages: data}));
		}
	});



}

// gets necessary info to render a chat
var loadSpecChat = function(req, res) {
	if (req.session.user == null) {
		res.redirect("/");
		return;
	}

	var chat_id = req.query.id;
	var user = req.session.user;


	//getting chats
	db.getChat(chat_id, function(err, data) {
		if (err) {

			res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Something went wrong getting your chat!", user:user});

		} else {

			//checking if in chat
			if (data.members.SS.length == 1) {
				if (data.members.SS[0] != user) {
					res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Sorry you are not authorized to look at that chat!", user:user});
					return;
				} else {
					res.render("chat.ejs", {chatId: chat_id, title: req.session.user, message: "", user:user});
					return;
				}
			}

			//creating chat titles - all members but user unless user is the only member, then just their username
			var members = "";
			var isMember = false;
			var k = 0;
			if (data.members.SS[0] == req.session.user) {
				members += data.members.SS[1];
				k = 2;
				isMember = true;
			} else {
				members += data.members.SS[0];
				k = 1;
			}

			while (k < data.members.SS.length) {
				if (data.members.SS[k] == req.session.user) {
					isMember = true;
				} else {
					members = members + ", " + data.members.SS[k];
				}
				k++;
			}


			if (!isMember) {
				res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Sorry you are not authorized to look that chat!"});
				return;
			}


			res.render("chat.ejs", {chatId: chat_id, title: members, message:"", user:user});

		}

	});

}

//renders the add user form when user clicks on add user button in a chat
var addUserForm = function(req, res) {
	if (req.session.user == null) {
		res.redirect("/");
		return;
	}


	var chat_id = req.query.id;
	var user = req.session.user;

	db.getChat(chat_id, function(err, data) {
		if (err) {

			res.render("addUser.ejs", {chatId: chat_id, message: "Something went wrong!"});
			return;

		} else {

			//checking if in chat
			var i = 0;
			while (i < data.members.SS.length && data.members.SS[i] != user) {
				i++;
			}

			if (i == data.members.SS.length) {
				res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message:"Whoops you weren't supposed to be there!"});
				return;

			}

			res.render("addUser.ejs", {chatId: chat_id, message: ""});
		}

	});


}

// adding a user to the chat
var addUserToChat = function(req, res) {
	if (req.session.user == null) {
		res.redirect("/");
		return;
	}



	var chat_id = req.body.chat_id;
	var user = req.session.user;
	var userToAdd = req.body.userToAdd;


	//getting chat
	db.getChat(chat_id, function(err, data) {
		if (err) {

			res.render("addUser.ejs", {chatId: chat_id, message: "Something went wrong!"});
			return;

		} else {

			//checking if the user is in the chat and if the recipient is already in the chat
			var i = 0;
			var inChat = false;
			var userAlreadyThere = false;


			var newMembers = [];
			while (i < data.members.SS.length) {
				if (data.members.SS[i] == req.session.user) {
					inChat = true;
				}

				if (data.members.SS[i] == userToAdd) {
					userAlreadyThere = true;
				}

				if (data.members.SS[i] == userToAdd) {
					res.render("addUser.ejs", {chatId: chat_id, message: "That user is already in this chat"});
				}
				newMembers.push(data.members.SS[i]);
				i++;
			}

			if (!inChat) {
				res.render("chatHomepage.ejs", {user: req.session.user, chatId: "", message:"Whoops you weren't supposed to be there!"});
				return;

			} else {
				if (userAlreadyThere) {
					res.send();
					return "";
				} else {


					//checking if recipient is the sender's friend
			db.getFriendsOfUser(user, function(err, friends) {
				if (err) {


					res.render("addUser.ejs", {chatId:chat_id, message: "Something went wrong getting your friends!"});
					return "";

				} else {
					var i = 0;
					while (i < friends.length && friends[i].friend.S != userToAdd) {
						i++;
					}

					if (i == friends.length) {

						res.render("addUser.ejs", {chatId: chat_id, message: "That user is not your friend in PennBook"});
						return;

					} else {

						newMembers.push(userToAdd);

						//if it is a private chat, creating a new chat and adding all the members to it including recipient of request
					if (!data.isGC.BOOL) {
						var newIsRequest = false;

						//creating params for new chat
						var newTime = new Date();
						var newIsGC = true;
						var new_chat_id = "";


						newMembers.sort();

						for (var i = 0; i < newMembers.length; i++) {
							new_chat_id += newMembers[i];
						}

						new_chat_id += newTime.getTime().toString();

						db.addChat(new_chat_id, data.creator.S, newMembers, newIsRequest, newTime, newIsGC, function(err, data) {

							if (err) {


								res.render("addUser.ejs", {chatId: chat_id, message: "Couldn't add add!"});

								return "";

							} else {


								db.addMemberToChat(new_chat_id, newMembers[0], function(err, data0) {
										if (err) {


											res.render("addUser.ejs", {chatId: chat_id, message: "Couldn't add user!"});
											return "";
										} else {

											db.addMemberToChat(new_chat_id, newMembers[1], function(err, data1) {
												if (err) {


													res.render("addUser.ejs", {chatId: chat_id, message: "Couldn't add user!"});
													return "";
												} else {

													db.addMemberToChat(new_chat_id, newMembers[2], function(err, data2) {
														if (err) {

															res.render("addUser.ejs", {chatId: chat_id, message: "Couldn't add user!"});
															return;
														} else {

															res.redirect('/chathome');
															return "";

														}
													});

												}
											});


										}

								});



							}

						});



					} else {
						db.addMemberToChat2(chat_id, newMembers, userToAdd, function(err, data) {
							if (err) {


								res.send(JSON.stringify({worked: false}));
								return "";
							} else {

								res.send(JSON.stringify({worked: true}));
								return "";

							}

						});


					}
					}



				}

			});
				}


			}




		}

	});




}

//removing user from chat once they click leave chat button in the chat window
var userLeave = function(req, res) {
	if (req.session.user == null) {
		res.redirect("/");
		return;
	}

	var chat_id = req.query.id;
	var user = req.session.user;

	//getting chat
	db.getChat(chat_id, function(err, data) {
		if (err) {

			res.render("addUser.ejs", {chatId: chat_id, message: "Something went wrong!"});
			return;

		} else {

			//checking if the user in chat
			var i = 0;
			var inChat = false;

			//checking if last user in chat and if so, deleting chat with the member
			if (data.members.SS[1] == null && user == data.members.SS[0]) {
				db.removeChat(chat_id, data.members.SS[0], function(err, data) {
					if (err) {


						res.render("chatHomepage.ejs", {user: req.session.user, chatId: chat_id, message: "Couldn't leave chat!"});
						return;
					} else {


						res.redirect("/chathome");
						return;
					}
				});
			} else {


				var newMembers = [];
				while (i < data.members.SS.length) {
					if (data.members.SS[i] == req.session.user) {
						inChat = true;
					} else {
						newMembers.push(data.members.SS[i]);
					}
					i++;
				}
				if (!inChat) {
					res.redirect("/chathomepage");
					return;
				}

				//if not the last user then just remove them from the chat
				db.removeMemberFromChat(chat_id, newMembers, user, function(err, data1) {
					if (err) {


						res.render("chat.ejs", {chatId: chat_id, message: "couldn't remove you from the chat, please try again!", user:user});
					} else {

						res.redirect("/chathome");
					}
				});
			}
		}
	});
}

//adding a message to the database
var addMessage = function(req, res) {
    if (req.session.user == null) {
		res.redirect("/");
		return;
	}

	var chat_id = req.body.room;
	var sender = req.body.sender;
	var text = req.body.text;

	db.addMessage(chat_id, sender, text, function(err, data) {
		if (err) {


			res.redirect('/chat?id=' + chat_id);
		} else {

			res.redirect('/chat?id='+chat_id);
		}
	});
}

var loadArticle = function(username){
setInterval(()=>{
    const targetDir = path.dirname(__dirname)+"/NewsReccomender"
    const command = "cd "+targetDir+";mvn exec:java -Dexec.mainClass=\"edu.upenn.cis.nets212.NewsRecomender.livy.NewsGraphUpdater\" -Dexec.args=\"1 "+username+"\"";
    exec(command, (error,stdout,stderr) => {
    if(error){
        console.log('error:'+error.message);
        return;
    }
    if(stderr){
        console.log('error:'+stderr);
        return;
    }
    console.log('stdout'+stdout);


    });},1000*60*50)
};
//Function to call graph updater
var updateGraph = function(username){

    const targetDir = path.dirname(__dirname)+"/NewsReccomender"
    const command = "cd "+targetDir+";mvn exec:java -Dexec.mainClass=\"edu.upenn.cis.nets212.NewsRecomender.livy.NewsGraphUpdater\" -Dexec.args=\"2 "+username+"\"";
    console.log(command);
    exec(command, (error,stdout,stderr) => {
    if(error){
        console.log('error:'+error.message);
        return;
    }
    if(stderr){
        console.log('error:'+stderr);
        return;
    }
    console.log('stdout'+stdout);


    });

}
//Gets and renders the news page
var getNews = function(req, res) {
	var userName = req.session.user;
	if (userName != null)
	{
		let q = db.getSeenArticles(userName);

		if(Array.isArray(q) && q.length==0){
		res.render('newsPage.ejs', {user: userName, articles:[],isPage:1});
		return
		}
		q.then(function(userSeenArticles) {
		               let d = db.getArticlesOrd(userSeenArticles)
	                       if(Array.isArray(d) && d.length==0){
	                          res.render('newsPage.ejs', {user: userName, articles:[],isPage:0});
	                          return
	                       }
		               d.then(function(userArticles){
				res.render('newsPage.ejs', {user: userName, articles:userArticles,isPage:1});
		});
	    });
}
	else
	{
		res.redirect("/");
	}

}
//updates an articles likedArticles field in the table
var likedArticle = function(req, res)
{
	var userName = req.session.user;
	var id = req.body.id;
	if (req.session.user != null)
	{
		db.updateLikedArticle(userName,id, function(err, data) {
			console.log("Article Liked!")
		});

	}
	else
	{
		res.redirect("/");
	}
}
//Searches for matched keywords, sorts them by their weight and by the number of articles the match
var searchArticles = function(req,res){
    var userName = req.session.user;
    if (userName != null)
    {
       console.log(req.body.searchField)
       if(!req.body.searchField.trim().length){
           res.redirect("/news")
       }
	var searchTerms = req.body.searchField;
	let q = db.getSearchedArticles(searchTerms)
	if(Array.isArray(q) && q.length==0){
	res.render('newsPage.ejs', {user: userName, articles:[],isPage:0});
	return
	}
	q.then(function(resultMap){
	articleList = Object.keys(resultMap)
	let d = db.getWeightedArticles(userName,articleList)
	if(Array.isArray(d) && d.length==0){
	res.render('newsPage.ejs', {user: userName, articles:[],isPage:0});
	return
	}
	d.then(function(weightedArticles){
	let e = db.getArticlesOrdWeight(weightedArticles,resultMap)
	if(Array.isArray(e) && e.length==0){
	res.render('newsPage.ejs', {user: userName, articles:[],isPage:0});
	return
	}
	e.then(function(searchedArticles){
        res.render('newsPage.ejs', {user: userName, articles:searchedArticles,isPage:0});
	});
	});
	});
    }
    else
	{
		res.redirect("/");
	}

}

//Don't forget to add any new functions to this class, so app.js can call them. (The name before the colon is the name you'd use for the function in app.js; the name after the colon is the name the method has here, in this file.)

var routes = {
	get_login: getLogin,
	check_login: checkLogins,
	signup: createAccount,
	get_signup: getSignups,
	make_wall: makeWallPage,
	change_Info: changeAccount,
	change_affiliation: changeAffiliation,
	change_password: changePassword,
	change_email: changeEmailAddress,
	change_news: changeNewsInterests,
	adding_post: getAddPost,
	add_post: addpost,
	add_comment: addcomment,
	add_friend: addFriend,
	remove_friend: removeFriend,
	make_home: getHomePage,
	log_out: logout,
	visualizer: visualizer,
	friendvisualization: friendvisualization,
	getFriends: getFriends,
	load_chats: loadChats,
	get_chats: chats,
	add_request: addRequest,
	load_spec_chat: loadSpecChat,
	accept_req: acceptRequest,
	reject_req: rejectRequest,
	add_user_form: addUserForm,
	add_user: addUserToChat,
	user_leave: userLeave,
	add_message: addMessage,
	load_messages: loadMessages,
	get_news: getNews,
	liked_article: likedArticle,
	search_articles: searchArticles
};

module.exports = routes;
