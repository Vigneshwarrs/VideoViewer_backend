import fs from 'fs'; // Use fs for createReadStream
import path from 'path';
import { Camera } from '../models/camera.model.js';
import { publishEvent, handleMQTTMessage } from '../config/mqtt.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../");
import { v4 as uuidv4 } from 'uuid';

const activeSessions = new Map();

export const setupWebSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 User ${socket.user.username} connected via WebSocket`);

    socket.on('start-video-stream', async (data) => {
      try {
        const { cameraId } = data;
        const camera = await Camera.findById(cameraId);
        console.log(camera, "camera");
        if (!camera) {
          socket.emit('error', { message: 'Camera not found' });
          return;
        }

        camera.lastAccessedAt = new Date();
        camera.playCount += 1;
        await camera.save();

        if (socket.videoStream) {
          socket.videoStream.destroy();
        }

        const videoPath = path.join(uploadDir, camera.videoUrl.replace(/^\//, ''));
        try {
          await fs.promises.access(videoPath, fs.constants.F_OK);
        } catch (err) {
          console.error(`Video file not found at path: ${videoPath}`);
          socket.emit('error', { message: 'Video file not found' });
          return;
        }


        const videoStream = fs.createReadStream(videoPath);
        socket.videoStream = videoStream;

        const stats = await fs.promises.stat(videoPath);
        const totalSize = stats.size;
        const chunkSize = 64 * 1024; // 64KB
        const totalChunks = Math.ceil(totalSize / chunkSize);
        let chunkIndex = 0;
        videoStream.on('data', (chunk) => {
          if (socket.connected) {
            chunkIndex++;
            socket.emit('video-data', {
              index: chunkIndex,
              totalChunks,
              length: chunk.length,
              data: chunk,
            });
          }
        });

        videoStream.on('end', () => {
          console.log(`Stream ended for camera: ${camera.id}`);
          socket.emit('video-status', { message: 'Stream ended', cameraId });
        });

        videoStream.on('error', (err) => {
          console.error('Error streaming video:', err);
          socket.emit('error', { message: 'Failed to stream video file' });
          if (socket.videoStream) {
            socket.videoStream.destroy();
          }
        });

        const newSessionId = uuidv4();
        const sessionData = {
          sessionId: newSessionId,
          startTime: new Date(),
          cameraId: cameraId,
        };
        activeSessions.set(socket.id, sessionData);

        socket.emit('video-status', { message: 'Stream started', sessionData });

      } catch (error) {
        console.error('Error in start-video-stream:', error);
        socket.emit('error', { message: 'Internal server error' });
      }
    });
    // Handle video stream stop
    socket.on('stop-video-stream', async (data) => {
      try {
        const { cameraId } = data;
        const session = activeSessions.get(socket.id);

        if (session) {
          const duration = Date.now() - session.startTime.getTime();

          await Camera.findByIdAndUpdate(cameraId, {
            $inc: { totalPlayTime: Math.floor(duration / 1000) }
          });

          publishEvent('video_action', {
            sessionId: session.sessionId,
            cameraId,
            userId: socket.user._id,
            username: socket.user.username,
            action: 'stream_stop',
            duration: Math.floor(duration / 1000)
          });

          activeSessions.delete(socket.id);
        }

        socket.leave(`camera_${cameraId}`);

        if (socket.videoStream) {
          socket.videoStream.destroy();
        }
        socket.emit('video-status', {
          message: 'Stream stopped',
          cameraId
        });

      } catch (error) {
        console.error('Error in stop-video-stream:', error);
        socket.emit('error', { message: 'Internal server error' });
      }
    });


    socket.on('video-action', async (data) => {
      try {
        const { cameraId, action, ...actionData } = data;
        const session = activeSessions.get(socket.id);

        if (session) {
          publishEvent('video_action', {
            sessionId: session.sessionId,
            cameraId,
            userId: socket.user._id,
            username: socket.user.username,
            action,
            ...actionData
          });

          handleMQTTMessage('video/events', {
            eventType: 'video_action',
            data: {
              sessionId: session.sessionId,
              cameraId,
              userId: socket.user._id,
              username: socket.user.username,
              action,
              ...actionData
            }
          });

          socket.to(`camera_${cameraId}`).emit('video-action', {
            action,
            userId: socket.user._id,
            username: socket.user.username,
            ...actionData
          });
        } else {
          console.warn(`⚠️ Video action received without an active session for socket ${socket.id}`);
        }

      } catch (error) {
        console.error('Error in video-action:', error);
        socket.emit('error', { message: 'Internal server error' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 User ${socket.user.username} disconnected`);

      const session = activeSessions.get(socket.id);
      if (session) {
        try {
          const duration = Date.now() - session.startTime.getTime();

          await Camera.findByIdAndUpdate(session.cameraId, {
            $inc: { totalPlayTime: Math.floor(duration / 1000) }
          });

          publishEvent('video_action', {
            sessionId: session.sessionId,
            cameraId: session.cameraId,
            userId: socket.user._id,
            username: socket.user.username,
            action: 'disconnect',
            duration: Math.floor(duration / 1000)
          });

          if (socket.videoStream) {
            socket.videoStream.destroy();
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }

        // Clean up session
        activeSessions.delete(socket.id);
      }
    });
  });
};

export const getActiveSessionsCount = () => {
  return activeSessions.size;
};