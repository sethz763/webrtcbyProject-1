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
const callee_username_entry = document.getElementById('toSocket')
let tracks = []
const configuaration = {iceServers:[{urls: 'stun:stun.l.google.com:19302'}]}
//let peer = null
const peers = [];
let fromSocketId
var offerData = new Object()
var username ="";
const usernamesMap = new Map();

let speech = new SpeechSynthesisUtterance()
speech.lang = "en"
speech.volume = 1
let voices = []; // global array

var call_active = false;

window.speechSynthesis.onvoiceschanged = () => {
  // Get List of Voices
  voices = window.speechSynthesis.getVoices();
  // Initially set the First Voice in the Array.
  speech.voice = voices[0];
}

var text = "SETH'S WEBRTC: "
var error_message = ""
var error_message_display = document.getElementById('error_message')

fullscreen_button.addEventListener("click", openFullscreen)
var camera_selector = document.getElementById('camera_selector')
camera_selector.addEventListener('change', changeVideoInput)

let codecList = RTCRtpSender.getCapabilities("video").codecs;

//reorder list of codecs
const codec_type = ["AV1","video/VP9","video/VP9", "video/VP8"]  

function initializePeer(peerUsername, peerSocket){
        //trying to create new peer to add to Map
        let newPeer = new RTCPeerConnection(configuaration);
        peers.push({'username':peerUsername, 'socket':peerSocket, 'peer':newPeer});

        let newCodecList = preferCodec(codecList, codec_type);
        
        let peer_index = peers.findIndex( current_peer => {
            if(current_peer.username === peerUsername){
                return true;
            }
        })

        changeVideoCodec(newCodecList, peers[peer_index].peer);
        peers[peer_index].peer.addEventListener('connectionstatechange', event =>{
            if (peers[peer_index].peer.connectionState === 'connected') {
                console.log('peer connected to: ' + peers[peer_index].username + ' socket: ' + peers[peer_index].socket);
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
function changeVideoCodec(newCodecList, current_peer) {
    const transceivers = current_peer.getTransceivers();
  
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
    remoteVideo.play()
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
async function createOffer(callee_username) {
    if(callee_username == null){
        callee_username = callee_username_entry.value
    }

    try {
        let callee_socket = usernameToSocket(callee_username);
        initializePeer(callee_username, callee_socket);
        
        let group_call_usernames = [];

       
        let peer_index = peers.length-1;
        let stream = await openMediaDevices()
        stream.getTracks().forEach(track => peers[peer_index].peer.addTrack(track))
        unMuteTracks()
        let offer = await peers[peer_index].peer.createOffer()
        peers[peer_index].peer.setLocalDescription(new RTCSessionDescription(offer))

        
        //ice candidate
        peers[peer_index].peer.addEventListener('icecandidate', e => {
            if (e.candidate) {
                console.log(e.candidate)
                socket.emit('callerCandidate', { 'candidate': e.candidate, 'fromSocketId': fromSocketId, 'username':username, 'socket': callee_socket})
            }
        })

        //send offer to server
        if(peers.length >= 1){  // group call if there is already a peer
             //create list of current usernames in group call to pass to new callees
            peers.forEach( peer =>{
                group_call_usernames.push(peer.username);
            })
            socket.emit('offer', { 'offer': offer, 'fromSocketId': fromSocketId, 'toSocketId': callee_socket , 'group_call_usernames': group_call_usernames });
            console.log('making group call to');
            group_call_usernames.forEach( user => {
                console.log(user + ', ');
            })
        }
        else{  //not in group call
            socket.emit('offer', { 'offer': offer, 'fromSocketId': fromSocketId, 'toSocketId': callee_socket });
        }
        
    } catch (error) {
        console.log(error)
    }
}

//create Answer
const createAnswer = async(peer_socket) => {
    try{
        let peer_index = peers.findIndex( peer => {
            if(peer.socket === peer_socket){
                return true;
            }
        })

        let stream = await openMediaDevices()
        stream.getTracks().forEach(track => peers[peer_index].peer.addTrack(track));
       
        let answer = await peers[peer_index].peer.createAnswer();
        peers[peer_index].peer.setLocalDescription(new RTCSessionDescription(answer));

        //ice candidate
        peers[peer_index].peer.addEventListener('icecandidate', e => {
            if(e.candidate){
                console.log(e.candidate)
                socket.emit('calleeCandidate', {'candidate':e.candidate, 'destination':peer_socket, 'username':username, 'socket':fromSocketId});
            }
        })
        
        //send answer to server
        socket.emit('answer', {'answer': answer, 'destination':peer_socket, 'username':username, 'fromSocket': fromSocketId});

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

function acceptOffer(peer_socket, group_call_usernames){
    //initializePeer()
    answer_call_button.hidden = true;
    answer_call_button.removeEventListener('click', acceptOffer);
    if(group_call_usernames){
        group_call_usernames.forEach( username => {
            let current_socket = usernameToSocket(username);
            createAnswer(current_socket);
            console.log('answer created for '+username + ' : ' + current_socket);
        })
    }else{
        createAnswer(peer_socket);
    }

    console.log("Socket" + peer_socket);
}

//receive offer
socket.on('offer', data=>{

    if(peers.length < 1){
        answer_call_button.hidden=false
        peerUsername = usernamesMap.getKey(data.fromSocketId);
        answer_call_button.innerHTML = "YOU HAVE A CALL FROM " + peerUsername;
        speech.text = ("YOU HAVE AN INCOMING CALL FROM" + peerUsername);
        window.speechSynthesis.speak(speech)
        initializePeer(peerUsername, data.fromSocketId)

        let peer_index = peers.length - 1;
        peers[peer_index].peer.setRemoteDescription(data.offer)

        let stream = new MediaStream()
    
        peers[peer_index].peer.ontrack = e => {
            stream.addTrack(e.track)
            remoteVideo.srcObject = stream
            console.log(e)
        }

        addVideoToPage(stream, peer_index);

        answer_call_button.addEventListener("click", function(){acceptOffer(data.fromSocketId)});
    }
    // already in call -  handle group call offers
    else{
        peerUsername = usernamesMap.getKey(data.fromSocketId);
        initializePeer(peerUsername, data.fromSocketId);

        let peer_index = peers.length - 1;
        peers[peer_index].peer.setRemoteDescription(data.offer)

        let stream = new MediaStream()
    
        peers[peer_index].peer.ontrack = e => {
            stream.addTrack(e.track)
            console.log(e)
        }

        addVideoToPage(stream, peer_index);
        acceptOffer(data.fromSocketId);
    }
    

    //send offers to  other callers after first caller answer sent
    if(data.group_call_usernames){
        if(data.group_call_usernames.length > 1){
            data.group_call_usernames.forEach( new_user=>{
                createOffer(new_user);
            })    
        }
    }
    
    stop.addEventListener('click', stopButtonHandler)
    callee_username=data.fromSocketId    
})

//receive answer
socket.on('answer', data => {

    let peer_index = peers.findIndex( peer => {
        if(peer.socket === data.fromSocket){
            return true;
        }
    })

    // peer_index will be -1 if no peer connection exists with the new socket/user - new peer needs to be initialized
    if(peer_index > 0){
        initializePeer(data.username, data.fromSocket);
    }

    peers[peer_index].peer.setRemoteDescription(data.answer)
    let stream = new MediaStream()
    peers[peer_index].peer.ontrack = e => {
        stream.addTrack(e.track)
        remoteVideo.srcObject = stream;
    }
    addVideoToPage(stream, peer_index);

})

function addVideoToPage(stream, peerIndex){
    let username = peers[peerIndex].username;
    var video_grid_div = document.getElementById('video-grid');
    var video_div = document.createElement('DIV');
    video_div.classList.add('grid-item');
    var video = document.createElement("VIDEO");
    video.setAttribute('id', 'video' + username);

    video_div.innerHTML = "<p>VIDEO FROM '"+ username +"'</p>";
    video_div.appendChild(video);
    video_grid_div.appendChild(video_div);
    
    video.srcObject = stream;
    video.autoplay = true;
    video.controls = false;
    video.muted = false;
    video.setAttribute('height', 'auto');
    video.setAttribute('width', '100%');

}

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
    peers.forEach( peer => {
        socket.emit('stop', {'username': peer.username, 'socket': peer.socket});
    })
    
    fullscreen_button.hidden=true;
    stopTracks();
}

//stop tracks
const stopTracks = () => { 
    tracks.forEach( track => track.enabled = false);
    tracks.forEach( track => track.stop());
    exitFullscreen();
    fullscreen_button.hidden=true;
    answer_call_button.hidden=true;
}

//caller candidate
socket.on('callerCandidate', data => {

    let peer_index = peers.findIndex( peer => {
        if(peer.socket === data.socket){
            return true;
        }
    })

    peers[peer_index].peer.addIceCandidate(data.candidate)
    console.log(data)
})

//callee candidate
socket.on('calleeCandidate', data =>{
    let peer_index = peers.findIndex( peer => {
        if(peer.socket === data.socket){
            return true;
        }
    })
    peers[peer_index].peer.addIceCandidate(data.candidate).catch(e => (console.log(e)))
    console.log(data)
})

socket.on('error_username_taken', data=>{
    error_message="Username Already Used: " + username
    error_message_display.innerHTML=error_message
})

socket.on('stop', data =>{
    let peer_index = peers.findIndex( peer => {
        if(peer.username === data.username){
            return true;
        }
    });
    peers[peer_index].close();

    //find and remove video player
    let vid_id = 'video' + peers[peer_index].username;
    vid = document.getElementById(vid_id);
    vid.remove();
    
    //do this only if all other videos are closed
    if(false){
        stopTracks()
        exitFullscreen()
    }
   
})

//handle user selection
function clicks() {
    console.log(this.innerHTML)
    callee_username_entry.value = this.innerHTML
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