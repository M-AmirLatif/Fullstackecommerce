const app = require('../app')
const connectDB = require('../config/db')

module.exports = async (req, res) => {
  try {
    await connectDB()
  } catch (error) {
    console.warn('Vercel initial DB connect note:', error.message)
  }
  return app(req, res)
}
