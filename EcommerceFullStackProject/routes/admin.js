const express = require('express')
const router = express.Router()

const Product = require('../models/product')
const Order = require('../models/order')
const { adminOnly } = require('../middleware/auth')


router.use(adminOnly)

router.get('/', (req, res) => {
  res.render('admin/dashboard', { layout: 'admin/layout' })
})

router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 })
    res.render('admin/orders', { orders })
  } catch (err) {
    console.error(err)
    res.status(500).send('Failed to load orders')
  }
})

router.post('/orders/:id/confirm', async (req, res) => {
  try {
    await Order.findByIdAndUpdate(req.params.id, {
      status: 'Confirmed',
    })
    res.redirect('/admin/orders')
  } catch (err) {
    console.error(err)
    res.status(500).send('Failed to confirm order')
  }
})

router.post('/orders/:id/cancel', async (req, res) => {
  try {
    await Order.findByIdAndUpdate(req.params.id, {
      status: 'Cancelled',
    })
    res.redirect('/admin/orders')
  } catch (err) {
    console.error(err)
    res.status(500).send('Failed to cancel order')
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
    const { name, price, category, description } = req.body

    await Product.create({
      name,
      price,
      category,
      description,
    })

    res.redirect('/admin/products')
  } catch (error) {
    console.error(error)
    res.status(500).send('Failed to add product')
  }
})

router.get('/products/edit/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    res.render('admin/products/edit', {
      layout: 'admin/layout',
      product,
    })
  } catch (error) {
    console.error(error)
    res.status(500).send('Failed to load product')
  }
})

router.post('/products/edit/:id', async (req, res) => {
  try {
    const { name, price, category, description } = req.body

    await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        price: Number(price),
        category,
        description,
      },
      {
        runValidators: true,
        new: true,
      }
    )

    res.redirect('/admin/products')
  } catch (error) {
    console.error(error)
    res.status(500).send(error.message)
  }
})

router.get('/products/delete/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id)
    res.redirect('/admin/products')
  } catch (error) {
    console.error(error)
    res.status(500).send('Failed to delete product')
  }
})

module.exports = router
