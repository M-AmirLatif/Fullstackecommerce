const mongoose = require('mongoose')
const Product = require('../models/product')
const User = require('../models/user')

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce'

async function run() {
  try {
    await mongoose.connect(MONGO)
    console.log('Connected to MongoDB')

    const count = await Product.countDocuments()
    console.log('Total products:', count)
    const sample = await Product.findOne()
    if (sample) {
      console.log('Sample product:', {
        name: sample.name,
        price: sample.price,
        category: sample.category,
        image: sample.image,
        stock: sample.stock,
        inStock: sample.inStock,
      })
    } else {
      console.log('No products found in DB')
    }

    const adminEmail = 'admin@shop.com'
    let admin = await User.findOne({ email: adminEmail })
    if (admin) {
      console.log('Admin user exists:', admin.email)
    } else {
      admin = await User.create({
        name: 'Admin',
        email: adminEmail,
        password: 'admin123',
        role: 'admin',
      })
      console.log('Created admin user:', admin.email, '(password: admin123)')
    }

    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

run()
