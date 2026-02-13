const express = require('express')
const router = express.Router()

const { protect, forbidAdmin } = require('../middleware/auth')
const Order = require('../models/order')
const Product = require('../models/product')
const { z } = require('zod')

const buildCartItems = (cart, productsById) =>
  cart.map((item) => {
    const productId = item._id || item.productId || item.product
    const product = productsById.get(String(productId))
    return {
      product: product?._id,
      name: product?.name || item.name || item.title,
      price: Number(product?.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
      availableStock: Number(product?.stock) || 0,
      inStock: product?.inStock !== false,
    }
  })

const getTotalAmount = (items) =>
  items.reduce((sum, it) => sum + it.price * it.quantity, 0)

// GET checkout page (must be logged in)
router.get('/checkout', protect, forbidAdmin, (req, res) => {
  const cart = req.session.cart || []
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return res.render('pages/checkout', { cart, total })
})

// POST checkout (demo mode)
router.post('/checkout', protect, forbidAdmin, async (req, res) => {
  try {
    const cart = req.session.cart || []
    if (cart.length === 0) {
      req.session.flash = { type: 'error', text: 'Your cart is empty.' }
      return res.redirect('/cart')
    }

    const checkoutSchema = z.object({
      customerName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(5),
      address: z.string().min(3),
      city: z.string().min(2),
      state: z.string().min(2),
      zip: z.string().min(2),
      country: z.string().min(2),
    })
    const parsed = checkoutSchema.safeParse(req.body)
    if (!parsed.success) {
      req.session.flash = { type: 'error', text: 'Invalid checkout details.' }
      return res.redirect('/checkout')
    }

    const productIds = cart.map((item) => item._id || item.productId || item.product)
    const products = await Product.find({ _id: { $in: productIds } })
    const productsById = new Map(products.map((p) => [String(p._id), p]))

    const items = buildCartItems(cart, productsById)
    const unavailableItem = items.find(
      (item) =>
        !item.product ||
        !item.inStock ||
        item.availableStock < item.quantity,
    )
    if (unavailableItem) {
      req.session.flash = { type: 'error', text: 'Some items are out of stock.' }
      return res.redirect('/cart')
    }

    const totalAmount = getTotalAmount(items)

    const order = await Order.create({
      customerName: parsed.data.customerName,
      email: parsed.data.email,
      shipping: {
        phone: parsed.data.phone,
        address: parsed.data.address,
        city: parsed.data.city,
        state: parsed.data.state,
        zip: parsed.data.zip,
        country: parsed.data.country,
      },
      items: items.map(({ availableStock, inStock, ...rest }) => rest),
      totalAmount,
      status: 'Confirmed',
    })

    req.session.lastOrderId = order._id
    req.session.cart = []
    req.session.flash = { type: 'success', text: 'Order placed successfully!' }
    return res.redirect('/order-confirmation')
  } catch (err) {
    console.error('CHECKOUT ERROR:', err)
    req.session.flash = { type: 'error', text: 'Failed to place order.' }
    return res.redirect('/checkout')
  }
})

module.exports = router
