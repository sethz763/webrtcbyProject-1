const express = require("express")
const cors = require('cors')
const http = require('http')
const https = require("https")
const fs = require('fs')
var privateKey = fs.readFileSync('domain.key')
var certificate = fs.readFileSync('domain.crt')
const credentials = {key: privateKey, cert: certificate}

const app = express()
//const httpServer = http.createServer(app)
const port = process.env.PORT || 4200
const socketio = require('socket.io')



app.use(express.static('public'))
app.use(cors())

const httpServer = http.createServer(app)
const httpsServer = https.createServer(credentials, app)

httpServer.listen(4201, ()=>{
    console.log('http server starting on port :', 4201)
})

httpsServer.listen(port, () =>{
    console.log("https server starting on port : ", port)
})

var ip = require("ip");
console.dir ( ip.address() );

const io = socketio(httpsServer)

io.on('connection', (socket) =>{
    console.log('user connected ', socket.id)

    //receive/send offer
    socket.on('offer', data => {
        io.to(data.toSocketId).emit('offer', data)
        //io.emit('offer', data)
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







