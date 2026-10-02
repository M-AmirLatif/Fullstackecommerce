const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const { forbidAdmin } = require('../middleware/auth')
const { z } = require('zod')

// make sure cart exists
function ensureCart(req) {
  if (!req.session.cart) {
    req.session.cart = []
  }
  return req.session.cart
}

function redirectBack(req, res, fallback = '/shop') {
  const ref = req.get('referer') || req.get('referrer')
  if (ref) {
    try {
      const url = new URL(ref)
      if (url.host === req.get('host')) {
        return res.redirect(303, `${url.pathname}${url.search}`)
      }
    } catch (_) {
      if (ref.startsWith('/')) return res.redirect(303, ref)
    }
  }
  return res.redirect(303, fallback)
}

// GET cart page
router.get('/cart', (req, res) => {
  const cart = ensureCart(req)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  res.render('pages/cart', { cart, total })
})

// ADD TO CART
router.post('/cart/add', forbidAdmin, async (req, res) => {
  try {
    const cart = ensureCart(req)
    const addSchema = z.object({
      productId: z.string().min(1),
      quantity: z.coerce.number().int().min(1).max(50).optional(),
    })
    const parsed = addSchema.safeParse(req.body)
    if (!parsed.success) {
      req.session.flash = { type: 'error', text: 'Invalid cart request.' }
      return res.redirect('/shop')
    }

    const { productId } = parsed.data
    const requestedQty = parsed.data.quantity || 1

    const product = await Product.findById(productId)
    if (!product) {
      req.session.flash = { type: 'error', text: 'Product not found' }
      return res.redirect('/shop')
    }

    if (product.inStock === false || Number(product.stock) <= 0) {
      req.session.flash = { type: 'error', text: 'This product is out of stock.' }
      return redirectBack(req, res)
    }

    const existing = cart.find(
      (item) => String(item._id) === String(product._id),
    )

    if (existing) {
      if (Number(existing.quantity) + requestedQty > Number(product.stock)) {
        req.session.flash = {
          type: 'error',
          text: 'Not enough stock for that quantity.',
        }
        return redirectBack(req, res)
      }
      existing.quantity += requestedQty
    } else {
      cart.push({
        _id: product._id,
        name: product.name,
        price: product.price,
        quantity: requestedQty,
        image: product.image || '/images/placeholder.png',
      })
    }

    req.session.flash = { type: 'success', text: 'Added to cart!' }
    return redirectBack(req, res)
  } catch (err) {
    console.error(err)
    req.session.flash = { type: 'error', text: 'Failed to add to cart' }
    return res.redirect('/shop')
  }
})

// UPDATE CART QUANTITY
router.post('/cart/update', (req, res) => {
  const cart = ensureCart(req)
  const updateSchema = z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(0).max(99),
  })
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.redirect('/cart')
  }

  const { productId, quantity: qty } = parsed.data

  const item = cart.find((entry) => String(entry._id) === String(productId))
  if (!item) {
    return res.redirect('/cart')
  }

  if (qty === 0) {
    req.session.cart = cart.filter(
      (entry) => String(entry._id) !== String(productId),
    )
    return res.redirect('/cart')
  }

  item.quantity = qty
  return res.redirect('/cart')
})

// REMOVE FROM CART
router.post('/cart/remove', (req, res) => {
  const cart = ensureCart(req)
  const { productId } = req.body

  req.session.cart = cart.filter(
    (item) => String(item._id) !== String(productId),
  )

  res.redirect('/cart')
})

module.exports = router
