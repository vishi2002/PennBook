/* Some initialization boilerplate. Also, we include the code from
   routes/routes.js, so we can have access to the routes. Note that
   we get back the object that is defined at the end of routes.js,
   and that we use the fields of that object (e.g., routes.get_main)
   to access the routes. */

var express = require('express');

var routes = require('./routes/routes.js');
var app = express();

var http = require("http").Server(app);
var io = require('socket.io')(http);

var bodyParser = require('body-parser')
var morgan = require('morgan')
var cookieParser = require('cookie-parser')
var session = require('express-session')
var serveStatic = require('serve-static')
var path = require('path')

const {exec} = require("child_process")

function updateGraph(){
    const targetDir = __dirname+"/NewsReccomender"
    const command = "cd "+targetDir+";mvn exec:java -Dexec.mainClass=\"edu.upenn.cis.nets212.NewsRecomender.livy.NewsGraphUpdater\" -Dexec.args=\"0\" ";

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

setInterval(()=>{updateGraph()},1000*60*60);

app.use(express.urlencoded());

io.on("connection", function (socket) {
	//socket.on("join server", obj => 
		//socket.emit("socket.id", {socketId: socket.id});
	//});
	
	socket.on("chat message", obj => {
		console.log(obj);
		io.to(obj.room).emit("chat message", obj);
	});
	socket.on("join chat", obj => {
		console.log(obj.sender + " joined");
		socket.join(obj.room);
	});
	socket.on("leave chat", obj => {
		console.log(obj.sender + "left");
		socket.leave(obj.room);
	});
	
	//socket.on("chat request", obj => {
	//	io.to(obj.recipient).emit("chat request", obj);
	//});
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan('combined'));
app.use(cookieParser());
app.use(serveStatic(path.join(__dirname, 'public')))

//code used for the express-session features
var session = require('express-session');
app.use(session({secret: 'search'}));

/* Below we install the routes. The first argument is the URL that we
   are routing, and the second argument is the handler function that
   should be invoked when someone opens that URL. Note the difference
   between app.get and app.post; normal web requests are GETs, but
   POST is often used when submitting web forms ('method="post"'). */


//The 7 routes, in order of implementation on the handout 
app.get('/', routes.get_login);
app.post('/checklogin', routes.check_login);
app.get('/signup', routes.get_signup);
app.post('/createaccount', routes.signup);
app.get('/wallPage/:username', routes.make_wall);
app.get('/changeInformation', routes.change_Info);
app.post('/changeNewsInterest', routes.change_news);
app.post('/changeAffiliation', routes.change_affiliation);
app.post('/changeEmailAddress', routes.change_email);
app.post('/changePassword', routes.change_password);
app.get('/addingpost/:username', routes.adding_post);
app.post('/addpost/:username', routes.add_post);
app.post('/addcomment/:username/:page', routes.add_comment);
app.post('/addFriend/:username', routes.add_friend);
app.post('/removeFriend/:username', routes.remove_friend);
app.get('/homepage', routes.make_home);
app.post('/logout', routes.log_out);

app.get('/visualizer', routes.visualizer);
app.get('/friendvisualization', routes.friendvisualization);
app.get('/getFriends/:user', routes.getFriends);

app.get('/loadchats', routes.load_chats);
app.get('/chathome', routes.get_chats);
app.post('/addrequest', routes.add_request);
app.get('/chat', routes.load_spec_chat);
app.post('/acceptreq', routes.accept_req);
app.post('/rejectreq', routes.reject_req);
app.get('/adduserform', routes.add_user_form);
app.post('/adduser', routes.add_user);
app.post('/removeuser', routes.user_leave);
app.post('/addmessage', routes.add_message);
app.get('/loadmessages', routes.load_messages);

app.get('/news',routes.get_news);
app.post('/searchArticles',routes.search_articles);
app.post('/likedArticle',routes.liked_article);

/* Run the server */

http.listen(8080);
console.log('HTTP server started on port 8080');
