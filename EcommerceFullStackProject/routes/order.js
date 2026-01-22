const express = require('express')
const router = express.Router()

const { protect } = require('../middleware/auth')
const Order = require('../models/order')

// Order confirmation page
router.get('/order-confirmation', protect, async (req, res) => {
  try {
    const lastOrderId = req.session.lastOrderId

    if (!lastOrderId) {
      req.session.flash = { type: 'error', text: 'No recent order found.' }
      return res.redirect('/')
    }

    const order = await Order.findById(lastOrderId)

    if (!order) {
      req.session.flash = { type: 'error', text: 'Order not found.' }
      return res.redirect('/')
    }

    return res.render('pages/order-confirmation', { order })
  } catch (err) {
    console.error('ORDER CONFIRMATION ERROR:', err)
    req.session.flash = {
      type: 'error',
      text: 'Failed to load order confirmation.',
    }
    return res.redirect('/')
  }
})

module.exports = router
