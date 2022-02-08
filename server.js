const express = require("express")
const http = require("http")
const app = express()
const httpServer = http.createServer(app)
const port = process.env.PORT || 4200

const socketio = require('socket.io')


app.use(express.static('public'))

httpServer.listen(port, () =>{
    console.log("server starting on port : ", port)
})

const io = socketio(httpServer)
io.on('connection', (socket) =>{
    console.log('user connected ', socket.id)
})
