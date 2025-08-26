import mqtt from 'mqtt';

let mqttClient;

export const connectMQTT = async () => {
  try {
    mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883');

    mqttClient.on('connect', () => {
      console.log('MQTT Connected');
      
      // Subscribe to video events topic
      mqttClient.subscribe(process.env.MQTT_TOPIC || 'video/events', (err) => {
        if (err) {
          console.error('MQTT Subscription Error:', err);
        } else {
          console.log(`Subscribed to topic: ${process.env.MQTT_TOPIC || 'video/events'}`);
        }
      });
    });

    mqttClient.on('error', (error) => {
      console.error('MQTT Connection Error:', error);
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`MQTT Message received on ${topic}:`, data);
        
        handleMQTTMessage(topic, data);
      } catch (error) {
        console.error('Error parsing MQTT message:', error);
      }
    });

    return mqttClient;
  } catch (error) {
    console.error('MQTT Connection Error:', error);
    throw error;
  }
};

export const getMqttClient = () => mqttClient;

export const publishEvent = (eventType, data) => {
  try {
    if (!mqttClient) {
      console.warn('MQTT client not connected');
      return;
    }

    const payload = {
      eventType,
      data,
      timestamp: new Date().toISOString(),
      source: 'video-management-api'
    };

    const topic = process.env.MQTT_TOPIC || 'video/events';
    mqttClient.publish(topic, JSON.stringify(payload), (err) => {
      if (err) {
        console.error('Error publishing MQTT message:', err);
      } else {
        console.log(`Published ${eventType} event to MQTT`);
      }
    });
  } catch (error) {
    console.error('Error in publishEvent:', error);
  }
};

export const handleMQTTMessage = async (topic, data) => {
  try {
    const { getPgClient } = await import('./db.js');
    const pgClient = getPgClient();
    
    if (!pgClient) {
      console.warn('PostgreSQL client not available');
      return;
    }

    // Log the event to TimescaleDB
    switch (data.eventType) {
      case 'camera_created':
      case 'camera_updated':
      case 'camera_deleted':
        await pgClient.query(
          'INSERT INTO camera_activity (camera_id, camera_name, user_id, username, action, details) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            data.data.cameraId || data.data.id,
            data.data.name || 'Unknown',
            data.data.userId || 'system',
            data.data.username || 'system',
            data.eventType.replace('camera_', ''),
            JSON.stringify(data.data)
          ]
        );
        break;

      case 'video_action':
        await pgClient.query(
          'INSERT INTO video_player_logs (session_id, camera_id, user_id, action, position, duration) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            data.data.sessionId || 'unknown',
            data.data.cameraId,
            data.data.userId,
            data.data.action,
            data.data.position || null,
            data.data.duration || null
          ]
        );
        break;

      case 'user_login':
        await pgClient.query(
          'INSERT INTO login_activity (user_id, username, ip_address, user_agent, success) VALUES ($1, $2, $3, $4, $5)',
          [
            data.data.userId,
            data.data.username,
            data.data.ipAddress || null,
            data.data.userAgent || null,
            data.data.success !== false
          ]
        );
        break;

      default:
        console.log(`Unhandled MQTT event type: ${data.eventType}`);
    }

  } catch (error) {
    console.error('Error handling MQTT message:', error);
  }
};