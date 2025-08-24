import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getPgClient } from '../config/db.js';
import { Camera } from '../models/camera.model.js';
import { User } from '../models/user.model.js';

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, userId, cameraId } = req.query;
    const pgClient = getPgClient();

    // Build date filter
    let dateFilter = '';
    const params = [];
    let paramCount = 0;

    if (startDate && endDate) {
      dateFilter = `WHERE timestamp >= $${++paramCount} AND timestamp <= $${++paramCount}`;
      params.push(startDate, endDate);
    }

    // Get basic counts
    const totalCameras = await Camera.countDocuments();
    const totalUsers = await User.countDocuments();

    // Get active sessions (mock data - in real app, track via WebSocket connections)
    const activeSessions = Math.floor(Math.random() * 10) + 1;

    // Get camera usage from TimescaleDB
    let cameraUsageQuery = `
      SELECT 
        camera_id,
        camera_name,
        COUNT(*) as play_count,
        SUM(CASE WHEN action = 'play' THEN 1 ELSE 0 END) as actual_plays
      FROM camera_activity 
      ${dateFilter}
      ${cameraId ? (dateFilter ? 'AND' : 'WHERE') + ` camera_id = $${++paramCount}` : ''}
      GROUP BY camera_id, camera_name
      ORDER BY play_count DESC
      LIMIT 10
    `;

    if (cameraId) {
      params.push(cameraId);
    }

    const cameraUsageResult = await pgClient.query(cameraUsageQuery, params);
    const cameraUsage = cameraUsageResult.rows.map(row => ({
      cameraId: row.camera_id,
      cameraName: row.camera_name,
      playCount: parseInt(row.play_count),
      totalDuration: Math.floor(Math.random() * 3600) // Mock duration data
    }));

    // Get login activity
    let loginActivityQuery = `
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM login_activity 
      ${dateFilter}
      ${userId ? (dateFilter ? 'AND' : 'WHERE') + ` user_id = $${dateFilter ? paramCount + 1 : 1}` : ''}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `;

    const loginParams = [...params];
    if (userId) {
      loginParams.push(userId);
    }

    const loginActivityResult = await pgClient.query(loginActivityQuery, loginParams);
    const loginActivity = loginActivityResult.rows.map(row => ({
      date: row.date,
      count: parseInt(row.count)
    }));

    // Get most active users
    let activeUsersQuery = `
      SELECT 
        user_id,
        username,
        COUNT(*) as activity_count
      FROM camera_activity 
      ${dateFilter}
      GROUP BY user_id, username
      ORDER BY activity_count DESC
      LIMIT 10
    `;

    const activeUsersResult = await pgClient.query(activeUsersQuery, params);
    const mostActiveUsers = activeUsersResult.rows.map(row => ({
      userId: row.user_id,
      username: row.username,
      activityCount: parseInt(row.activity_count)
    }));

    res.json({
      totalCameras,
      activeSessions,
      totalUsers,
      cameraUsage,
      loginActivity,
      mostActiveUsers
    });

  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ message: 'Failed to fetch analytics data' });
  }
});

// Get login activity
router.get('/login-activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pgClient = getPgClient();

    let query = `
      SELECT 
        id,
        user_id,
        username,
        timestamp,
        ip_address,
        user_agent,
        success
      FROM login_activity
    `;

    const params = [];
    let paramCount = 0;

    if (startDate && endDate) {
      query += ` WHERE timestamp >= $${++paramCount} AND timestamp <= $${++paramCount}`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY timestamp DESC LIMIT 100`;

    const result = await pgClient.query(query, params);

    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching login activity:', error);
    res.status(500).json({ message: 'Failed to fetch login activity' });
  }
});

// Get camera activity
router.get('/camera-activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, cameraId } = req.query;
    const pgClient = getPgClient();

    let query = `
      SELECT 
        id,
        camera_id,
        camera_name,
        user_id,
        username,
        action,
        timestamp,
        details
      FROM camera_activity
    `;

    const params = [];
    let paramCount = 0;
    let whereClause = [];

    if (startDate && endDate) {
      whereClause.push(`timestamp >= $${++paramCount} AND timestamp <= $${++paramCount}`);
      params.push(startDate, endDate);
    }

    if (cameraId) {
      whereClause.push(`camera_id = $${++paramCount}`);
      params.push(cameraId);
    }

    if (whereClause.length > 0) {
      query += ` WHERE ${whereClause.join(' AND ')}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT 100`;

    const result = await pgClient.query(query, params);

    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching camera activity:', error);
    res.status(500).json({ message: 'Failed to fetch camera activity' });
  }
});

// Get video player logs
router.get('/video-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, cameraId, userId } = req.query;
    const pgClient = getPgClient();

    let query = `
      SELECT 
        id,
        session_id,
        camera_id,
        user_id,
        action,
        timestamp,
        position,
        duration
      FROM video_player_logs
    `;

    const params = [];
    let paramCount = 0;
    let whereClause = [];

    if (startDate && endDate) {
      whereClause.push(`timestamp >= $${++paramCount} AND timestamp <= $${++paramCount}`);
      params.push(startDate, endDate);
    }

    if (cameraId) {
      whereClause.push(`camera_id = $${++paramCount}`);
      params.push(cameraId);
    }

    if (userId) {
      whereClause.push(`user_id = $${++paramCount}`);
      params.push(userId);
    }

    if (whereClause.length > 0) {
      query += ` WHERE ${whereClause.join(' AND ')}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT 100`;

    const result = await pgClient.query(query, params);

    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching video player logs:', error);
    res.status(500).json({ message: 'Failed to fetch video player logs' });
  }
});

export default router;