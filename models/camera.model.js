import mongoose from 'mongoose';

const cameraSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  location: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  videoUrl: {
    type: String,
    required: true
  },
  videoFileName: {
    type: String
  },
  videoFileSize: {
    type: Number
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance'],
    default: 'online'
  },
  resolution: {
    type: String,
    required: true,
    enum: ['640x480', '1280x720', '1920x1080', '2560x1440', '3840x2160']
  },
  frameRate: {
    type: Number,
    required: true,
    min: 15,
    max: 60
  },
  isRecording: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastAccessedAt: {
    type: Date
  },
  playCount: {
    type: Number,
    default: 0
  },
  totalPlayTime: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
cameraSchema.index({ name: 1 });
cameraSchema.index({ location: 1 });
cameraSchema.index({ status: 1 });
cameraSchema.index({ createdBy: 1 });
cameraSchema.index({ createdAt: -1 });

export const Camera = mongoose.model('Camera', cameraSchema);