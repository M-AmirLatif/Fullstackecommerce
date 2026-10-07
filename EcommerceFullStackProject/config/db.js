const mongoose = require('mongoose')

let cached = global.mongoose
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

const CONNECT_TIMEOUT_MS = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 30000)

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn
  }

  if (!cached.promise || mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    const opts = {
      serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
      socketTimeoutMS: Math.max(CONNECT_TIMEOUT_MS, 45000),
      maxPoolSize: 10,
      bufferCommands: true,
    }

    cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then((m) => {
      cached.conn = m
      console.log('MongoDB connected successfully')
      return m
    }).catch((err) => {
      cached.promise = null
      cached.conn = null
      console.error('MongoDB connection error:', err.message)
      throw err
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    cached.conn = null
    throw e
  }

  return cached.conn
}

module.exports = connectDB
