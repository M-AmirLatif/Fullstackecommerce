const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const { forbidAdmin } = require('../middleware/auth')

// make sure cart exists
function ensureCart(req) {
  if (!req.session.cart) {
    req.session.cart = []
  }
  return req.session.cart
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
    const { productId } = req.body

    const product = await Product.findById(productId)
    if (!product) {
      req.session.flash = { type: 'error', text: 'Product not found' }
      return res.redirect('/shop')
    }

    const existing = cart.find(
      (item) => String(item._id) === String(product._id),
    )

    if (existing) {
      existing.quantity += 1
    } else {
      cart.push({
        _id: product._id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image || '/images/placeholder.png',
      })
    }

    req.session.flash = { type: 'success', text: 'Added to cart!' }
    return res.redirect('back')
  } catch (err) {
    console.error(err)
    req.session.flash = { type: 'error', text: 'Failed to add to cart' }
    return res.redirect('/shop')
  }
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
