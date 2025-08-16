/**
 * MongoDB Atlas Connection Module
 * Handles database connection with proper error handling and reconnection logic
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

/**
 * Connect to MongoDB with connection pooling and error handling
 */
const connectDB = async () => {
  try {
    // Check if MongoDB URI is configured
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('placeholder') || process.env.MONGODB_URI.includes('abc123')) {
      logger.warn('⚠️  MongoDB URI not properly configured. Using development fallback mode.');
      logger.info('📝 To configure MongoDB Atlas:');
      logger.info('   1. Create free cluster at https://cloud.mongodb.com');
      logger.info('   2. Get connection string and update MONGODB_URI in .env');
      logger.info('   3. Restart the application');
      return null; // Return null to indicate no database connection
    }

    // Connection options for production-ready setup
    const options = {
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS) || 5000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT_MS) || 30000,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10, // Maximum simultaneous connections
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,  // Minimum maintained connections
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
      heartbeatFrequencyMS: 20000, // Send heartbeat every 20 seconds
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    
    logger.info(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                            MongoDB Atlas Connected                           ║
║                                                                              ║
║  🌍 Host: ${conn.connection.host}                                            ║
║  🗄️  Database: ${conn.connection.name}                                       ║
║  🔗 Connection State: ${getConnectionState(conn.connection.readyState)}      ║
║  📊 Pool Size: Min ${options.minPoolSize} | Max ${options.maxPoolSize}      ║
║  ⏰ Connected at: ${new Date().toISOString()}                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
    `);

    // Log connection events
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB Atlas: Connection established successfully');
    });

    mongoose.connection.on('error', (error) => {
      logger.error(`MongoDB Atlas: Connection error - ${error.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB Atlas: Connection lost. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB Atlas: Successfully reconnected');
    });

    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB Atlas: Connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error(`Database Connection Error: ${error.message}`);
    
    // Enhanced error messages for common connection issues
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      logger.error('❌ Network Error: Check your internet connection and MongoDB Atlas cluster status');
    } else if (error.message.includes('Authentication failed')) {
      logger.error('❌ Authentication Error: Check your MongoDB Atlas credentials in .env file');
    } else if (error.message.includes('IP not whitelisted')) {
      logger.error('❌ Access Error: Add your IP address to MongoDB Atlas Network Access whitelist');
    } else if (error.message.includes('Server selection timed out')) {
      logger.error('❌ Timeout Error: MongoDB Atlas cluster may be paused or unreachable');
    }
    
    logger.error('💡 Troubleshooting:');
    logger.error('   1. Verify MONGODB_URI in .env file');
    logger.error('   2. Check MongoDB Atlas cluster status');
    logger.error('   3. Ensure IP address is whitelisted');
    logger.error('   4. Verify database credentials');
    
    process.exit(1); // Exit with failure
  }
};

/**
 * Get human-readable connection state
 */
const getConnectionState = (state) => {
  const states = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting',
    99: 'Uninitialized'
  };
  return states[state] || 'Unknown';
};

/**
 * Get database connection statistics
 */
export const getDBStats = async () => {
  try {
    const db = mongoose.connection.db;
    const admin = db.admin();
    
    const [serverStatus, dbStats] = await Promise.all([
      admin.serverStatus(),
      db.stats()
    ]);

    return {
      connectionState: getConnectionState(mongoose.connection.readyState),
      host: mongoose.connection.host,
      database: mongoose.connection.name,
      serverInfo: {
        version: serverStatus.version,
        uptime: serverStatus.uptime,
        connections: serverStatus.connections
      },
      dbStats: {
        collections: dbStats.collections,
        documents: dbStats.objects,
        dataSize: `${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`,
        indexSize: `${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`,
        storageSize: `${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`
      }
    };
  } catch (error) {
    logger.error('Failed to get database statistics:', error);
    return {
      connectionState: getConnectionState(mongoose.connection.readyState),
      error: error.message
    };
  }
};

/**
 * Test database connection
 */
export const testConnection = async () => {
  try {
    await mongoose.connection.db.admin().ping();
    return { success: true, message: 'Database connection is healthy' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export default connectDB;
