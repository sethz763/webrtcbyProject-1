const socket = io()
const fromSocket = document.getElementById('userId')
const heading = document.getElementById('heading')
const localVideo = document.getElementById('localVideo')
const remoteVideo = document.getElementById('remoteVideo')
const call= document.getElementById('call')
const stop= document.getElementById('stop')
const mute= document.getElementById('mute')
const unMute= document.getElementById('unMute')
const toSocket = document.getElementById('toSocket')
let tracks = []
const configuaration = {iceServers:[{urls: 'stun:stun.l.google.com:19302'}]}
let peer = new RTCPeerConnection(configuaration)
let toSocketId, fromSocketId

//Get socket ID
socket.on('connect', () => {
    fromSocket.innerHTML = socket.id
    fromSocketId = socket.id
})

//update list of users that are online
socket.on('users_available', users =>{
    document.getElementById('users').innerHTML = "<h3 id='heading'>online users</h3>";
    users.forEach(user=>{
        document.getElementById('users').innerHTML += "" +
        "<form class='form-inline'>" +
        "<label class='mb-2 mr-sm-2'>Other User Socket is:  </label>"+
        "<label class='mb-2 mr-sm-2'>"+ user + "</label>"+
        "</form>"
    })
})


//get local media
const openMediaDevices = async() =>{
    try{
        let stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true})
        stream.getTracks().forEach(track => {
            track.applyConstraints({height:720, width:1280})
            peer.addTrack(track)
        } ) 
        localVideo.srcObject = stream       
        tracks = stream.getTracks()
        return stream
    }catch(error){
        console.log(error)
    }
}




//create offer
const createOffer = async() => {
    try {
        let stream = await openMediaDevices()
        stream.getTracks().forEach(track => peer.addTrack(track)) 
        let offer = await peer.createOffer()
        peer.setLocalDescription(new RTCSessionDescription(offer))
        
        //ice candidate
        peer.addEventListener('icecandidate', e => {
            if(e.candidate){
                console.log(e.candidate)
                socket.emit('callerCandidate', {'candidate':e.candidate, 'fromSocketId':fromSocketId, 'toSocketId':toSocketId })
            }
        })
        //send offer to server
        toSocketId = toSocket.value
        socket.emit('offer', {'offer':offer, 'fromSocketId':fromSocketId, 'toSocketId':toSocketId })
    } catch (error) {
        console.log(error)
    }
}

//create Answer
const createAnswer = async(destination) => {
    try{
        let stream = await openMediaDevices()
        stream.getTracks().forEach(track => peer.addTrack(track)) 
        let answer = await peer.createAnswer()
        peer.setLocalDescription(new RTCSessionDescription(answer))

        //ice candidate
        peer.addEventListener('icecandidate', e => {
            if(e.candidate){
                console.log(e.candidate)
                socket.emit('calleeCandidate', {'candidate':e.candidate, 'destination':destination})
            }
        })
        
        //send answer to server
        socket.emit('answer', {'answer': answer, 'destination':destination})

    }catch(error){
        console.log(error)
    }
}



//receive offer
socket.on('offer', data=>{
    peer.setRemoteDescription(data.offer)
    let stream = new MediaStream()
    createAnswer(data.fromSocketId)
    peer.ontrack = e => {
        stream.addTrack(e.track)
        remoteVideo.srcObject = stream
        console.log(e)
    }
})

//receive answer
socket.on('answer', data => {
    peer.setRemoteDescription(data.answer)
    let stream = new MediaStream()
    peer.ontrack = e => {
        stream.addTrack(e.track)
        remoteVideo.srcObject = stream
        console.log(e)
    }
})

//start a call
call.addEventListener('click', () => {
    createOffer()
    mute.addEventListener('click', muteTracks)
    stop.addEventListener('click', stopTracks)
})

//mute tracks
const muteTracks = ()  => {
    tracks.forEach( track => track.enabled = false)
    unMute.addEventListener('click', unMuteTracks)
}

//
const unMuteTracks = ()  => {
    tracks.forEach( track => track.enabled = true)
}

//stop tracks
const stopTracks = () => {
    tracks.forEach( track => track.stop() )
}

//caller candidate
socket.on('callerCandidate', data => {
    peer.addIceCandidate(data)
    console.log(data)
})

//callee candidate
socket.on('calleeCandidate', data =>{
    peer.addIceCandidate(data)
    console.log(data)
})


const text = "WEBRTC TRAINING - "

function addZero(i) {
    if (i < 10) {i = "0" + i}
    return i;
  }

function updateTime(){
    let date_time = new Date()
    let hour = date_time.getHours().toString()
    let minute = addZero(date_time.getMinutes().toString())
    let second = addZero(date_time.getSeconds().toString())
    heading.textContent = text + hour + ":" + minute + ":" + second
}

setInterval(updateTime, 500);

    
