import { io } from "socket.io-client";
import path from 'path';

const socket = io("http://localhost:3001", {
  auth: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGE5ZDdhODgyM2RhZDgwNDg5YmQ4ZmQiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzU1OTY2ODM5LCJleHAiOjE3NTY1NzE2Mzl9.RlD6sE7CnjwIJtpceoqucPgpCIQczRcDrazk967zEGY" }
});
import fs from "fs";

socket.on("connect", () => {
  console.log("✅ Connected to WebSocket");

  // Request to start streaming
  socket.emit("start-video-stream", { cameraId: "68a9d7a8823dad80489bd8fd" });
});

// Save streamed chunks into a file (just for testing)
const writeStream = fs.createWriteStream("output.mp4");

socket.on("video-metadata", (meta) => {
  console.log("Video metadata:", meta);
});

socket.on("video-chunk", ({ chunk }) => {
  writeStream.write(Buffer.from(chunk));
});

socket.on("video-end", () => {
  console.log("✅ Video stream ended. File saved as output.mp4");
  writeStream.end();
});
