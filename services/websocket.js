// import fs from 'fs/promises';
// import path from 'path';
// import { Camera } from '../models/camera.model.js';
// import { publishEvent } from '../config/mqtt.js';

// const activeSessions = new Map();

// export const setupWebSocket = (io) => {
//   io.on('connection', (socket) => {
//     console.log(`🔌 User ${socket.user.username} connected via WebSocket`);

//     // Handle video stream start
//     socket.on('start-video-stream', async (data) => {
//       try {
//         const { cameraId } = data;
        
//         // Find camera
//         const camera = await Camera.findById(cameraId);
//         if (!camera) {
//           socket.emit('error', { message: 'Camera not found' });
//           return;
//         }

//         // Update camera access time and play count
//         camera.lastAccessedAt = new Date();
//         camera.playCount += 1;
//         await camera.save();

//         // Create session
//         const sessionId = `${socket.user._id}_${cameraId}_${Date.now()}`;
//         activeSessions.set(socket.id, {
//           sessionId,
//           cameraId,
//           userId: socket.user._id,
//           username: socket.user.username,
//           startTime: new Date()
//         });

//         // Join camera room
//         socket.join(`camera_${cameraId}`);

//         // Publish video action event
//         publishEvent('video_action', {
//           sessionId,
//           cameraId,
//           userId: socket.user._id,
//           username: socket.user.username,
//           action: 'stream_start'
//         });

//         // Start streaming video (mock implementation)
//         // In a real implementation, you would stream actual video data
//         const videoPath = path.join(process.cwd(), camera.videoUrl.replace('/', ''));
//         try {
//           const videoExists = await fs.promises.access(videoPath).then(() => true).catch(() => false);
//         if (!videoExists) {
//             socket.emit('error', { message: 'Video file not found' });
//             return;
//         }
        
//         // Start streaming real video data
//         const videoStream = fs.createReadStream(videoPath, { highWaterMark: 64 * 1024 }); // 64KB chunks
        
//         videoStream.on('data', (chunk) => {
//             if (socket.connected) {
//                 socket.emit('video-data', chunk);
//             }
//         });

//         videoStream.on('end', () => {
//             socket.emit('video-status', { message: 'Stream ended' });
//         });

//         videoStream.on('error', (err) => {
//             console.error('Error streaming video:', err);
//             socket.emit('error', { message: 'Failed to stream video file' });
//         });

//         // Store the stream and interval for cleanup
//         socket.videoStream = videoStream;
        
//         // Send initial status
//         socket.emit('video-status', {
//             message: 'Stream started',
//             cameraId
//         });
//         } catch (error) {
//           console.error('Error starting video stream:', error);
//           socket.emit('error', { message: 'Failed to start video stream' });
//         }

//       } catch (error) {
//         console.error('Error in start-video-stream:', error);
//         socket.emit('error', { message: 'Internal server error' });
//       }
//     });

//     // Handle video stream stop
//     socket.on('stop-video-stream', async (data) => {
//       try {
//         const { cameraId } = data;
//         const session = activeSessions.get(socket.id);

//         if (session) {
//           // Calculate session duration
//           const duration = Date.now() - session.startTime.getTime();
          
//           // Update camera total play time
//           await Camera.findByIdAndUpdate(cameraId, {
//             $inc: { totalPlayTime: Math.floor(duration / 1000) }
//           });

//           // Publish video action event
//           publishEvent('video_action', {
//             sessionId: session.sessionId,
//             cameraId,
//             userId: socket.user._id,
//             username: socket.user.username,
//             action: 'stream_stop',
//             duration: Math.floor(duration / 1000)
//           });

//           // Clean up session
//           activeSessions.delete(socket.id);
//         }

//         // Leave camera room
//         socket.leave(`camera_${cameraId}`);

//         // Clear streaming interval
//         if (socket.streamInterval) {
//           clearInterval(socket.streamInterval);
//           delete socket.streamInterval;
//         }
//         if (socket.videoStream) {
//             socket.videoStream.destroy();
//         }
//         socket.emit('video-status', {
//           message: 'Stream stopped',
//           cameraId
//         });

//       } catch (error) {
//         console.error('Error in stop-video-stream:', error);
//         socket.emit('error', { message: 'Internal server error' });
//       }
//     });

//     // Handle video player actions
//     socket.on('video-action', async (data) => {
//       try {
//         const { cameraId, action, ...actionData } = data;
//         const session = activeSessions.get(socket.id);

//         if (session) {
//           // Publish video action event
//           publishEvent('video_action', {
//             sessionId: session.sessionId,
//             cameraId,
//             userId: socket.user._id,
//             username: socket.user.username,
//             action,
//             ...actionData
//           });

