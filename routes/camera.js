import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Camera } from '../models/camera.model.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { cacheCamera, cacheAllCameras, deleteCachedCamera } from '../config/redis.js';
import { publishEvent } from '../config/mqtt.js';

const router = express.Router();

// Configure multer for video upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

// Get all cameras
router.get('/', authenticateToken, async (req, res) => {
  try {
    const cameras = await Camera.find({})
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    // Cache the cameras
    await cacheAllCameras(cameras);

    res.json(cameras);
  } catch (error) {
    console.error('Error fetching cameras:', error);
    res.status(500).json({ message: 'Failed to fetch cameras' });
  }
});

// Get single camera
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const camera = await Camera.findById(req.params.id)
      .populate('createdBy', 'username');

    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }

    res.json(camera);
  } catch (error) {
    console.error('Error fetching camera:', error);
    res.status(500).json({ message: 'Failed to fetch camera' });
  }
});

// Create camera
// router.post('/', authenticateToken, requireAdmin, upload.single('video'), async (req, res) => {
//   try {
//     const { name, description, location, resolution, frameRate } = req.body;

//     if (!name || !location || !resolution || !frameRate) {
//       return res.status(400).json({ message: 'Required fields are missing' });
//     }

//     if (!req.file) {
//       return res.status(400).json({ message: 'Video file is required' });
//     }

//     // Create video URL
//     const videoUrl = `/uploads/${req.file.filename}`;

//     // Create camera
//     const camera = new Camera({
//       name,
//       description,
//       location,
//       videoUrl,
//       videoFileName: req.file.filename,
//       videoFileSize: req.file.size,
//       resolution,
//       frameRate: parseInt(frameRate),
//       createdBy: req.user._id
//     });

//     await camera.save();

//     // Populate the createdBy field
//     await camera.populate('createdBy', 'username');

//     // Cache the camera
//     await cacheCamera(camera);

//     // Publish event to MQTT
//     publishEvent('camera_created', {
//       cameraId: camera._id,
//       name: camera.name,
//       location: camera.location,
//       userId: req.user._id,
//       username: req.user.username,
//       timestamp: new Date()
//     });

//     res.status(201).json(camera);

//   } catch (error) {
//     // Clean up uploaded file if camera creation fails
//     if (req.file) {
//       try {
//         await fs.unlink(req.file.path);
//       } catch (unlinkError) {
//         console.error('Error cleaning up file:', unlinkError);
//       }
//     }

//     console.error('Error creating camera:', error);
//     res.status(500).json({ message: 'Failed to create camera' });
//   }
// });

router.post('/', authenticateToken, requireAdmin, upload.single('video'), async (req, res) => {
  try {
    const { name, description, location, resolution, frameRate } = req.body;

    if (!name || !location || !resolution || !frameRate) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    const uploadedPath = req.file.path;
    const outputFileName = `${path.parse(req.file.filename).name}_frag.mp4`;
    const outputPath = path.join('uploads', outputFileName);

    // Convert uploaded MP4 to fragmented MP4 for MediaSource
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', uploadedPath,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        outputPath
      ]);

      ffmpeg.stderr.on('data', (data) => console.log('ffmpeg:', data.toString()));
      ffmpeg.on('error', reject);
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve(true);
        else reject(new Error('ffmpeg conversion failed'));
      });
    });

    // Delete the original uploaded file
    await fs.promises.unlink(uploadedPath);

    // Create video URL
    const videoUrl = `/uploads/${outputFileName}`;

    // Save camera
    const camera = new Camera({
      name,
      description,
      location,
      videoUrl,
      videoFileName: outputFileName,
      videoFileSize: (await fs.promises.stat(outputPath)).size,
      resolution,
      frameRate: parseInt(frameRate),
      createdBy: req.user._id
    });

    await camera.save();
    await camera.populate('createdBy', 'username');

    // Cache and MQTT
    await cacheCamera(camera);
    publishEvent('camera_created', {
      cameraId: camera._id,
      name: camera.name,
      location: camera.location,
      userId: req.user._id,
      username: req.user.username,
      timestamp: new Date()
    });

    res.status(201).json(camera);

  } catch (error) {
    // Clean up uploaded file if conversion or camera save fails
    if (req.file) {
      try { await fs.unlink(req.file.path); } catch (e) { console.error(e); }
    }
    console.error('Error creating camera:', error);
    res.status(500).json({ message: 'Failed to create camera' });
  }
});

// Update camera
router.put('/:id', authenticateToken, requireAdmin, upload.single('video'), async (req, res) => {
  try {
    const { name, description, location, resolution, frameRate } = req.body;
    
    const camera = await Camera.findById(req.params.id);
    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }
console.log(req.body);
    // Update fields
    if (name) camera.name = name;
    if (description) camera.description = description;
    if (location) camera.location = location;
    if (resolution) camera.resolution = resolution;
    if (frameRate) camera.frameRate = parseInt(frameRate);

    // If new video file is uploaded
    if (req.file) {
      // Delete old video file
      if (camera.videoFileName) {
        try {
          await fs.unlink(path.join('uploads', camera.videoFileName));
        } catch (error) {
          console.error('Error deleting old video file:', error);
        }
      }

      // Update video info
      camera.videoUrl = `/uploads/${req.file.filename}`;
      camera.videoFileName = req.file.filename;
      camera.videoFileSize = req.file.size;
    }

    await camera.save();
    await camera.populate('createdBy', 'username');

    // Update cache
    await cacheCamera(camera);

    // Publish event to MQTT
    publishEvent('camera_updated', {
      cameraId: camera._id,
      name: camera.name,
      location: camera.location,
      userId: req.user._id,
      username: req.user.username,
      timestamp: new Date()
    });

    res.json(camera);

  } catch (error) {
    console.error('Error updating camera:', error);
    res.status(500).json({ message: 'Failed to update camera' });
  }
});

// Delete camera
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const camera = await Camera.findById(req.params.id);
    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }

    // Delete video file
    if (camera.videoFileName) {
      try {
        await fs.unlink(path.join('uploads', camera.videoFileName));
      } catch (error) {
        console.error('Error deleting video file:', error);
      }
    }

    await Camera.findByIdAndDelete(req.params.id);

    // Remove from cache
    await deleteCachedCamera(req.params.id);

    // Publish event to MQTT
    publishEvent('camera_deleted', {
      cameraId: camera._id,
      name: camera.name,
      location: camera.location,
      userId: req.user._id,
      username: req.user.username,
      timestamp: new Date()
    });

    res.json({ message: 'Camera deleted successfully' });

  } catch (error) {
    console.error('Error deleting camera:', error);
    res.status(500).json({ message: 'Failed to delete camera' });
  }
});

// Update camera status
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['online', 'offline', 'maintenance'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const camera = await Camera.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('createdBy', 'username');

    if (!camera) {
      return res.status(404).json({ message: 'Camera not found' });
    }

    // Update cache
    await cacheCamera(camera);

    // Publish event to MQTT
    publishEvent('camera_status_updated', {
      cameraId: camera._id,
      name: camera.name,
      status: camera.status,
      userId: req.user._id,
      username: req.user.username,
      timestamp: new Date()
    });

    res.json(camera);

  } catch (error) {
    console.error('Error updating camera status:', error);
    res.status(500).json({ message: 'Failed to update camera status' });
  }
});

export default router;