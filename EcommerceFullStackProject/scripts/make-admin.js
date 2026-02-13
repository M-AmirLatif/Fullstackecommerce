const path = require('path')
const mongoose = require('mongoose')

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  override: process.env.NODE_ENV !== 'production',
})

const User = require('../models/user')

const email = process.argv[2]
if (!email) {
  console.error('Usage: npm run make-admin -- user@example.com')
  process.exit(1)
}

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is required')
    }

    await mongoose.connect(process.env.MONGO_URI)

    const user = await User.findOneAndUpdate(
      { email },
      { role: 'admin' },
      { new: true },
    )

    if (!user) {
      console.error('User not found:', email)
      process.exit(1)
    }

    console.log('User promoted to admin:', user.email)
    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('MAKE ADMIN ERROR:', err.message)
    try {
      await mongoose.disconnect()
    } catch (disconnectErr) {
      console.error('DISCONNECT ERROR:', disconnectErr.message)
    }
    process.exit(1)
  }
}

run()
