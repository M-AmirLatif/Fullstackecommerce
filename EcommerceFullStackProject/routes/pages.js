const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const mongoose = require('mongoose')

router.get('/', async (req, res) => {
  try {
    // Fetch featured products (first 8 from DB)
    const products = await Product.find().limit(8)

    // Fetch best sellers (could be sorted by sales if tracking exists)
    const bestSellers = await Product.find().limit(4)

    res.render('pages/home', {
      products,
      bestSellers,
    })
  } catch (error) {
    console.error(error)
    res.render('pages/home', {
      products: [],
      bestSellers: [],
    })
  }
})

router.get('/login', (req, res) => {
  res.render('pages/login')
})

router.get('/register', (req, res) => {
  res.render('pages/register')
})

router.get('/shop', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 12
    const skip = (page - 1) * limit

    const { category, minPrice, maxPrice } = req.query

    let query = {}

    if (category) {
      query.category = category
    }

    if (minPrice || maxPrice) {
      query.price = {}
      if (minPrice) query.price.$gte = Number(minPrice)
      if (maxPrice) query.price.$lte = Number(maxPrice)
    }

    const totalProducts = await Product.countDocuments(query)
    const products = await Product.find(query).skip(skip).limit(limit)

    // Fetch unique categories for filter dropdown
    const categories = await Product.distinct('category')

    const totalPages = Math.ceil(totalProducts / limit)

    res.render('pages/shop', {
      products,
      currentPage: page,
      totalPages,
      limit,
      category,
      minPrice,
      maxPrice,
      categories,
      selectedCategory: category || '',
    })
  } catch (error) {
    console.error(error)
    res.status(500).send('Failed to load products')
  }
})

router.get('/product/:id', async (req, res) => {
  try {
    // ✅ guard invalid ids so it doesn't throw
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).render('error', { message: 'Product not found' })
    }

    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).render('error', {
        message: 'Product not found',
      })
    }

    res.render('pages/product', {
      product, // Pass the product data to the template
    })
  } catch (error) {
    console.error(error)
    res.status(500).render('error', {
      message: 'Failed to load product',
    })
  }
})

module.exports = router
