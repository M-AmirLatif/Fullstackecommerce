const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')

const { protect } = require('../middleware/auth')
const Order = require('../models/order')

// Order confirmation page (session based or most recent)
router.get('/order-confirmation', protect, async (req, res) => {
  try {
    let lastOrderId = req.session.lastOrderId

    if (!lastOrderId && req.session.user?.id) {
      const recentOrder = await Order.findOne({ user: req.session.user.id }).sort({ createdAt: -1 })
      if (recentOrder) {
        lastOrderId = recentOrder._id
      }
    }

    if (!lastOrderId) {
      req.session.flash = { type: 'error', text: 'No recent order found.' }
      return res.redirect('/shop')
    }

    const order = await Order.findById(lastOrderId)

    if (!order) {
      req.session.flash = { type: 'error', text: 'Order not found.' }
      return res.redirect('/shop')
    }

    return res.render('pages/order-confirmation', { order })
  } catch (err) {
    console.error('ORDER CONFIRMATION ERROR:', err)
    req.session.flash = {
      type: 'error',
      text: 'Failed to load order confirmation.',
    }
    return res.redirect('/shop')
  }
})

// Specific order confirmation / receipt by ID
router.get(['/order-confirmation/:id', '/order/:id'], protect, async (req, res) => {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.session.flash = { type: 'error', text: 'Invalid order ID.' }
      return res.redirect('/shop')
    }

    const query = { _id: id }
    if (req.session.user?.role !== 'admin') {
      query.user = req.session.user.id
    }

    const order = await Order.findOne(query)
    if (!order) {
      req.session.flash = { type: 'error', text: 'Order not found.' }
      return res.redirect('/shop')
    }

    return res.render('pages/order-confirmation', { order })
  } catch (err) {
    console.error('VIEW ORDER ERROR:', err)
    req.session.flash = { type: 'error', text: 'Failed to load order details.' }
    return res.redirect('/shop')
  }
})

// Customer's Orders
router.get('/orders', protect, async (req, res) => {
  try {
    if (req.session.user?.role === 'admin') {
      return res.redirect('/admin/orders')
    }
    const orders = await Order.find({ user: req.session.user?.id }).sort({ createdAt: -1 })
    if (!orders || orders.length === 0) {
      req.session.flash = { type: 'info', text: 'You have no placed orders yet.' }
      return res.redirect('/shop')
    }
    return res.render('pages/order-confirmation', { order: orders[0], allOrders: orders })
  } catch (err) {
    console.error('ORDERS LIST ERROR:', err)
    return res.redirect('/shop')
  }
})

module.exports = router

