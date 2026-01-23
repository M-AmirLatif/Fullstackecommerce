const mongoose = require('mongoose')
const pug = require('pug')
const path = require('path')
const Product = require('../models/product')

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce'

;(async function () {
  try {
    await mongoose.connect(MONGO)
    const products = await Product.find().lean()
    console.log('Loaded products:', products.length)

    const templatePath = path.join(
      __dirname,
      '..',
      'views',
      'admin',
      'products',
      'list.pug',
    )
    const html = pug.renderFile(templatePath, { products })
    console.log('\n---- Rendered HTML Preview (first 4000 chars) ----\n')
    console.log(html.slice(0, 4000))
    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
})()
