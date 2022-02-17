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
console.dir ( ip.address() );

const io = socketio(httpsServer)
const clients = []



function updateSocketList(mySocket){
    socket_tracker.push(mySocket)
    
    io.emit('users_available', socket_tracker)
}

function removeFromUserList(deadSocket){
    var i=0
    socket_tracker.forEach(socket => {
        if(deadSocket == socket){
            socket_tracker.splice(i,1)
        }
        i++
    })
}



io.on('connection', (socket) =>{
    console.log('user connected ', socket.id)

    updateSocketList(socket.id)

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

})







