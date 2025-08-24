import express from 'express';
import { createServer } from 'http';
import { Camera } from './models/camera.model.js';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { connectMQTT } from './config/mqtt.js';
import authRoutes from './routes/auth.js';
import cameraRoutes from './routes/camera.js';
import analyticsRoutes from './routes/analytics.js';
import { setupWebSocket } from './services/websocket.js';
import { authenticateSocket } from './middleware/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "./");
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",   // works for HTTP long-polling
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// app.post('/api/array', async (req, res) => {
//       const cameraId  = req.body.id;
//       const camera = await Camera.findById(cameraId);
  
//       camera.lastAccessedAt = new Date();
//       camera.playCount += 1;
//       await camera.save();
  
  
//       const videoPath = path.join(uploadDir, camera.videoUrl.replace(/^\//, ''));
//       try {
//         fs.promises.access(videoPath, fs.constants.F_OK);
//       } catch (err) {
//         console.error(`Video file not found at path: ${videoPath}`);
//         return;
//       }
  
//       // Read the file and send its data
//       const videoStream = fs.createReadStream(videoPath, { highWaterMark: 64 * 1024 });

//       videoStream.on('data', (chunk) => {
//         return res.send(chunk);
//       });
// });

// WebSocket authentication middleware

app.post('/api/array', async (req, res) => {
  const cameraId = req.body.id;
  try {
    const camera = await Camera.findById(cameraId);
    if (!camera) return res.status(404).json({ error: 'Camera not found' });

    // Update access info
    camera.lastAccessedAt = new Date();
    camera.playCount = (camera.playCount || 0) + 1;
    await camera.save();

    // Get video path
    const videoPath = path.join(uploadDir, camera.videoUrl.replace(/^\//, ''));
    await fs.promises.access(videoPath, fs.constants.F_OK);

    // Read entire file as Buffer
    const fileBuffer = await fs.promises.readFile(videoPath);

    // Set headers for binary
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', fileBuffer.length);

    // Send as ArrayBuffer
    res.send({array: JSON.stringify(fileBuffer), buffer: fileBuffer.buffer});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

io.use(authenticateSocket);

// Setup WebSocket handlers
setupWebSocket(io);

const PORT = process.env.PORT || 3001;

// Initialize connections and start server
const startServer = async () => {
  try {
    console.log('Starting Video Management Server...');
    
    // Connect to databases and services
    await connectDB();
    await connectRedis();
    await connectMQTT();

    // Start server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
      console.log(`API endpoint: http://localhost:${PORT}/api`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n Shutting down server...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

startServer();

export default app;