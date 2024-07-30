let peer;
let connections = {};
let call;
let localStream;

const peerIdInput = document.getElementById("peer-id-input");
const generatePeerIdButton = document.getElementById("generate-peer-id");
const peerIdToConnectInput = document.getElementById("peer-id-to-connect");
const connectButton = document.getElementById("connect-button");
const chatContainer = document.getElementById("chat-container");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const audioCallButton = document.getElementById("audio-call-button");
const videoCallButton = document.getElementById("video-call-button");
const endCallButton = document.getElementById("end-call-button");
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");

generatePeerIdButton.addEventListener("click", () => {
  const customConfig = {
    iceServers: [
      { urls: ["stun:fr-turn1.xirsys.com"] },
      {
        username:
          "Wj3dtFyTovJl_655q7_9Y-Uy_DTma3qU6uTZmdAqUvb0TiOcYH295GlvO4exr4KnAAAAAGGYE3dlbmVhc2xhcmk=",
        credential: "8a1494e0-497d-11ec-9fcf-0242ac120004",
        urls: [
          "turn:fr-turn1.xirsys.com:80?transport=udp",
          "turn:fr-turn1.xirsys.com:3478?transport=udp",
          "turn:fr-turn1.xirsys.com:80?transport=tcp",
          "turn:fr-turn1.xirsys.com:3478?transport=tcp",
          "turns:fr-turn1.xirsys.com:443?transport=tcp",
          "turns:fr-turn1.xirsys.com:5349?transport=tcp",
        ],
      },
    ],
  };

  peer = new Peer({
    config: customConfig,
  });
  peer.on("open", (id) => {
    peerIdInput.value = id;
  });
  setupPeerEvents();
});

connectButton.addEventListener("click", () => {
  const peerId = peerIdToConnectInput.value;
  if (!connections[peerId]) {
    connections[peerId] = peer.connect(peerId);
    setupConnectionEvents(connections[peerId]);
  }
  chatContainer.style.display = "flex";
});

sendButton.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

audioCallButton.addEventListener("click", () => startCall(false));
videoCallButton.addEventListener("click", () => startCall(true));
endCallButton.addEventListener("click", endCall);

function setupPeerEvents() {
  peer.on("connection", (conn) => {
    connections[conn.peer] = conn;
    setupConnectionEvents(conn);
    chatContainer.style.display = "flex";
  });

  peer.on("call", (incomingCall) => {
    call = incomingCall;
    const acceptCall = confirm("Incoming call. Do you want to accept?");
    if (acceptCall) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          localStream = stream;
          localVideo.srcObject = stream;
          call.answer(stream);
          setupCallEvents();
          document.getElementById("call-container").style.display = "flex";
          endCallButton.style.display = "block";
        })
        .catch((error) =>
          console.error("Error accessing media devices:", error)
        );
    } else {
      call.close();
    }
  });
}

function setupConnectionEvents(connection) {
  connection.on("open", () => {
    console.log("Connection established with:", connection.peer);
  });

  connection.on("data", (data) => {
    if (data.type === "message") {
      addMessage(`${connection.peer}: ${data.content}`);
    } else if (data.type === "endCall") {
      endCall();
    }
  });
}

function setupCallEvents() {
  call.on("stream", (remoteStream) => {
    remoteVideo.srcObject = remoteStream;
  });

  call.on("close", () => {
    endCall();
  });
}

function sendMessage() {
  const message = messageInput.value;
  if (message) {
    Object.values(connections).forEach((connection) => {
      if (connection.open) {
        connection.send({ type: "message", content: message });
      }
    });
    addMessage(`You: ${message}`);
    messageInput.value = "";
  }
}

function addMessage(message) {
  const messageElement = document.createElement("div");
  messageElement.textContent = message;
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function startCall(withVideo) {
  navigator.mediaDevices
    .getUserMedia({ video: withVideo, audio: true })
    .then((stream) => {
      localStream = stream;
      localVideo.srcObject = stream;
      const remotePeerId = peerIdToConnectInput.value;
      call = peer.call(remotePeerId, stream);
      setupCallEvents();
      document.getElementById("call-container").style.display = "flex";
      endCallButton.style.display = "block";
    })
    .catch((error) => console.error("Error accessing media devices:", error));
}

function endCall() {
  if (call) {
    call.close();
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  document.getElementById("call-container").style.display = "none";
  endCallButton.style.display = "none";

  // Notify the other peer that the call has ended
  Object.values(connections).forEach((connection) => {
    if (connection.open) {
      connection.send({ type: "endCall" });
    }
  });
}
