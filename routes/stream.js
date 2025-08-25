import express from 'express';
const router = express.Router();
import { Camera } from '../models/camera.model.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../");

router.post('/buffer/:cameraId', async (req, res) => {
    const { cameraId } = req.params;
  try {
    const camera = await Camera.findById(cameraId);
    if (!camera) return res.status(404).json({ error: 'Camera not found' });

    camera.lastAccessedAt = new Date();
    camera.playCount = (camera.playCount || 0) + 1;
    await camera.save();

    const videoPath = path.join(uploadDir, camera.videoUrl.replace(/^\//, ''));
    await fs.promises.access(videoPath, fs.constants.F_OK);

    const fileBuffer = await fs.promises.readFile(videoPath);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', fileBuffer.length);

    res.send({strBuffer: JSON.stringify(fileBuffer), buffer: fileBuffer.buffer});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:cameraId', async (req, res) => {
    try {
        const { cameraId } = req.params;
        const camera = await Camera.findById(cameraId);
        if (!camera) {
            return res.status(404).send('Camera not found');
        }

        const videoPath = path.join(uploadDir, camera.videoUrl.replace(/^\//, ''));
        const stat = await fs.promises.stat(videoPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const fileStream = fs.createReadStream(videoPath, { start, end });
            const headers = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(206, headers);
            fileStream.pipe(res);
        } else {
            const headers = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(200, headers);
            fs.createReadStream(videoPath).pipe(res);
        }
    } catch (err) {
        console.error('Error streaming video:', err);
        res.status(500).send('Failed to stream video file');
    }
});

export default router;