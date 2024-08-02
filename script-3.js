// Firebase configuration (replace with your own config)
const firebaseConfig = {
  apiKey: "AIzaSyCHi71Le9wojTJd7zkmTrgJvxuZnxWm9NI",
  authDomain: "simple-chat-41aaa.firebaseapp.com",
  projectId: "simple-chat-41aaa",
  storageBucket: "simple-chat-41aaa.appspot.com",
  messagingSenderId: "793072997279",
  appId: "1:793072997279:web:d1ead03cf0b492e21aa3aa",
  measurementId: "G-H31NTCPYD9",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

let peer;
let connections = {};
let call;
let localStream;
let currentUser;

const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username-input");
const loginButton = document.getElementById("login-button");
const chatApp = document.getElementById("chat-app");
const peerList = document.getElementById("peer-list");
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

loginButton.addEventListener("click", login);
generatePeerIdButton.addEventListener("click", initializePeerJS);
connectButton.addEventListener("click", connectToPeer);
sendButton.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
audioCallButton.addEventListener("click", () => startCall(false));
videoCallButton.addEventListener("click", () => startCall(true));
endCallButton.addEventListener("click", endCall);

function login() {
  const username = usernameInput.value;
  if (username) {
    auth
      .signInAnonymously()
      .then(() => {
        currentUser = {
          id: auth.currentUser.uid,
          username: username,
        };
        loginForm.style.display = "none";
        chatApp.style.display = "block";
        initializePeerJS();
        addUserToActiveList();
        setupActivePeersList();
        loadChatHistory();
      })
      .catch((error) => {
        console.error("Error logging in:", error);
      });
  }
}

function initializePeerJS() {
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
    updateUserPeerId(id);
  });

  setupPeerEvents();
}

function addUserToActiveList() {
  database.ref("users/" + currentUser.id).set({
    username: currentUser.username,
    peerId: "",
  });
}

function updateUserPeerId(peerId) {
  database.ref("users/" + currentUser.id).update({
    peerId: peerId,
  });
}

function setupActivePeersList() {
  database.ref("users").on("value", (snapshot) => {
    peerList.innerHTML = "";
    snapshot.forEach((childSnapshot) => {
      const user = childSnapshot.val();
      if (user.peerId && user.peerId !== peer.id) {
        const listItem = document.createElement("li");
        listItem.textContent = user.username;
        listItem.addEventListener("click", () => connectToPeer(user.peerId));
        peerList.appendChild(listItem);
      }
    });
  });
}

function connectToPeer(peerId) {
  if (!connections[peerId]) {
    connections[peerId] = peer.connect(peerId);
    setupConnectionEvents(connections[peerId]);
  }
  chatContainer.style.display = "flex";
}

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
    const messageData = {
      sender: currentUser.username,
      content: message,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };

    // Store message in Firebase
    database.ref("messages").push(messageData);

    // Send message via PeerJS
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

function loadChatHistory() {
  database
    .ref("messages")
    .orderByChild("timestamp")
    .limitToLast(50)
    .on("child_added", (snapshot) => {
      const message = snapshot.val();
      addMessage(`${message.sender}: ${message.content}`);
    });
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

// Cleanup on window close
window.addEventListener("beforeunload", () => {
  if (currentUser) {
    database.ref("users/" + currentUser.id).remove();
  }
});
