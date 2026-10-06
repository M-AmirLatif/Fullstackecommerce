const express = require('express')
const router = express.Router()

const Product = require('../models/product')
const Order = require('../models/order')
const { adminOnly } = require('../middleware/auth')

router.use(adminOnly)

// Defensive route: if a client/proxy replays a POST to /admin after login,
// normalize it to the dashboard GET instead of falling through to 404.
router.post('/', (req, res) => {
  res.redirect(303, '/admin')
})

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

router.get('/', async (req, res) => {
  try {
    const productCount = await Product.countDocuments()
    const orderCount = await Order.countDocuments()
    const pendingOrdersCount = await Order.countDocuments({
      status: { $in: ['Pending', 'pending'] },
    })

    const ordersWithRevenue = await Order.find({
      status: { $nin: ['Cancelled', 'cancelled'] },
    })
    const totalRevenue = ordersWithRevenue.reduce(
      (sum, ord) => sum + (Number(ord.totalAmount) || 0),
      0,
    )

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5)
    const recentProducts = await Product.find().sort({ createdAt: -1 }).limit(5)

    res.render('admin/dashboard', {
      layout: 'admin/layout',
      productCount,
      orderCount,
      pendingOrdersCount,
      totalRevenue,
      recentOrders,
      recentProducts,
    })
  } catch (err) {
    console.error('ADMIN DASHBOARD ERROR:', err)
    res.render('admin/dashboard', {
      layout: 'admin/layout',
      productCount: 0,
      orderCount: 0,
      pendingOrdersCount: 0,
      totalRevenue: 0,
      recentOrders: [],
      recentProducts: [],
    })
  }
})

router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 })
    res.render('admin/orders', { orders })
  } catch (err) {
    console.error(err)
    req.session.flash = { type: 'error', text: 'Failed to load orders' }
    res.redirect('/admin')
  }
})

router.post('/orders/:id/ship', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      req.session.flash = { type: 'error', text: 'Order not found' }
      return res.redirect('/admin/orders')
    }
    if (order.status !== 'Paid' && order.status !== 'Confirmed' && order.status !== 'Pending') {
      req.session.flash = { type: 'error', text: 'Order is not ready to ship' }
      return res.redirect('/admin/orders')
    }
    order.status = 'Shipped'
    await order.save()
    req.session.flash = { type: 'success', text: `Order #${order._id.toString().slice(-6).toUpperCase()} marked as Shipped 🚚` }
    res.redirect('/admin/orders')
  } catch (err) {
    console.error(err)
    req.session.flash = { type: 'error', text: 'Failed to mark order as shipped' }
    res.redirect('/admin/orders')
  }
})

router.post('/orders/:id/deliver', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      req.session.flash = { type: 'error', text: 'Order not found' }
      return res.redirect('/admin/orders')
    }
    if (order.status !== 'Shipped') {
      req.session.flash = { type: 'error', text: 'Order is not shipped yet' }
      return res.redirect('/admin/orders')
    }
    order.status = 'Delivered'
    await order.save()
    req.session.flash = { type: 'success', text: `Order #${order._id.toString().slice(-6).toUpperCase()} marked as Delivered ✅` }
    res.redirect('/admin/orders')
  } catch (err) {
    console.error(err)
    req.session.flash = { type: 'error', text: 'Failed to mark order as delivered' }
    res.redirect('/admin/orders')
  }
})

router.post('/orders/:id/cancel', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      req.session.flash = { type: 'error', text: 'Order not found' }
      return res.redirect('/admin/orders')
    }
    if (!['Pending', 'Paid', 'Confirmed', 'Shipped'].includes(order.status)) {
      req.session.flash = { type: 'error', text: 'Order cannot be cancelled' }
      return res.redirect('/admin/orders')
    }
    order.status = 'Cancelled'
    await order.save()
    req.session.flash = { type: 'success', text: `Order #${order._id.toString().slice(-6).toUpperCase()} has been Cancelled` }
    res.redirect('/admin/orders')
  } catch (err) {
    console.error(err)
    req.session.flash = { type: 'error', text: 'Failed to cancel order' }
    res.redirect('/admin/orders')
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

    req.session.flash = { type: 'success', text: `Product "${name}" added successfully! ✨` }
    res.redirect('/admin/products')
  } catch (error) {
    console.error(error)
    req.session.flash = { type: 'error', text: 'Failed to add product: ' + (error.message || 'Validation error') }
    res.redirect('/admin/products/add')
  }
})

router.get('/products/edit/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      req.session.flash = { type: 'error', text: 'Product not found' }
      return res.redirect('/admin/products')
    }

    res.render('admin/products/edit', {
      layout: 'admin/layout',
      product,
    })
  } catch (error) {
    console.error(error)
    req.session.flash = { type: 'error', text: 'Failed to load product' }
    res.redirect('/admin/products')
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

    req.session.flash = { type: 'success', text: `Product "${name}" updated successfully! 🚀` }
    res.redirect('/admin/products')
  } catch (error) {
    console.error(error)
    req.session.flash = { type: 'error', text: 'Failed to update product: ' + (error.message || 'Validation error') }
    res.redirect(`/admin/products/edit/${req.params.id}`)
  }
})

router.get('/products/delete/:id', async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id)
    if (deleted) {
      req.session.flash = { type: 'success', text: `Product "${deleted.name}" deleted.` }
    } else {
      req.session.flash = { type: 'error', text: 'Product not found.' }
    }
    res.redirect('/admin/products')
  } catch (error) {
    console.error(error)
    req.session.flash = { type: 'error', text: 'Failed to delete product.' }
    res.redirect('/admin/products')
  }
})

module.exports = router
