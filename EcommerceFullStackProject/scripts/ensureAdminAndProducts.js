const mongoose = require('mongoose')
const Product = require('../models/product')
const User = require('../models/user')

function required(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

const MONGO = process.env.MONGO_URI // no fallback (safer)

const ALLOW_ADMIN_SEED =
  process.env.ALLOW_ADMIN_SEED === '1' || process.argv.includes('--seed-admin')

async function run() {
  try {
    // Require DB connection string always
    required('MONGO_URI')

    await mongoose.connect(MONGO)
    console.log('Connected to MongoDB')

    const count = await Product.countDocuments()
    console.log('Total products:', count)

    const sample = await Product.findOne()
    console.log('Sample product:', sample ? sample.name : 'None')

    // If admin seeding is NOT allowed, we just report and exit safely
    if (!ALLOW_ADMIN_SEED) {
      console.log(
        'Admin seeding is disabled. (Set ALLOW_ADMIN_SEED=1 or run with --seed-admin to enable.)',
      )
      process.exit(0)
    }

    // If seeding is allowed, require admin env vars
    const ADMIN_EMAIL = required('ADMIN_EMAIL')
    const ADMIN_PASSWORD = required('ADMIN_PASSWORD')
    const ADMIN_NAME = required('ADMIN_NAME')

    let admin = await User.findOne({ email: ADMIN_EMAIL })

    if (admin) {
      console.log('Admin user exists:', admin.email)
      process.exit(0)
    }

    admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
    })

    console.log(`Created admin user: ${admin.email}`)
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

run()
