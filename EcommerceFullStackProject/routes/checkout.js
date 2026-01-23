const express = require('express')
const router = express.Router()

const { protect, forbidAdmin } = require('../middleware/auth')
const Order = require('../models/order')

// GET checkout page (must be logged in)
router.get('/checkout', protect, forbidAdmin, (req, res) => {
  const cart = req.session.cart || []
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return res.render('pages/checkout', { cart, total })
})

// POST checkout (place order)
router.post('/checkout', protect, forbidAdmin, async (req, res) => {
  try {
    const cart = req.session.cart || []
    if (cart.length === 0) {
      req.session.flash = { type: 'error', text: 'Your cart is empty.' }
      return res.redirect('/cart')
    }

    // Build order items and total (supports both formats)
    const items = cart.map((item) => ({
      product: item._id || item.productId || item.product,
      name: item.name || item.title,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
    }))

    const totalAmount = items.reduce(
      (sum, it) => sum + it.price * it.quantity,
      0,
    )

    const order = await Order.create({
      customerName: req.body.customerName,
      email: req.body.email,
      address: req.body.address, // if your model uses "address"
      items,
      totalAmount,
      status: 'Pending',
    })

    // save last order id for confirmation page
    req.session.lastOrderId = order._id

    // clear cart
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
