require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const Product = require('../models/product')

const products = [
  // Electronics
  {
    name: 'Wireless Headphones',
    price: 129.99,
    category: 'Electronics',
    image: '/images/wireless_headphones.webp',
    description:
      'Premium noise-cancelling wireless headphones with 30-hour battery life',
    stock: 45,
    inStock: true,
  },
  {
    name: 'Smart Watch',
    price: 299.99,
    category: 'Electronics',
    image: '/images/smart_watches.webp',
    description:
      'Advanced smartwatch with fitness tracking and heart rate monitor',
    stock: 32,
    inStock: true,
  },
  {
    name: 'USB-C Cable',
    price: 12.99,
    category: 'Electronics',
    image: '/images/usb.png',
    description: 'Fast charging USB-C cable, 6ft length',
    stock: 150,
    inStock: true,
  },
  {
    name: 'Portable Speaker',
    price: 79.99,
    category: 'Electronics',
    image: '/images/speaker.webp',
    description: 'Waterproof Bluetooth speaker with 360° sound',
    stock: 28,
    inStock: true,
  },
  {
    name: '4K Webcam',
    price: 159.99,
    category: 'Electronics',
    image: '/images/webcam.jpg',
    description: 'Ultra HD 4K webcam for streaming and video calls',
    stock: 18,
    inStock: true,
  },

  // Clothing
  {
    name: 'Cotton T-Shirt',
    price: 24.99,
    category: 'Clothing',
    image: '/images/cotton_tshirt.jpg',
    description: '100% premium cotton t-shirt, available in multiple colors',
    stock: 85,
    inStock: true,
  },
  {
    name: 'Denim Jeans',
    price: 59.99,
    category: 'Clothing',
    image: '/images/jeans.webp',
    description: 'Classic blue denim jeans, comfortable fit',
    stock: 62,
    inStock: true,
  },
  {
    name: 'Casual Hoodie',
    price: 49.99,
    category: 'Clothing',
    image: '/images/hoodie.jpg',
    description: 'Soft fleece hoodie perfect for any season',
    stock: 44,
    inStock: true,
  },
  {
    name: 'Running Shoes',
    price: 89.99,
    category: 'Clothing',
    image: '/images/shoes.jpg',
    description: 'Professional running shoes with cushioned sole',
    stock: 56,
    inStock: true,
  },
  {
    name: 'Winter Jacket',
    price: 129.99,
    category: 'Clothing',
    image: '/images/jacket.jpg',
    description: 'Warm waterproof winter jacket',
    stock: 35,
    inStock: true,
  },

  // Accessories
  {
    name: 'Leather Wallet',
    price: 34.99,
    category: 'Accessories',
    image: '/images/wallet.jpg',
    description: 'Genuine leather bifold wallet with RFID protection',
    stock: 72,
    inStock: true,
  },
  {
    name: 'Sunglasses',
    price: 79.99,
    category: 'Accessories',
    image: '/images/sunglasses.webp',
    description: 'UV protection polarized sunglasses',
    stock: 48,
    inStock: true,
  },
  {
    name: 'Baseball Cap',
    price: 19.99,
    category: 'Accessories',
    image: '/images/cap.jpg',
    description: 'Classic baseball cap in various colors',
    stock: 94,
    inStock: true,
  },
  {
    name: 'Backpack',
    price: 64.99,
    category: 'Accessories',
    image: '/images/bagpack.jpg',
    description: 'Durable 30L laptop backpack with USB port',
    stock: 38,
    inStock: true,
  },
  {
    name: 'Wrist Watch',
    price: 89.99,
    category: 'Accessories',
    image: '/images/wristwatch.jpg',
    description: 'Elegant stainless steel analog wristwatch',
    stock: 52,
    inStock: true,
  },
]

async function seedDatabase() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce',
    )
    console.log('MongoDB connected')

    await Product.deleteMany({})
    console.log('Previous products cleared')

    await Product.insertMany(products)
    console.log(`${products.length} products seeded successfully`)

    await mongoose.connection.close()
  } catch (err) {
    console.error('Seeding error:', err.message)
    process.exit(1)
  }
}

seedDatabase()
