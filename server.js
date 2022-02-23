const express = require("express")
const http = require('http')
const https = require("https")
const fs = require('fs')
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


app.use(express.static('public'))

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

    //add username and socket
    socket.on('username', data=> {
        console.log("attempting to add user")
        if(online_users.size < 1){
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







