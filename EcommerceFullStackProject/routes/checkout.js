const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const mongoose = require('mongoose')

const { protect, forbidAdmin } = require('../middleware/auth')
const Order = require('../models/order')
const Product = require('../models/product')
const { applyPaymentEvent } = require('../services/paymentEvents')
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

const buildOrderPayload = ({ userId, parsed, items, totalAmount, idempotencyKey }) => ({
  user: userId,
  idempotencyKey,
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
  status: 'Pending',
  payment: {
    provider: 'demo',
    status: 'pending',
    transactionId: '',
  },
})

const reserveInventoryWithoutTransaction = async (items) => {
  const applied = []
  for (const item of items) {
    const result = await Product.updateOne(
      {
        _id: item.product,
        inStock: true,
        stock: { $gte: item.quantity },
      },
      {
        $inc: { stock: -item.quantity },
      },
    )
    if (result.modifiedCount !== 1) {
      if (applied.length > 0) {
        const rollbackOps = applied.map((entry) => ({
          updateOne: {
            filter: { _id: entry.productId },
            update: { $inc: { stock: entry.qty } },
          },
        }))
        await Product.bulkWrite(rollbackOps)
      }
      return false
    }
    applied.push({ productId: item.product, qty: item.quantity })
  }
  await Product.updateMany({ stock: { $lte: 0 } }, { $set: { inStock: false } })
  return true
}

const reserveInventoryWithTransaction = async (items, createOrderFn) => {
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      for (const item of items) {
        const result = await Product.updateOne(
          {
            _id: item.product,
            inStock: true,
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { session },
        )
        if (result.modifiedCount !== 1) {
          throw new Error('OUT_OF_STOCK')
        }
      }
      await Product.updateMany(
        { stock: { $lte: 0 } },
        { $set: { inStock: false } },
        { session },
      )
      await createOrderFn(session)
    })
    return true
  } finally {
    await session.endSession()
  }
}

// GET checkout page (must be logged in)
router.get('/checkout', protect, forbidAdmin, (req, res) => {
  const cart = req.session.cart || []
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  if (!req.session.checkoutToken) req.session.checkoutToken = crypto.randomUUID()
  return res.render('pages/checkout', { cart, total, checkoutToken: req.session.checkoutToken })
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

    const postedToken = String(req.body.checkoutToken || '')
    const sessionToken = String(req.session.checkoutToken || '')
    if (!postedToken || !sessionToken || postedToken !== sessionToken) {
      req.session.flash = { type: 'error', text: 'Duplicate or invalid checkout submission.' }
      return res.redirect('/checkout')
    }

    const existingOrder = await Order.findOne({ idempotencyKey: postedToken })
    if (existingOrder) {
      req.session.lastOrderId = existingOrder._id
      req.session.cart = []
      req.session.flash = { type: 'success', text: 'Order already processed.' }
      return res.redirect('/order-confirmation')
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
    const orderPayload = buildOrderPayload({
      userId: req.session.user?.id,
      parsed,
      items,
      totalAmount,
      idempotencyKey: postedToken,
    })
    let order = null
    const createOrder = async (session) => {
      const docs = await Order.create([orderPayload], session ? { session } : undefined)
      order = docs[0]
    }

    const supportsTransactions = Boolean(
      mongoose.connection?.client?.topology?.description?.type &&
      mongoose.connection.client.topology.description.type !== 'Single',
    )

    if (supportsTransactions) {
      try {
        await reserveInventoryWithTransaction(items, createOrder)
      } catch (txErr) {
        if (txErr?.message === 'OUT_OF_STOCK') {
          req.session.flash = { type: 'error', text: 'Some items just went out of stock. Please review cart.' }
          return res.redirect('/cart')
        }
        throw txErr
      }
    } else {
      const reserved = await reserveInventoryWithoutTransaction(items)
      if (!reserved) {
        req.session.flash = { type: 'error', text: 'Some items just went out of stock. Please review cart.' }
        return res.redirect('/cart')
      }
      await createOrder()
    }

    req.session.lastOrderId = order._id
    req.session.cart = []
    req.session.checkoutToken = crypto.randomUUID()
    if (String(process.env.DEMO_PAYMENT_AUTO_CAPTURE || '1') === '1') {
      const transactionId = `demo_${Date.now()}_${String(order._id).slice(-6)}`
      await applyPaymentEvent({
        orderId: String(order._id),
        eventType: 'payment.succeeded',
        transactionId,
      })
    }
    req.session.flash = { type: 'success', text: 'Order placed successfully!' }
    return res.redirect('/order-confirmation')
  } catch (err) {
    console.error('CHECKOUT ERROR:', err)
    req.session.flash = { type: 'error', text: 'Failed to place order.' }
    return res.redirect('/checkout')
  }
})

module.exports = router
