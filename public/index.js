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

var camera_selector = document.getElementById('camera_selector')

let codecList = RTCRtpSender.getCapabilities("video").codecs;
console.log(codecList)

const codec_type = ["video/VP9","video/VP8"]  
const newCodecList = preferCodec(codecList, codec_type)
console.log("after modifying codec list")
console.log(newCodecList)

changeVideoCodec(codec_type)

//Get socket ID
socket.on('connect', () => {
    fromSocket.innerHTML = socket.id
    fromSocketId = socket.id
})


//change codec
function changeVideoCodec(mimeType) {
    const transceivers = peer.getTransceivers();
  
    transceivers.forEach(transceiver => {
        transceiver.setCodecPreferences(newCodecList)
        let senders = transceivers[0].getSenders()

        senders.forEach( sender=>{
            setVideoParams(sender, 1000)
        })
  })
}

async function setVideoParams(sender, bitrate) {
    const params = sender.getParameters();

    params.encodings[0].maxBitrate = bitrate;
    await sender.setParameters(params);
  }

//reorder codec preference list
function preferCodec(codecs, mimeType) {
    let otherCodecs = [];
    let sortedCodecs = [];
  
    i = 0
    codecs.forEach(codec => {
      if (codec.mimeType === mimeType[i] && i<mimeType.length) {
        sortedCodecs.push(codec);
      } else {
        otherCodecs.push(codec);
      }
    });
    
    let allSortedCodecs = sortedCodecs.concat(otherCodecs)
    return allSortedCodecs
}
 
//get list of all media devices
async function updateCameraList() {
    var devices = await navigator.mediaDevices.enumerateDevices();
    var cameras = devices.filter(device =>device.kind === 'videoinput')

    camera_selector.innerHTML = ''
     cameras.map(camera =>{
        cameraOption = document.createElement('option')
        cameraOption.label = camera.label
        cameraOption.value = camera.deviceId
        camera_selector.add(cameraOption)
    })     
}

// Get the initial set of cameras connected
updateCameraList();

// Listen for changes to media devices and update the list accordingly
navigator.mediaDevices.addEventListener('devicechange', event => {
    updateCameraList();
});


//get local media
const openMediaDevices = async() =>{
    
        try{
        let stream = await navigator.mediaDevices.getUserMedia(
            {video:{ deviceId: camera_selector.value,
                    width:{ideal: 1280},
                    height: {ideal:720}},
            audio:true})
        
        stream.getTracks().forEach(track => {
            track.applyConstraints({height:720,
                width:1280,
                echoCancellation:true})
                localVideo.srcObject = stream
        } ) 

        camera_selector.addEventListener('change', changeVideoInput)

        return stream
    }catch(error){
        console.log(error)
    }    
}

async function changeVideoInput(){

    try{
        stopTracks()

        let stream = await navigator.mediaDevices.getUserMedia(
            {video:{ deviceId: camera_selector.value,
                    width:{ideal: 1280},
                    height: {ideal:720}},
            audio:true})
    
        const tracks = stream.getTracks()
        const senders = peer.getSenders()
        senders.forEach(sender=>tracks.forEach(track=>sender.replaceTrack(track)))
    
        localVideo.srcObject = stream
        localVideo.play()
    }
    catch{
        console.log("problem with camera selector")
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
    var incoming_call = document.getElementById("accept_call")
    incoming_call.hidden=false
    incoming_call.addEventListener("click", ()=>{

            peer.setRemoteDescription(data.offer)
            let stream = new MediaStream()
            createAnswer(data.fromSocketId)
            peer.ontrack = e => {
                stream.addTrack(e.track)
                remoteVideo.srcObject = stream
                remoteVideo.play()
                localVideo.play()
                console.log(e)
            incoming_call.hidden = true;
        }
    })
})

//receive answer
socket.on('answer', data => {
    peer.setRemoteDescription(data.answer)
    let stream = new MediaStream()
    peer.ontrack = e => {
        stream.addTrack(e.track)
        remoteVideo.srcObject = stream
        if(getConfirmation){
            remoteVideo.play()
        }
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

//update list of users that are online
socket.on('users_available', users =>{
    document.getElementById('users').innerHTML = "<h3 id='heading'>online users</h3>";
    users.forEach(user=>{
        if(user != fromSocket){
            document.getElementById('users').innerHTML += "" +
            "<form class='form-inline'>" +
            "<label class='mb-2 mr-sm-2'>Other User Socket is:  </label>"+
            "<label class='mb-2 mr-sm-2'>"+ user + "</label>"+
            "</form>"
        }
        
    })
})

var text = "Seth's Peer to Peer Test - "
peer.addEventListener('connectionstatechange', event =>{
    if (peer.connectionState === 'connected') {
        // Peers connected!
        text = "Connected! "
    }
})



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

    
