const app = require('../app')
const connectDB = require('../config/db')

module.exports = async (req, res) => {
  try {
    await connectDB()
    return app(req, res)
  } catch (error) {
    console.error('Vercel DB bootstrap failed:', error.message)
    return res.status(500).send('Database connection failed')
  }
}