//           // Broadcast action to other users watching the same camera
//           socket.to(`camera_${cameraId}`).emit('video-action', {
//             action,
//             userId: socket.user._id,
//             username: socket.user.username,
//             ...actionData
//           });
//         }

//       } catch (error) {
//         console.error('Error in video-action:', error);
//         socket.emit('error', { message: 'Internal server error' });
//       }
//     });

//     // Handle disconnect
//     socket.on('disconnect', async () => {
//       console.log(`🔌 User ${socket.user.username} disconnected`);
      
//       const session = activeSessions.get(socket.id);
//       if (session) {
//         try {
//           // Calculate session duration
//           const duration = Date.now() - session.startTime.getTime();
          
//           // Update camera total play time
//           await Camera.findByIdAndUpdate(session.cameraId, {
//             $inc: { totalPlayTime: Math.floor(duration / 1000) }
//           });

//           // Publish disconnect event
//           publishEvent('video_action', {
//             sessionId: session.sessionId,
//             cameraId: session.cameraId,
//             userId: socket.user._id,
//             username: socket.user.username,
//             action: 'disconnect',
//             duration: Math.floor(duration / 1000)
//           });
//           if (socket.videoStream) {
//             socket.videoStream.destroy();
//         }
//         } catch (error) {
//           console.error('Error handling disconnect:', error);
//         }

//         // Clean up session
//         activeSessions.delete(socket.id);
//       }

//       // Clear streaming interval
//       if (socket.streamInterval) {
//         clearInterval(socket.streamInterval);
//       }
//     });
//   });
// };

// // Get active sessions count
// export const getActiveSessionsCount = () => {
//   return activeSessions.size;
// };

import fs from 'fs'; // Use fs for createReadStream
import path from 'path';
import { fileURLToPath } from 'url';
import { Camera } from '../models/camera.model.js';
import { publishEvent } from '../config/mqtt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../");

const activeSessions = new Map();

