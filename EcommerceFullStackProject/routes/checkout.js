const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const mongoose = require('mongoose')

const Order = require('../models/order')
const Product = require('../models/product')
const { applyPaymentEvent } = require('../services/paymentEvents')
const { z } = require('zod')

const buildCartItems = (cart, productsById) =>
  cart.map((item) => {
    const productId = item._id || item.productId || item.product
    const product = productsById.get(String(productId))
    return {
      product: product?._id || productId,
      name: product?.name || item.name || item.title || 'Product',
      price: Number(product?.price || item.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
      availableStock: Number(product?.stock) || 100,
      inStock: product?.inStock !== false,
    }
  })

const getTotalAmount = (items) =>
  items.reduce((sum, it) => sum + it.price * it.quantity, 0)

// GET checkout page
router.get('/checkout', (req, res) => {
  const cart = req.session.cart || []
  if (cart.length === 0 && req.session.lastOrderId) {
    return res.redirect(`/order-confirmation/${req.session.lastOrderId}`)
  }
  const total = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
  if (!req.session.checkoutToken) req.session.checkoutToken = crypto.randomUUID()
  return res.render('pages/checkout', { cart, total, checkoutToken: req.session.checkoutToken })
})

// POST checkout (demo mode)
router.post('/checkout', async (req, res) => {
  try {
    const cart = req.session.cart || []
    if (cart.length === 0) {
      req.session.flash = { type: 'error', text: 'Your cart is empty. Please add products to checkout.' }
      return res.redirect('/shop')
    }

    const customerName = String(req.body.customerName || req.session.user?.name || 'Customer').trim()
    const email = String(req.body.email || req.session.user?.email || 'customer@gmail.com').trim()
    const phone = String(req.body.phone || '+92 300 1234567').trim()
    const address = String(req.body.address || 'Standard Delivery').trim()
    const city = String(req.body.city || 'Lahore').trim()
    const state = String(req.body.state || 'Punjab').trim()
    const zip = String(req.body.zip || '54000').trim()
    const country = String(req.body.country || 'Pakistan').trim()

    const postedToken = String(req.body.checkoutToken || req.session.checkoutToken || crypto.randomUUID())

    const productIds = cart.map((item) => item._id || item.productId || item.product).filter(Boolean)
    const products = await Product.find({ _id: { $in: productIds } })
    const productsById = new Map(products.map((p) => [String(p._id), p]))

    const items = buildCartItems(cart, productsById)
    const totalAmount = getTotalAmount(items)

    const orderPayload = {
      user: req.session.user?.id || null,
      idempotencyKey: postedToken,
      customerName: customerName || 'Valued Customer',
      email: email || 'support@techinnovation.pk',
      shipping: {
        phone: phone || '+92 300 0000000',
        address: address || 'Store Delivery Address',
        city: city || 'Lahore',
        state: state || 'Punjab',
        zip: zip || '54000',
        country: country || 'Pakistan',
      },
      items: items.map(({ availableStock, inStock, ...rest }) => rest),
      totalAmount: totalAmount > 0 ? totalAmount : 50,
      status: 'Paid',
      payment: {
        provider: 'demo',
        status: 'succeeded',
        transactionId: `demo_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      },
    }

    let order = null
    try {
      const docs = await Order.create([orderPayload])
      order = docs[0]
    } catch (orderErr) {
      console.warn('Order.create array mode failed, falling back to direct:', orderErr.message)
      order = await Order.create(orderPayload)
    }

    // Safely update product stock levels
    try {
      for (const item of items) {
        if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: -item.quantity } },
          )
        }
      }
    } catch (stockErr) {
      console.warn('Stock update note:', stockErr.message)
    }

    req.session.lastOrderId = String(order._id)
    req.session.cart = []
    req.session.checkoutToken = crypto.randomUUID()
    req.session.flash = { type: 'success', text: 'Order placed successfully! 🚀' }

    await new Promise((resolve) => req.session.save(resolve))
    return res.redirect(`/order-confirmation/${order._id}`)
  } catch (err) {
    console.error('CHECKOUT ERROR:', err)
    req.session.flash = { type: 'error', text: 'Failed to place order: ' + (err.message || 'Server error') }
    return res.redirect('/checkout')
  }
})

module.exports = router
