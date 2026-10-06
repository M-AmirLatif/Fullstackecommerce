const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')

const Order = require('../models/order')

// Order confirmation page - handles /order-confirmation, /order-confirmation/:id, /order/:id
router.get(['/order-confirmation', '/order-confirmation/:id', '/order/:id'], async (req, res) => {
  try {
    const rawId = req.params.id || req.query.id || req.session.lastOrderId
    let order = null

    if (rawId && mongoose.Types.ObjectId.isValid(String(rawId))) {
      order = await Order.findById(rawId)
    }

    if (!order && req.session?.lastOrderId && mongoose.Types.ObjectId.isValid(String(req.session.lastOrderId))) {
      order = await Order.findById(req.session.lastOrderId)
    }

    if (!order && req.session?.user?.id) {
      order = await Order.findOne({ user: req.session.user.id }).sort({ createdAt: -1 })
    }

    if (!order) {
      order = await Order.findOne().sort({ createdAt: -1 })
    }

    if (!order) {
      req.session.flash = { type: 'info', text: 'No recent orders found. Explore our catalog!' }
      return res.redirect('/shop')
    }

    return res.render('pages/order-confirmation', { order })
  } catch (err) {
    console.error('ORDER CONFIRMATION ERROR:', err)
    return res.redirect('/shop')
  }
})

// Customer's Orders History
router.get('/orders', async (req, res) => {
  try {
    if (req.session?.user?.role === 'admin') {
      return res.redirect('/admin/orders')
    }

    let orders = []
    if (req.session?.user?.id) {
      orders = await Order.find({ user: req.session.user.id }).sort({ createdAt: -1 })
    }

    if (!orders || orders.length === 0) {
      const latest = await Order.findOne().sort({ createdAt: -1 })
      if (latest) {
        return res.render('pages/order-confirmation', { order: latest })
      }
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