export const setupWebSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 User ${socket.user.username} connected via WebSocket`);

    // Handle video stream start
    // socket.on('start-video-stream', async (data) => {
    //   try {
    //     const { cameraId } = data;
        
    //     // Find camera
    //     const camera = await Camera.findById(cameraId);
    //     console.log(cameraId);
    //     if (!camera) {
    //       socket.emit('error', { message: 'Camera not found' });
    //       return;
    //     }

    //     // Update camera access time and play count
    //     camera.lastAccessedAt = new Date();
    //     camera.playCount += 1;
    //     await camera.save();

    //     // Create session
    //     const sessionId = `${socket.user._id}_${cameraId}_${Date.now()}`;
    //     activeSessions.set(socket.id, {
    //       sessionId,
    //       cameraId,
    //       userId: socket.user._id,
    //       username: socket.user.username,
    //       startTime: new Date()
    //     });

    //     // Join camera room
    //     socket.join(`camera_${cameraId}`);

    //     // Publish video action event
    //     publishEvent('video_action', {
    //       sessionId,
    //       cameraId,
    //       userId: socket.user._id,
    //       username: socket.user.username,
    //       action: 'stream_start'
    //     });

    //     const videoPath = path.join(uploadDir, camera.videoUrl.replace('/^\//', ''));
    //      try {
    //       await fs.promises.access(videoPath, fs.constants.F_OK);
    //     } catch (err) {
    //       console.error(`Video file not found at path: ${videoPath}`);
    //       socket.emit('error', { message: 'Video file not found' });
    //       return;
    //     }

    //     if (socket.videoStream) {
    //       socket.videoStream.destroy();
    //     }
        
    //     // Start streaming real video data
    //     const videoStream = fs.createReadStream(videoPath, { highWaterMark: 64 * 1024 }); // 64KB chunks
        
    //     videoStream.on('data', (chunk) => {
    //         if (socket.connected) {
    //             socket.emit('video-data', chunk);
    //         }
    //     });

    //     videoStream.on('end', () => {
    //         socket.emit('video-status', { message: 'Stream ended' });
    //     });

    //     videoStream.on('end', () => {
    //       console.log(`Stream ended for camera: ${camera.id}`);
    //       socket.emit('video-status', { message: 'Stream ended', cameraId });
    //       // Optionally, clean up the session here as well
    //       const session = activeSessions.get(socket.id);
    //       if (session) {
    //         activeSessions.delete(socket.id);
    //       }
    //     });

    //     videoStream.on('error', (err) => {
    //       console.error('Error streaming video:', err);
    //       socket.emit('error', { message: 'Failed to stream video file' });
    //       if (socket.videoStream) {
    //         socket.videoStream.destroy();
    //         delete socket.videoStream;
    //       }
    //     });

    //     // Send initial status
    //     socket.emit('video-status', { message: 'Stream started', cameraId });

    //   } catch (error) {
    //     console.error('Error in start-video-stream:', error);
    //     socket.emit('error', { message: 'Internal server error' });
    //   }
    // });
    socket.on('start-video-stream', async (data) => {
      try {
        const { cameraId } = data;
        
        // Find camera
        const camera = await Camera.findById(cameraId);
        console.log(cameraId);
        if (!camera) {
          socket.emit('error', { message: 'Camera not found' });
          return;
        }

        // Update camera access time and play count
        camera.lastAccessedAt = new Date();
        camera.playCount += 1;
        await camera.save();

        // Create session
        const sessionId = `${socket.user._id}_${cameraId}_${Date.now()}`;
        activeSessions.set(socket.id, {
          sessionId,
          cameraId,
          userId: socket.user._id,
          username: socket.user.username,
          startTime: new Date()
        });

        // Join camera room
        socket.join(`camera_${cameraId}`);

        // Publish video action event
        publishEvent('video_action', {
          sessionId,
          cameraId,
          userId: socket.user._id,
          username: socket.user.username,
          action: 'stream_start'
        });

        // Fix 1: Use a proper regex to remove the leading slash
        const videoPath = path.join(uploadDir, camera.videoUrl.replace(/^\//, ''));
        
         try {
          await fs.promises.access(videoPath, fs.constants.F_OK);
        } catch (err) {
          console.error(`Video file not found at path: ${videoPath}`);
          socket.emit('error', { message: 'Video file not found' });
          return;
        }

        if (socket.videoStream) {
          socket.videoStream.destroy();
        }
        
        // Start streaming real video data
        const videoStream = fs.createReadStream(videoPath, { highWaterMark: 64 * 1024 }); // 64KB chunks
        socket.videoStream = videoStream;

        videoStream.on('data', (chunk) => {
          if (socket.connected) {
          const arrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
          socket.emit('video-data', arrayBuffer);
          }
        });

        // Fix 2: Combine the two `on('end')` listeners into one
        videoStream.on('end', () => {
          console.log(`Stream ended for camera: ${camera.id}`);
          socket.emit('video-status', { message: 'Stream ended', cameraId });
          const session = activeSessions.get(socket.id);
          if (session) {
            activeSessions.delete(socket.id);
          }
        });

        videoStream.on('error', (err) => {
          console.error('Error streaming video:', err);
          socket.emit('error', { message: 'Failed to stream video file' });
          if (socket.videoStream) {
            socket.videoStream.destroy();
            delete socket.videoStream;
          }
        });

        // Send initial status
        socket.emit('video-status', { message: 'Stream started', cameraId });

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
          // Calculate session duration
          const duration = Date.now() - session.startTime.getTime();
          
          // Update camera total play time
          await Camera.findByIdAndUpdate(cameraId, {
            $inc: { totalPlayTime: Math.floor(duration / 1000) }
          });

          // Publish video action event
          publishEvent('video_action', {
            sessionId: session.sessionId,
            cameraId,
            userId: socket.user._id,
            username: socket.user.username,
            action: 'stream_stop',
            duration: Math.floor(duration / 1000)
          });

          // Clean up session
          activeSessions.delete(socket.id);
        }

        // Leave camera room
        socket.leave(`camera_${cameraId}`);

        // Clean up the video stream
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

    // Handle video player actions
    socket.on('video-action', async (data) => {
      try {
        const { cameraId, action, ...actionData } = data;
        const session = activeSessions.get(socket.id);

        if (session) {
          // Publish video action event
          publishEvent('video_action', {
            sessionId: session.sessionId,
            cameraId,
            userId: socket.user._id,
            username: socket.user.username,
            action,
            ...actionData
          });

          // Broadcast action to other users watching the same camera
          socket.to(`camera_${cameraId}`).emit('video-action', {
            action,
            userId: socket.user._id,
            username: socket.user.username,
            ...actionData
          });
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
          // Calculate session duration
          const duration = Date.now() - session.startTime.getTime();
          
          // Update camera total play time
          await Camera.findByIdAndUpdate(session.cameraId, {
            $inc: { totalPlayTime: Math.floor(duration / 1000) }
          });

          // Publish disconnect event
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

// Get active sessions count
export const getActiveSessionsCount = () => {
  return activeSessions.size;
};