require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/product')

async function verifyCategories() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  await mongoose.connect(uri)

  const testCategories = [
    'Smartphones',
    'Audio',
    'Wearables',
    'Accessories',
    'Electronics',
    'Clothing',
    'Shoes',
  ]

  console.log('--- TESTING CATEGORY FILTERS ---')
  for (const cat of testCategories) {
    const catLower = cat.toLowerCase()
    let cond = {}

    if (['smartphones', 'smartphone', 'phones', 'phone', 'mobile'].includes(catLower)) {
      cond = {
        $or: [
          { category: /^smartphones?/i },
          { category: /^phones?/i },
          { name: /\bphones?\b|smartphone|galaxy|iphone|pixel|redmi|mobile/i },
        ],
      }
    } else if (['audio', 'audio & sound', 'sound', 'headphones', 'speakers'].includes(catLower)) {
      cond = {
        $or: [
          { category: /^audio/i },
          { category: /^sound/i },
          { name: /headphone|speaker|earbud|airpod|sound|audio/i },
        ],
      }
    } else if (['wearables', 'wearable', 'smartwatches', 'smartwatch', 'watches', 'watch'].includes(catLower)) {
      cond = {
        $or: [
          { category: /^(wearables?|smartwatches?|watches?)/i },
          { name: /watch|band|wearable|tracker/i },
        ],
      }
    } else if (['accessories', 'accessory'].includes(catLower)) {
      cond = {
        $or: [
          { category: /^accessories/i },
          { name: /cable|charger|adapter|wallet|sunglasses|backpack|cap|case/i },
        ],
      }
    } else if (['electronics', 'electronic', 'gadgets'].includes(catLower)) {
      cond = {
        $or: [
          { category: /^electronics/i },
          { name: /webcam|speaker|watch|cable|charger|camera|keyboard/i },
        ],
      }
    } else {
      cond = { category: new RegExp(`^${cat}$`, 'i') }
    }

    const prods = await Product.find(cond)
    console.log(`Category: "${cat}" -> ${prods.length} products found:`, prods.map(p => p.name))
  }

  const featured = await Product.find({
    $or: [{ featured: true }, { $expr: { $gt: ['$originalPrice', '$price'] } }],
  })
  console.log(`Deals / Featured -> ${featured.length} products found.`)

  process.exit(0)
}

verifyCategories().catch(console.error)
