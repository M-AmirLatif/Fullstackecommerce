require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/product')

async function importProducts() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGO_URI is not set in environment.')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('Connected to MongoDB for Product Import.')

  const categoriesToFetch = [
    'smartphones',
    'laptops',
    'tablets',
    'mobile-accessories',
    'mens-watches',
    'womens-watches',
    'sunglasses',
    'mens-shoes',
    'mens-shirts',
  ]

  let allImported = 0

  for (const catSlug of categoriesToFetch) {
    try {
      console.log(`Fetching category: ${catSlug}...`)
      const res = await fetch(`https://dummyjson.com/products/category/${catSlug}?limit=30`)
      if (!res.ok) {
        console.warn(`Failed to fetch ${catSlug}: ${res.statusText}`)
        continue
      }
      const data = await res.json()
      const rawProducts = data.products || []

      for (const p of rawProducts) {
        let storeCategory = 'Electronics'

        if (catSlug === 'smartphones') {
          storeCategory = 'Smartphones'
        } else if (catSlug === 'laptops' || catSlug === 'tablets') {
          storeCategory = 'Electronics'
        } else if (catSlug === 'mens-watches' || catSlug === 'womens-watches') {
          storeCategory = 'Wearables'
        } else if (catSlug === 'sunglasses') {
          storeCategory = 'Accessories'
        } else if (catSlug === 'mens-shoes') {
          storeCategory = 'Shoes'
        } else if (catSlug === 'mens-shirts') {
          storeCategory = 'Clothing'
        } else if (catSlug === 'mobile-accessories') {
          const lowerTitle = (p.title || '').toLowerCase()
          if (/airpod|headphone|earbud|speaker|echo|sound|audio/i.test(lowerTitle)) {
            storeCategory = 'Audio'
          } else {
            storeCategory = 'Accessories'
          }
        }

        const price = Number(Number(p.price || 29.99).toFixed(2))
        const discount = Number(p.discountPercentage || 0)
        const originalPrice = discount > 0
          ? Number((price / (1 - discount / 100)).toFixed(2))
          : Number((price * 1.2).toFixed(2))

        const imageUrl = p.thumbnail || (p.images && p.images[0]) || '/images/placeholder.png'
        const rating = Math.min(5.0, Math.max(4.2, Number((p.rating || 4.5).toFixed(1))))
        const reviewCount = (p.reviews && p.reviews.length * 35) || Math.floor(Math.random() * 150) + 45
        const stock = Math.max(12, Number(p.stock) || 25)
        const isFeatured = discount > 12 || rating >= 4.7 || price > 500

        const productDoc = {
          name: p.title,
          price,
          originalPrice,
          category: storeCategory,
          model: p.brand || p.title,
          sku: p.sku || `SKU-${p.id}-${Math.floor(Math.random() * 1000)}`,
          image: imageUrl,
          description: p.description || `${p.title} with premium build quality and genuine warranty.`,
          stock,
          inStock: true,
          featured: isFeatured,
          rating,
          reviewCount,
          colors: ['#0f172a', '#2563eb', '#e2e8f0', '#f97316'],
          highlights: (p.tags && p.tags.length > 0)
            ? p.tags.map(t => t.charAt(0).toUpperCase() + t.slice(1))
            : ['100% Genuine Quality', 'Warranty Included', 'Fast Express Shipping across Pakistan'],
          seoTitle: `${p.title} - Official Tech Innovation Store`,
          tags: p.tags || [storeCategory.toLowerCase(), 'tech', 'gadgets'],
        }

        await Product.findOneAndUpdate(
          { name: p.title },
          { $set: productDoc },
          { upsert: true, new: true }
        )
        allImported++
      }
    } catch (catErr) {
      console.error(`Error processing ${catSlug}:`, catErr.message)
    }
  }

  console.log(`\n✅ Finished! Successfully synced ${allImported} products into database.`)
  const totalInDb = await Product.countDocuments()
  const catCounts = await Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
  console.log(`Total Products in DB: ${totalInDb}`)
  console.log('Category breakdown:', catCounts)

  process.exit(0)
}

importProducts().catch(err => {
  console.error('Fatal import error:', err)
  process.exit(1)
})
