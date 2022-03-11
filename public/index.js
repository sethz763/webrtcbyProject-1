const socket = io()
var fromSocket = "test"  //document.getElementById('userId')
const heading = document.getElementById('heading')
const localVideo = document.getElementById('localVideo')
const remoteVideo = document.getElementById('remoteVideo')
const call= document.getElementById('call')
const stop= document.getElementById('stop')
const mute= document.getElementById('mute')
const unMute= document.getElementById('unMute')
var answer_call_button = document.getElementById("accept_call")
const fullscreen_button = document.getElementById("fullscreen")
const update_username_button = document.getElementById('update_username')
update_username_button.addEventListener('click', updateUsername)
const usernamesMap = new Map()
const toSocket = document.getElementById('toSocket')
let tracks = []
const configuaration = {iceServers:[{urls: 'stun:stun.l.google.com:19302'}]}
let peer = null
let toSocketId, fromSocketId
var offerData = new Object()

let speech = new SpeechSynthesisUtterance()
speech.lang = "en"
speech.volume = 1
let voices = []; // global array

window.speechSynthesis.onvoiceschanged = () => {
  // Get List of Voices
  voices = window.speechSynthesis.getVoices();
  // Initially set the First Voice in the Array.
  speech.voice = voices[0];
}

var text = "SETH'S P2P - "
var error_message = ""
var error_message_display = document.getElementById('error_message')

fullscreen_button.addEventListener("click", openFullscreen)
var camera_selector = document.getElementById('camera_selector')
camera_selector.addEventListener('change', changeVideoInput)

let codecList = RTCRtpSender.getCapabilities("video").codecs;

//reorder list of codecs
const codec_type = ["video/VP9","video/VP9", "video/VP8"]  

function initializePeer(){
        peer = new RTCPeerConnection(configuaration)

        let newCodecList = preferCodec(codecList, codec_type)
        changeVideoCodec(newCodecList)
    
    peer.addEventListener('connectionstatechange', event =>{
        if (peer.connectionState === 'connected') {
            // Peers connected!
            text = "Connected! "
        }
    })
    
}

//Get socket ID
socket.on('connect', () => {
    //fromSocket.innerHTML = socket.id
    fromSocket = socket
    fromSocketId = socket.id
})

function updateUsername(){
    username = username_entry.value
    socket.emit('username', {'socket':socket.id, 'username':username})
}

//get online users on loading
updateUsername()


//reorganize codec priority
function changeVideoCodec(newCodecList) {
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

    console.log("devices" + cameras)
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
        tracks = stream.getTracks()
        return stream

    }catch(error){
        console.log(error)
    }    
}

function openFullscreen() {
    if (remoteVideo.requestFullscreen) {
      remoteVideo.requestFullscreen();
    } else if (remoteVideo.webkitRequestFullscreen) { /* Safari */
      remoteVideo.webkitRequestFullscreen();
    } else if (remoteVideo.msRequestFullscreen) { /* IE11 */
      remoteVideo.msRequestFullscreen();
    }
}

function exitFullscreen(){
    if (document.fullscreenElement && document.fullscreenElement.nodeName == 'VIDEO') {
        if(document.exitFullscreen)
            document.exitFullscreen();
        else if (document.webkitExitFullscreen)
            document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen)
            document.mozCancelFullScreen();
        else if (document.msExitFullscreen)
            document.msExitFullscreen();
    }
}    

function playVideo(){
    localVideo.play()
    //remoteVideo.play()
    setTimeOut(()=>{
        remoteVideo.play();
     });
}

