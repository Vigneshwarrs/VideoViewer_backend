import mongoose from 'mongoose';
import pkg from 'pg';
const { Client } = pkg;
import {User} from '../models/user.model.js';
import {Camera} from '../models/camera.model.js';

let pgClient;

// MongoDB Connection
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create default users if they don't exist
    await createDefaultUsers();
    
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    throw error;
  }
};

// PostgreSQL/TimescaleDB Connection
export const connectPostgres = async () => {
  try {
    pgClient = new Client({
      connectionString: process.env.POSTGRES_URI || "postgresql://admin:admin123@localhost:5433/analyticsdb",
    });
    
    await pgClient.connect();
    console.log('TimescaleDB Connected');
    
    // Initialize TimescaleDB tables
    await initializeTables();
    
    return pgClient;
  } catch (error) {
    console.error('imescaleDB Connection Error:', error);
    throw error;
  }
};

// Initialize TimescaleDB tables
const initializeTables = async () => {
  try {
    // Login Activity Table
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS login_activity (
        id BIGSERIAL,
        user_id VARCHAR(50) NOT NULL,
        username VARCHAR(100) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address INET,
        user_agent TEXT,
        success BOOLEAN DEFAULT true,
        PRIMARY KEY (id, timestamp)
      );
    `);

    // Camera Activity Table
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS camera_activity (
        id BIGSERIAL,
        camera_id VARCHAR(50) NOT NULL,
        camera_name VARCHAR(200) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        username VARCHAR(100) NOT NULL,
        action VARCHAR(20) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        details JSONB,
        PRIMARY KEY (id, timestamp)
      );
    `);

    // Video Player Logs
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS video_player_logs (
        id BIGSERIAL,
        session_id VARCHAR(50) NOT NULL,
        camera_id VARCHAR(50) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        action VARCHAR(20) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        position INTEGER,
        duration INTEGER,
        PRIMARY KEY (id, timestamp)
      );
    `);

    // Convert to Hypertables
    await pgClient.query(`
      SELECT create_hypertable('login_activity', 'timestamp', if_not_exists => TRUE);
    `);

    await pgClient.query(`
      SELECT create_hypertable('camera_activity', 'timestamp', if_not_exists => TRUE);
    `);

    await pgClient.query(`
      SELECT create_hypertable('video_player_logs', 'timestamp', if_not_exists => TRUE);
    `);

    console.log('✅ TimescaleDB tables initialized with hypertables, indexes, and compression');
  } catch (error) {
    console.error('❌ Error initializing TimescaleDB tables:', error);
    throw error;
  }
};


// Create default users
const createDefaultUsers = async () => {
  try {
    const bcrypt = await import('bcryptjs');
    
    // Check if users exist
    const adminExists = await User.findOne({ username: 'admin' });
    const userExists = await User.findOne({ username: 'user' });

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        email: 'admin@videohub.com',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Default admin user created');
    }

    if (!userExists) {
      const hashedPassword = await bcrypt.hash('user123', 10);
      await User.create({
        username: 'user',
        email: 'user@videohub.com',
        password: hashedPassword,
        role: 'user'
      });
      console.log('Default user created');
    }
  } catch (error) {
    console.error('Error creating default users:', error);
  }
};

export const getPgClient = () => pgClient;

// Initialize PostgreSQL connection
connectPostgres().catch(console.error);