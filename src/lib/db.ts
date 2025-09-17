import mongoose from 'mongoose';

interface MongoConnection {
  isConnected: boolean;
  connection: typeof mongoose | null;
}

const connection: MongoConnection = {
  isConnected: false,
  connection: null
};

export async function connectToDatabase(): Promise<typeof mongoose> {
  // Return existing connection if available
  if (connection.isConnected && connection.connection) {
    return connection.connection;
  }

  // Validate environment
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    // Disconnect any existing connections in serverless environment
    if (mongoose.connections[0].readyState !== 0) {
      await mongoose.disconnect();
    }

    // Connect with optimized settings for Vercel serverless
    const db = await mongoose.connect(mongoUri, {
      bufferCommands: false,
      maxPoolSize: 1, // Limit connections for serverless
      serverSelectionTimeoutMS: 5000, // 5 second timeout
      socketTimeoutMS: 45000, // 45 second socket timeout
    });

    connection.isConnected = true;
    connection.connection = db;

    console.log('MongoDB connected successfully');
    return db;
  } catch (error) {
    connection.isConnected = false;
    connection.connection = null;
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export function isConnected(): boolean {
  return connection.isConnected && mongoose.connection.readyState === 1;
}

export async function disconnectDatabase(): Promise<void> {
  if (connection.isConnected && connection.connection) {
    await mongoose.disconnect();
    connection.isConnected = false;
    connection.connection = null;
  }
}