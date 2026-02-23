const express = require('express')
const router = express.Router()

const Product = require('../models/product')
const Order = require('../models/order')
const { adminOnly } = require('../middleware/auth')

router.use(adminOnly)

function normalizeImagePath(image) {
  if (!image) return image
  if (/^https?:\/\//i.test(image)) return image

  let img = image.replaceAll('\\', '/').trim()
  img = img.replace(/^public\//, '')

  if (!img.startsWith('/')) img = `/${img}`
  if (!img.startsWith('/images/')) img = `/images/${img.replace(/^\//, '')}`

  return img
}

function parseList(value) {
  if (!value) return []
  return String(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function clampRating(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return 0
  return Math.min(5, Math.max(0, n))
}

router.get('/', (req, res) => {
  res.render('admin/dashboard', { layout: 'admin/layout' })
})

router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 })
    res.render('admin/orders', { orders })
  } catch (err) {
    console.error(err)
    res.status(500).send('Failed to load orders')
  }
})

router.post('/orders/:id/ship', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      return res.status(404).send('Order not found')
    }
    if (order.status !== 'Paid' && order.status !== 'Confirmed') {
      return res.status(400).send('Order is not ready to ship')
    }
    order.status = 'Shipped'
    await order.save()
    res.redirect('/admin/orders')
  } catch (err) {
    console.error(err)
    res.status(500).send('Failed to mark order as shipped')
  }
})

router.post('/orders/:id/deliver', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      return res.status(404).send('Order not found')
    }
    if (order.status !== 'Shipped') {
      return res.status(400).send('Order is not shipped yet')
    }
    order.status = 'Delivered'
    await order.save()
    res.redirect('/admin/orders')
  } catch (err) {
    console.error(err)
    res.status(500).send('Failed to mark order as delivered')
  }
})

router.post('/orders/:id/cancel', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      return res.status(404).send('Order not found')
    }
    if (!['Pending', 'Paid', 'Confirmed'].includes(order.status)) {
      return res.status(400).send('Order cannot be cancelled')
    }
    order.status = 'Cancelled'
    await order.save()
    res.redirect('/admin/orders')
  } catch (err) {
    console.error(err)
    res.status(500).send('Failed to cancel order')
  }
})

router.get('/products', async (req, res) => {
  try {
    const products = await Product.find()
    res.render('admin/products/list', {
      layout: 'admin/layout',
      products,
    })
  } catch (error) {
    console.error(error)
    res.status(500).send('Failed to load products')
  }
})

router.get('/products/add', (req, res) => {
  res.render('admin/products/add', {
    layout: 'admin/layout',
  })
})

router.post('/products/add', async (req, res) => {
  try {
    const {
      name,
      price,
      originalPrice,
      category,
      model,
      sku,
      description,
      image,
      stock,
      inStock,
      rating,
      reviewCount,
      colors,
      highlights,
      seoTitle,
      tags,
      faqs,
    } = req.body

    const priceNum = Number(price)
    const originalNum = Number(originalPrice)

    const stockNum = Number(stock) || 0
    const inStockValue = inStock === 'true' && stockNum > 0

    await Product.create({
      name,
      price: priceNum,
      originalPrice: originalNum > priceNum ? originalNum : null,
      category,
      model: String(model || '').trim(),
      sku: String(sku || '').trim(),
      description,
      image: normalizeImagePath(image),
      stock: stockNum,
      inStock: inStockValue,
      rating: clampRating(rating) || 0,
      reviewCount: Math.max(0, Number(reviewCount) || 0),
      colors: parseList(colors),
      highlights: parseList(highlights),
      seoTitle,
      tags: parseList(tags),
      faqs: parseList(faqs),
    })

    res.redirect('/admin/products')
  } catch (error) {
    console.error(error)
    res.status(500).send('Failed to add product')
  }
})

router.get('/products/edit/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    res.render('admin/products/edit', {
      layout: 'admin/layout',
      product,
    })
  } catch (error) {
    console.error(error)
    res.status(500).send('Failed to load product')
  }
})

router.post('/products/edit/:id', async (req, res) => {
  try {
    const {
      name,
      price,
      originalPrice,
      category,
      model,
      sku,
      description,
      image,
      stock,
      inStock,
      rating,
      reviewCount,
      colors,
      highlights,
      seoTitle,
      tags,
      faqs,
    } = req.body

    const priceNum = Number(price)
    const originalNum = Number(originalPrice)

    const stockNum = Number(stock) || 0
    const inStockValue = inStock === 'true' && stockNum > 0

    await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        price: priceNum,
        originalPrice: originalNum > priceNum ? originalNum : null,
        category,
        model: String(model || '').trim(),
        sku: String(sku || '').trim(),
        description,
        image: normalizeImagePath(image),
        stock: stockNum,
        inStock: inStockValue,
        rating: clampRating(rating) || 0,
        reviewCount: Math.max(0, Number(reviewCount) || 0),
        colors: parseList(colors),
        highlights: parseList(highlights),
        seoTitle,
        tags: parseList(tags),
        faqs: parseList(faqs),
      },
      {
        runValidators: true,
        new: true,
      },
    )

    res.redirect('/admin/products')
  } catch (error) {
    console.error(error)
    res.status(500).send(error.message)
  }
})

router.get('/products/delete/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id)
    res.redirect('/admin/products')
  } catch (error) {
    console.error(error)
    res.status(500).send('Failed to delete product')
  }
})

module.exports = router
