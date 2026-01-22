require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const Product = require('../models/product')

const products = [
  // Electronics
  {
    name: 'Wireless Headphones',
    price: 129.99,
    category: 'Electronics',
    image:
      'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=500&q=80',
    description:
      'Premium noise-cancelling wireless headphones with 30-hour battery life',
    stock: 45,
    inStock: true,
  },
  {
    name: 'Smart Watch',
    price: 299.99,
    category: 'Electronics',
    image:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
    description:
      'Advanced smartwatch with fitness tracking and heart rate monitor',
    stock: 32,
    inStock: true,
  },
  {
    name: 'USB-C Cable',
    price: 12.99,
    category: 'Electronics',
    image:
      'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500&q=80',
    description: 'Fast charging USB-C cable, 6ft length',
    stock: 150,
    inStock: true,
  },
  {
    name: 'Portable Speaker',
    price: 79.99,
    category: 'Electronics',
    image:
      'https://images.unsplash.com/photo-1589003077984-894e133dba90?w=500&q=80',
    description: 'Waterproof Bluetooth speaker with 360° sound',
    stock: 28,
    inStock: true,
  },
  {
    name: '4K Webcam',
    price: 159.99,
    category: 'Electronics',
    image:
      'https://images.unsplash.com/photo-1611532736579-6b16e2b50449?w=500&q=80',
    description: 'Ultra HD 4K webcam for streaming and video calls',
    stock: 18,
    inStock: true,
  },

  // Clothing
  {
    name: 'Cotton T-Shirt',
    price: 24.99,
    category: 'Clothing',
    image:
      'https://images.unsplash.com/photo-1503341455253-b2b723bb12d5?w=500&q=80',
    description: '100% premium cotton t-shirt, available in multiple colors',
    stock: 85,
    inStock: true,
  },
  {
    name: 'Denim Jeans',
    price: 59.99,
    category: 'Clothing',
    image:
      'https://images.unsplash.com/photo-1542272604-787c62e4b9f7?w=500&q=80',
    description: 'Classic blue denim jeans, comfortable fit',
    stock: 62,
    inStock: true,
  },
  {
    name: 'Casual Hoodie',
    price: 49.99,
    category: 'Clothing',
    image:
      'https://images.unsplash.com/photo-1513246905681-42646e7b7c71?w=500&q=80',
    description: 'Soft fleece hoodie perfect for any season',
    stock: 44,
    inStock: true,
  },
  {
    name: 'Running Shoes',
    price: 89.99,
    category: 'Clothing',
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80',
    description: 'Professional running shoes with cushioned sole',
    stock: 56,
    inStock: true,
  },
  {
    name: 'Winter Jacket',
    price: 129.99,
    category: 'Clothing',
    image:
      'https://images.unsplash.com/photo-1495886657535-62e74f8f2785?w=500&q=80',
    description: 'Warm waterproof winter jacket',
    stock: 35,
    inStock: true,
  },

  // Accessories
  {
    name: 'Leather Wallet',
    price: 34.99,
    category: 'Accessories',
    image:
      'https://images.unsplash.com/photo-1627123736496-cf4ee70b1da8?w=500&q=80',
    description: 'Genuine leather bifold wallet with RFID protection',
    stock: 72,
    inStock: true,
  },
  {
    name: 'Sunglasses',
    price: 79.99,
    category: 'Accessories',
    image:
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&q=80',
    description: 'UV protection polarized sunglasses',
    stock: 48,
    inStock: true,
  },
  {
    name: 'Baseball Cap',
    price: 19.99,
    category: 'Accessories',
    image:
      'https://images.unsplash.com/photo-1505628346881-b72b27e84530?w=500&q=80',
    description: 'Classic baseball cap in various colors',
    stock: 94,
    inStock: true,
  },
  {
    name: 'Backpack',
    price: 64.99,
    category: 'Accessories',
    image:
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80',
    description: 'Durable 30L laptop backpack with USB port',
    stock: 38,
    inStock: true,
  },
  {
    name: 'Wrist Watch',
    price: 89.99,
    category: 'Accessories',
    image:
      'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=500&q=80',
    description: 'Elegant stainless steel analog wristwatch',
    stock: 52,
    inStock: true,
  },
]

async function seedData() {
  try {
    await mongoose.connect(process.env.MONGO_URI)

    // Clear existing products
    await Product.deleteMany({})

    // Insert new products with stock and inStock fields
    await Product.insertMany(products)

    console.log(`✅ Successfully seeded ${products.length} products!`)
    process.exit()
  } catch (error) {
    console.error('❌ Error seeding products:', error)
    process.exit(1)
  }
}

seedData()
