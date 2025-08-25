import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { connectMQTT } from './config/mqtt.js';
import authRoutes from './routes/auth.js';
import cameraRoutes from './routes/camera.js';
import analyticsRoutes from './routes/analytics.js';
import streamRoutes from './routes/stream.js';
import { setupWebSocket } from './services/websocket.js';
import { authenticateSocket } from './middleware/auth.js';


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
app.use('/api/stream', streamRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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