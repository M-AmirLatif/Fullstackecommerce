const mongoose = require('mongoose')

let cachedConnectionPromise = null
const CONNECT_TIMEOUT_MS = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 30000)

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  if (cachedConnectionPromise) {
    return cachedConnectionPromise
  }

  try {
    mongoose.set('bufferCommands', false)
    cachedConnectionPromise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
      socketTimeoutMS: Math.max(CONNECT_TIMEOUT_MS, 45000),
      maxPoolSize: 5,
    })
    await cachedConnectionPromise
    console.log('MongoDB connected')
    return mongoose.connection
  } catch (error) {
    cachedConnectionPromise = null
    console.error('MongoDB connection failed:', error.message)
    throw error
  }
}

module.exports = connectDB
