import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { authenticateToken } from '../middleware/auth.js';
import { publishEvent } from '../config/mqtt.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username }).select('+password');
    if (!user || !user.isActive) {
      publishEvent('user_login', {
        username,
        success: false,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        error: 'User not found or inactive'
      });
      
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      publishEvent('user_login', {
        userId: user._id,
        username: user.username,
        success: false,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        error: 'Invalid password'
      });
      
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    publishEvent('user_login', {
      userId: user._id,
      username: user.username,
      role: user.role,
      success: true,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };

    res.json({
      message: 'Login successful',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: role === 'admin' ? 'admin' : 'user'
    });

    await user.save();

    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };

    res.status(201).json({
      message: 'User registered successfully',
      user: userData
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/verify', authenticateToken, (req, res) => {
  const userData = {
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    role: req.user.role,
    createdAt: req.user.createdAt,
    lastLoginAt: req.user.lastLoginAt
  };

  res.json(userData);
});

router.post('/logout', authenticateToken, (req, res) => {
  publishEvent('user_logout', {
    userId: req.user._id,
    username: req.user.username,
    role: req.user.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({ message: 'Logout successful' });
});

export default router;