async function changeVideoInput(){
    try{
        tracks.forEach( track => track.stop())

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

//username to socket
function usernameToSocket(username){
    return usernamesMap.get(username)
}

//returns username from socket input
function socketToUsername(socket){
    for(i=0; i<usernamesMap.size; i++){
        if(usernamesMap.values(i) == socket){
            console.log("call from" + usernamesMap.key(i))
            return usernamesMap.key(i)
        }
    }
}

//returns key from value on given map pair
Map.prototype.getKey = function(targetValue){
    let iterator = this[Symbol.iterator]()
    for (const [key, value] of iterator) {
      if(value === targetValue)
        return key;
    }
  }
    
//create offer
async function createOffer() {
    try {
        initializePeer()
        let stream = await openMediaDevices()
        stream.getTracks().forEach(track => peer.addTrack(track))
        unMuteTracks()

        let offer = await peer.createOffer()
        peer.setLocalDescription(new RTCSessionDescription(offer))

        //ice candidate
        peer.addEventListener('icecandidate', e => {
            if (e.candidate) {
                console.log(e.candidate)
                socket.emit('callerCandidate', { 'candidate': e.candidate, 'fromSocketId': fromSocketId, 'toSocketId': toSocketId })
            }
        })
        //send offer to server
        toSocketId = usernameToSocket(user_to_call.value)
        socket.emit('offer', { 'offer': offer, 'fromSocketId': fromSocketId, 'toSocketId': toSocketId })
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
        stop.addEventListener('click', stopButtonHandler)

    }catch(error){
        console.log(error)
    }
}

remoteVideo.oncanplay = function(){
    fullscreen_button.hidden = false;
    playVideo()
}

function acceptOffer(socket){
    //initializePeer()
    answer_call_button.hidden = true
    answer_call_button.removeEventListener('click', acceptOffer)
    createAnswer(socket)
    console.log("Socket" + socket)
}

//receive offer
socket.on('offer', data=>{
    answer_call_button.hidden=false
    answer_call_button.innerHTML = "YOU HAVE A CALL FROM " + usernamesMap.getKey(data.fromSocketId)
    speech.text = ("YOU HAVE AN INCOMING CALL FROM" + usernamesMap.getKey(data.fromSocketId))
    window.speechSynthesis.speak(speech)
    initializePeer()
    peer.setRemoteDescription(data.offer)

    let stream = new MediaStream()
    
    peer.ontrack = e => {
        stream.addTrack(e.track)
        remoteVideo.srcObject = stream
        console.log(e)
    }
    
    stop.addEventListener('click', stopButtonHandler)
    toSocketId=data.fromSocketId
    answer_call_button.addEventListener("click", (e)=>acceptOffer(data.fromSocketId))
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
    stop.addEventListener('click', stopButtonHandler)
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

//stop button handler
const stopButtonHandler = () =>{
    socket.emit('stop', {'toSocketId': toSocketId})
    fullscreen_button.hidden=true
    stopTracks()
}

//stop tracks
const stopTracks = () => { 
    tracks.forEach( track => track.enabled = false);
    tracks.forEach( track => track.stop());
    exitFullscreen();
    peer.close();
    fullscreen_button.hidden=true;
    answer_call_button.hidden=true;
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
    error_message="Username Already Used: " + username
    error_message_display.innerHTML=error_message
})

socket.on('stop', data =>{
    stopTracks()
    exitFullscreen()
})

//handle user selection
function clicks() {
    //console.log(this.innerHTML)
    toSocket.value = this.innerHTML
  }

//update list of users that are online
socket.on('users_available', data =>{
    
    document.getElementById('users').innerHTML = "<h3 id='heading'>Online Users:</h3>";
    let users = data.usernames
    let sockets = data.sockets
    const div = document.getElementById('users')
    for(i=0;i < sockets.length; i++){
        usernamesMap.set(users[i], sockets[i])
        
        //create list of clickable usernames
        var s = document.createElement('DIV');
        s.className = 'clickable';
        s.onclick = clicks;
            
        s.textContent=users[i];
        s.style.fontSize="25px"
        s.style.backgroundColor = 'cadetblue';
        s.style.paddingInline = '5px'
        if(sockets[i]!=fromSocketId){
            s.style.color="blue"
            s.style.fontWeight = "bold"
            s.style.backgroundColor = 'cadetblue';
            s.style.paddingInline = '5px'
        }
        else{
            error_message="LOGGED IN "
            error_message_display.innerHTML=error_message
        }
        
        div.appendChild(s)
        
        }
    }
)

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