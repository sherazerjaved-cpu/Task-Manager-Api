const { io } = require("socket.io-client");

// 👇 Paste your access token here
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YTNhZTdlOWUzZjNjY2IxNDg1NDg1YjMiLCJlbWFpbCI6ImRhdWRAdGVzdC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc4MzY3MzY5NSwiZXhwIjoxNzgzNjc0NTk1fQ.j71zisevgvEtBFNDdyFSdOc4i-vQwVgxGB9R12WPG5M";

const socket = io("http://localhost:3000", {
  auth: {
    token: TOKEN,
  },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("✅ Connected!");
  console.log("Socket ID:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("❌ Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.log("❌ Connection Error:", err.message);
});

socket.on("task.created", (task) => {
  console.log("\n🟢 TASK CREATED");
  console.log(task);
});

socket.on("task.updated", (task) => {
  console.log("\n🟡 TASK UPDATED");
  console.log(task);
});

socket.on("task.deleted", (data) => {
  console.log("\n🔴 TASK DELETED");
  console.log(data);
});