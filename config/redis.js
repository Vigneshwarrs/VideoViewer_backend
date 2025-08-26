import { createClient } from 'redis';

let redisClient;

export const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('Redis Connected');
    
    return redisClient;
  } catch (error) {
    console.error('Redis Connection Error:', error);
    throw error;
  }
};

export const getRedisClient = () => redisClient;

// Redis helper functions
export const cacheCamera = async (camera) => {
  try {
    const key = `camera:${camera.id || camera._id}`;
    await redisClient.setEx(key, 3600, JSON.stringify(camera)); // Cache for 1 hour
    console.log(`Camera cached: ${key}`);
  } catch (error) {
    console.error('Error caching camera:', error);
  }
};

export const getCachedCamera = async (cameraId) => {
  try {
    const key = `camera:${cameraId}`;
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting cached camera:', error);
    return null;
  }
};

export const deleteCachedCamera = async (cameraId) => {
  try {
    const key = `camera:${cameraId}`;
    await redisClient.del(key);
    console.log(`Camera cache deleted: ${key}`);
  } catch (error) {
    console.error('Error deleting cached camera:', error);
  }
};

export const cacheAllCameras = async (cameras) => {
  try {
    await redisClient.setEx('cameras:all', 1800, JSON.stringify(cameras));
    
    // Also cache individual cameras
    for (const camera of cameras) {
      await cacheCamera(camera);
    }
    
    console.log(`${cameras.length} cameras cached`);
  } catch (error) {
    console.error('Error caching cameras:', error);
  }
};