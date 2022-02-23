const socket = io()
const fromSocket = document.getElementById('userId')
const heading = document.getElementById('heading')
const localVideo = document.getElementById('localVideo')
const remoteVideo = document.getElementById('remoteVideo')
const call= document.getElementById('call')
const stop= document.getElementById('stop')
const mute= document.getElementById('mute')
const unMute= document.getElementById('unMute')
var answer_call_button = document.getElementById("accept_call")
const update_username_button = document.getElementById('update_username')
update_username_button.addEventListener('click', updateUsername)
const toSocket = document.getElementById('toSocket')
let tracks = []
const configuaration = {iceServers:[{urls: 'stun:stun.l.google.com:19302'}]}
let peer = new RTCPeerConnection(configuaration)
let toSocketId, fromSocketId

const usernamesMap = new Map()

var offerData

var camera_selector = document.getElementById('camera_selector')

let codecList = RTCRtpSender.getCapabilities("video").codecs;
console.log(codecList)

//reorder list of codecs
const codec_type = ["video/VP8","video/VP9", "video/VP9"]  
const newCodecList = preferCodec(codecList, codec_type)
changeVideoCodec(codec_type)

//Get socket ID
socket.on('connect', () => {
    fromSocket.innerHTML = socket.id
    fromSocketId = socket.id
})

function updateUsername(){
    username = username_entry.value
    socket.emit('username', {'socket':socket.id, 'username':username})
}


//reorganize codec priority
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

//set bitrate
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
 
//get list of all media devices and update selector
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

        tracks = stream.getTracks()

        return stream
    }catch(error){
        console.log(error)
    }    
}

function openFullscreen() {
    localVideo.hidden = true
    if (remoteVideo.requestFullscreen) {
      remoteVideo.requestFullscreen();
    } else if (remoteVideo.webkitRequestFullscreen) { /* Safari */
      remoteVideo.webkitRequestFullscreen();
    } else if (remoteVideo.msRequestFullscreen) { /* IE11 */
      remoteVideo.msRequestFullscreen();
    }
}

function playVideo(){
    localVideo.play()
    remoteVideo.play()
}

async function changeVideoInput(){
    try{
        stopTracks()

        let stream = await navigator.mediaDevices.getUserMedia(
            {video:{ deviceId: camera_selector.value,
                    width:{ideal: 1280},
                    height: {ideal:720}},
            audio:true})
    
        tracks = stream.getTracks()
        const senders = peer.getSenders()
        senders.forEach(sender=>tracks.forEach(track=>sender.replaceTrack(track)))
    
        localVideo.srcObject = stream

    }
    catch{
        console.log("problem with camera selector")
    }
    
}

function usernameToSocket(username){
    return usernamesMap.get(username)
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
        toSocketId = usernameToSocket(toSocket.value)
        console.log("THIS IS THE MAPPED ID" + toSocketId)
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

        mute.addEventListener('click', muteTracks)
        stop.addEventListener('click', stopTracks)

    }catch(error){
        console.log(error)
    }
}

remoteVideo.oncanplay = function(){
    answer_call_button.innerHTML = "GO FULL SCREEN"
    answer_call_button.hidden = false;
    answer_call_button.addEventListener("click", openFullscreen)
    playVideo()
}

function acceptOffer(){
    answer_call_button.hidden = true
    answer_call_button.removeEventListener('click', acceptOffer)
    

    let stream = new MediaStream()
    createAnswer(offerData.fromSocketId)
    peer.ontrack = e => {
        stream.addTrack(e.track)
        remoteVideo.srcObject = stream
        console.log(e)
    }
}

//receive offer
socket.on('offer', data=>{
    answer_call_button.hidden=false
    answer_call_button.innerHTML = "YOU HAVE A CALL FROM" + data.fromSocketId
    peer.setRemoteDescription(data.offer)
    offerData = data
    answer_call_button.addEventListener("click", acceptOffer)
})

//receive answer
socket.on('answer', data => {
    peer.setRemoteDescription(data.answer)
    let stream = new MediaStream()
    peer.ontrack = e => {
        stream.addTrack(e.track)
        remoteVideo.srcObject = stream
        openFullscreen()
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

socket.on('error_username_taken', data=>{
    text="Username Already Used"
})

//handle user selection
function clicks() {
    console.log(this.innerHTML)
    toSocket.value = this.innerHTML
  }

//update list of users that are online
socket.on('users_available', data =>{
    
    document.getElementById('users').innerHTML = "<h3 id='heading'>online users</h3>";
    let users = data.usernames
    let sockets = data.sockets
    const div = document.getElementById('users')
    for(i=0;i < sockets.length; i++){
        if(!usernamesMap.has(users[i])){
            usernamesMap.set(users[i], sockets[i])
        }
        else{
            usernamesMap.delete(users[i])
            usernamesMap.set(users[i], sockets[i])
        }
        
        if(sockets[i] != socket.id){
            
            //var newDiv = document.createElement('')
            var s = document.createElement('DIV');
            s.className = 'clickable';
            s.onclick = clicks;
                
            s.textContent=users[i];
            div.appendChild(s)
            
            //"<button type='button' class='btn btn-link' id='"+users[i]+"'>"+users[i]+"</button> "

        /*    
            "<label class='mb-2 mr-sm-2'>Other User:  </label>"+
            "<label class='mb-2 mr-sm-2'>"+  + " : " + "</label>"+
            "<label class='mb-2 mr-sm-2'> SOCKET ID: "+ sockets[i] + "</label>"+ */
            //"</form>"

           // var btn =document.getElementById(users[i])
           // btn.addEventListener('click', function(){console.log("button pressed" + btn.id)})

            }
        }
    }
)

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

    
