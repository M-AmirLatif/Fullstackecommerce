require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/product')

async function update() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  await mongoose.connect(uri)
  console.log('Connected to MongoDB.')

  // Update existing products to precise categories
  await Product.updateOne({ name: /headphones/i }, { $set: { category: 'Audio', featured: true } })
  await Product.updateOne({ name: /speaker/i }, { $set: { category: 'Audio', featured: true } })
  await Product.updateOne({ name: /smart watch/i }, { $set: { category: 'Wearables', featured: true } })
  await Product.updateOne({ name: /wrist watch/i }, { $set: { category: 'Wearables', featured: false } })
  await Product.updateOne({ name: /webcam/i }, { $set: { category: 'Electronics', featured: true } })
  await Product.updateOne({ name: /usb/i }, { $set: { category: 'Accessories', featured: false } })
  await Product.updateOne({ name: /wallet/i }, { $set: { category: 'Accessories', featured: false } })
  await Product.updateOne({ name: /backpack/i }, { $set: { category: 'Accessories', featured: false } })
  await Product.updateOne({ name: /sunglasses/i }, { $set: { category: 'Accessories', featured: false } })
  await Product.updateOne({ name: /cap/i }, { $set: { category: 'Accessories', featured: false } })

  // Check if smartphones exist
  const existingPhones = await Product.find({ category: 'Smartphones' })
  if (existingPhones.length === 0) {
    await Product.create([
      {
        name: 'Samsung Galaxy S24 Ultra (512GB)',
        price: 1199.99,
        originalPrice: 1399.99,
        category: 'Smartphones',
        model: 'Galaxy S24 Ultra AI',
        sku: 'SM-S24U-512',
        image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&auto=format&fit=crop&q=80',
        description: 'Flagship Galaxy smartphone featuring Galaxy AI, titanium frame, 200MP camera, and built-in S Pen with Snapdragon 8 Gen 3.',
        stock: 25,
        inStock: true,
        featured: true,
        rating: 4.9,
        reviewCount: 418,
        colors: ['#333333', '#e5e7eb', '#d4af37'],
        highlights: ['200MP Quad Telephoto Camera', 'Snapdragon 8 Gen 3 for Galaxy', 'Built-in S-Pen & Titanium Frame', '7 Years OS Updates'],
        seoTitle: 'Samsung Galaxy S24 Ultra Titanium - Official Tech Innovation Store',
      },
      {
        name: 'Apple iPhone 15 Pro Max (256GB)',
        price: 1099.99,
        originalPrice: 1199.99,
        category: 'Smartphones',
        model: 'iPhone 15 Pro Max',
        sku: 'APL-IP15PM-256',
        image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80',
        description: 'Aerospace-grade titanium design with A17 Pro chip, customizable Action button, 48MP main camera with 5x telephoto optical zoom.',
        stock: 30,
        inStock: true,
        featured: true,
        rating: 4.9,
        reviewCount: 520,
        colors: ['#4b5563', '#1e293b', '#e2e8f0'],
        highlights: ['A17 Pro chip with 6-core GPU', 'Action button & Super Retina XDR', 'USB-C with USB 3 speeds', '5x Optical Zoom'],
        seoTitle: 'Apple iPhone 15 Pro Max Natural Titanium - Official Tech Store',
      },
      {
        name: 'Google Pixel 8 Pro (128GB)',
        price: 899.99,
        originalPrice: 999.99,
        category: 'Smartphones',
        model: 'Pixel 8 Pro AI',
        sku: 'GOOG-P8P-128',
        image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80',
        description: 'Google Tensor G3 powered flagship phone with advanced Google AI photography, Super Actua display, and all-day battery.',
        stock: 20,
        inStock: true,
        featured: true,
        rating: 4.8,
        reviewCount: 290,
        colors: ['#0f172a', '#38bdf8', '#f1f5f9'],
        highlights: ['Google Tensor G3 & AI Magic Editor', '6.7-inch Super Actua 120Hz display', 'Temperature sensor', 'All-day battery & Fast Charging'],
        seoTitle: 'Google Pixel 8 Pro 128GB - Tech Innovation.pk',
      },
    ])
    console.log('Added flagship smartphones!')
  }

  const distinct = await Product.distinct('category')
  console.log('Updated Distinct Categories:', distinct)
  const total = await Product.countDocuments()
  console.log('Total Products in DB:', total)
  process.exit(0)
}

update().catch((err) => {
  console.error(err)
  process.exit(1)
})
