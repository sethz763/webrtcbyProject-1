const express = require("express")
const http = require('http')
const https = require("https")
const fs = require('fs')
const mysql = require('mysql')
const session = require('express-session')
const path = require('path')
var privateKey = fs.readFileSync('domain.key')
var certificate = fs.readFileSync('domain.crt')
const credentials = {key: privateKey, cert: certificate}

const app = express()
//const httpServer = http.createServer(app)
const httpsPort = 4200
const httpPort = 4201
const socketio = require('socket.io')

const socket_tracker = []
const usernames = []

const online_users = new Map()

const connection = mysql.createConnection({
    host    : 'localhost',
    user    : 'seth',
    password:  'SwiftSwaft#0',
    database: 'nodelogin'
})

var result = connection.query('SELECT * FROM accounts', function (err, result, fields) {
    if (err) throw err;
    console.log(result);
  });



app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

app.use("/public", express.static('public'));
app.use("/login", express.static('login'));
app.use("/css", express.static('css'));

app.get('/',  function(req, res){
    res.render('index');
});

app.get('', function(req, res){
    res.render('index');
});

app.get('/login', function(req,res){
    res.render('login')
});

//login
app.post('/auth', function(request, response) {
	// Capture the input fields
	let username = request.body.username;
	let password = request.body.password;
	// Ensure the input fields exists and are not empty
	if (username && password) {
		// Execute SQL query that'll select the account from the database based on the specified username and password
		connection.query('SELECT * FROM accounts WHERE username = ? AND password = ?', [username, password], function(error, results, fields) {
			// If there is an issue with the query, output the error
			if (error) throw error;
			// If the account exists
			if (results.length > 0) {
				// Authenticate the user
				request.session.loggedin = true;
				request.session.username = username;
				// Redirect to home page
				response.redirect('/home');
			} else {
				response.send('Incorrect Username and/or Password!');
			}			
			response.end();
		});
	} else {
		response.send('Please enter Username and Password!');
		response.end();
	}
});

app.get('/home', function(request, response) {
	// If the user is loggedin
	if (request.session.loggedin) {
		// Output username
		response.send('Welcome back, ' + request.session.username + '!');
	} else {
		// Not logged in
		response.send('Please login to view this page!');
	}
	response.end();
});

const httpServer = http.createServer(app)
const httpsServer = https.createServer(credentials, app)

httpServer.listen(httpPort, ()=>{
    console.log('http server starting on port :', httpPort)
})

httpsServer.listen(httpsPort, () =>{
    console.log("https server starting on port : ", httpsPort)
})

var ip = require("ip");
const { Console } = require("console")
console.dir ( ip.address() );

const io = socketio(httpsServer)
const clients = []

function removeFromUserList(deadSocket){
    var i=0
    socket_tracker.forEach(socket => {
        if(deadSocket == socket){
            socket_tracker.splice(i,1)
            usernames.splice(i,1)
        }
        i++
        online_users.delete(deadSocket)
    })  
    io.emit('users_available', {'sockets':socket_tracker, 'usernames':usernames})
}



io.on('connection', (socket) =>{
    console.log('user connected ', socket.id)

    //test to see if I can see settings
    socket.on('settings', settings =>{
        console.log("settings: " +settings)
    })

    socket.on('disconnect', function(){
        console.log("user disconnected : " + socket.id)
        removeFromUserList(socket.id)
    })

    //receive/send offer
    socket.on('offer', data => {
        io.to(data.toSocketId).emit('offer', data)
    })

    //receive/send answer
    socket.on('answer', data =>{
        io.to(data.destination).emit('answer', data)
    })

    //caller ice candidates
    socket.on('callerCandidate', data => {
        io.to(data.toSocketId).emit('callerCandidate', data.candidate)
    })

    //callee candidate
    socket.on('calleeCandidate', data => {
        io.to(data.destination).emit('calleeCandidate', data.candidate)
    })

    socket.on('stop', data =>{
        io.to(data.toSocketId).emit('stop', data)
    })

    //add username and socket
    socket.on('username', data=> {
        console.log("attempting to add user")
        if(online_users.size < 1 && data.username != ''){
            online_users.set(data.socket, data.username)
            console.log("added first user")
        }
        else{
            if(online_users.has(data.socket)){
                console.log("deleting and replacing user")
                online_users.delete(data.socket)
                online_users.set(data.socket, data.username)
            }
            else{
                console.log("entered else to add user")
                online_users.forEach((username,socket)=>{
                    console.log("entered for each loop to add user")
                    if(username == data.username){
                        io.to(data.socket).emit('error_username_taken', data.username)
                        console.log("didn't add user")
                    }
                    else{
                        online_users.set(data.socket, data.username)
                        console.log("added user")
                        if(socket_tracker.length < online_users.size){
                            socket_tracker.push(data.socket)
                            usernames.push(data.username)
                        }   
                    }
                })
            }
        }
        
        online_users.forEach((username,socket)=>{
            console.log(username)
            console.log(socket)
        })
            
        i=0
        online_users.forEach((username, socket) => {
            socket_tracker[i]=socket
            usernames[i]=username
            i++
        })

        io.emit('users_available', {'sockets':socket_tracker, 'usernames':usernames}) 
    })



})







