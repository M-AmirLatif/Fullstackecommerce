const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const mongoose = require('mongoose')

const infoPages = {
  about: {
    title: 'About E-Shop',
    lead: 'Bold UI, simple flows, and full-stack fundamentals you can extend.',
    sections: [
      { heading: 'What it is', text: 'An Express + MongoDB storefront with auth, cart, checkout, and admin.' },
      { heading: 'What changed', points: ['Footer links now open real pages', 'Background is dark navy with violet accents', 'Cards show rating, colors, and discount'] },
      { heading: 'Start here', text: 'See the updated product cards in the catalog.', link: { href: '/shop', label: 'Browse the shop' } },
    ],
  },
  blogs: {
    title: 'Blogs & Updates',
    lead: 'Dummy content, real routes. Use this for changelogs or guides later.',
    sections: [
      { heading: 'Design notes', points: ['Deep navy surfaces replace flat white blocks', 'Electric violet accents guide attention'] },
      { heading: 'Commerce tips', points: ['Put ratings and colors on the card', 'Keep footer links useful even when placeholder'] },
    ],
  },
  contact: {
    title: 'Contact Us',
    lead: 'No more dead links. This page is wired so it never 404s.',
    sections: [
      { heading: 'Reach us', points: ['Email: hello@eshop.dev', 'Phone: +1 (386) 688-3295', 'Hours: Mon-Fri, 9 AM to 6 PM'] },
      { heading: 'Need help first?', text: 'Check the frequently asked questions.', link: { href: '/faqs', label: 'Read FAQs' } },
    ],
  },
  faqs: {
    title: 'Frequently Asked Questions',
    lead: 'Short answers to the links people click first in a footer.',
    sections: [
      { heading: 'Do the footer links work?', text: 'Yes. Every footer link now resolves to a real page.' },
      { heading: 'Where do the new product attributes come from?', text: 'The Product model now includes rating, reviewCount, colors, highlights, and originalPrice.' },
      { heading: 'How do I add more pages?', text: 'Add an entry in infoPages and the route is registered automatically.' },
    ],
  },
  compare: {
    title: 'Compare Products',
    lead: 'A placeholder comparison experience that can grow into a full feature.',
    sections: [
      { heading: 'How it could work', points: ['Select products from the grid', 'Compare rating, price, and highlights', 'Share a comparison link'] },
      { heading: 'For now', text: 'Use filters and open product pages for details.', link: { href: '/shop', label: 'Open the catalog' } },
    ],
  },
  team: {
    title: 'Our Team',
    lead: 'Another dummy page that is still styled and routed correctly.',
    sections: [
      { heading: 'Roles', points: ['Product design', 'Frontend UI', 'Backend APIs', 'Data modeling'] },
      { heading: 'Principle', text: 'Every click should lead somewhere useful, even when content is dummy.' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    lead: 'A simple policy placeholder to complete the footer experience.',
    sections: [
      { heading: 'What we store', points: ['Account information for login', 'Cart items in session', 'Orders and basic fulfillment data'] },
      { heading: 'What we do not do', points: ['We do not sell personal data', 'We do not expose sensitive fields in templates'] },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    lead: 'A dummy terms page so the footer stays complete and realistic.',
    sections: [
      { heading: 'Use of the demo', points: ['This site is a learning project', 'Data may be reset during seeding', 'UI changes are expected while you iterate'] },
      { heading: 'Next step', text: 'Replace this with your own policies once you go beyond demo mode.' },
    ],
  },
}

router.get('/', async (req, res) => {
  try {
    const products = await Product.find().limit(8)
    const bestSellers = await Product.find().limit(4)

    res.render('pages/home', {
      products,
      bestSellers,
    })
  } catch (error) {
    console.error(error)
    res.render('pages/home', {
      products: [],
      bestSellers: [],
    })
  }
})

router.get('/login', (req, res) => {
  res.render('pages/login')
})

router.get('/register', (req, res) => {
  res.render('pages/register')
})

router.get('/shop', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 12
    const skip = (page - 1) * limit

    const { category, minPrice, maxPrice } = req.query

    const query = {}

    if (category) {
      query.category = category
    }

    if (minPrice || maxPrice) {
      query.price = {}
      if (minPrice) query.price.$gte = Number(minPrice)
      if (maxPrice) query.price.$lte = Number(maxPrice)
    }

    const totalProducts = await Product.countDocuments(query)
    const products = await Product.find(query).skip(skip).limit(limit)
    const categories = await Product.distinct('category')

    const totalPages = Math.ceil(totalProducts / limit)

    res.render('pages/shop', {
      products,
      currentPage: page,
      totalPages,
      limit,
      category,
      minPrice,
      maxPrice,
      categories,
      selectedCategory: category || '',
    })
  } catch (error) {
    console.error(error)
    res.status(500).send('Failed to load products')
  }
})

router.get('/product/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).render('error', { message: 'Product not found' })
    }

    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).render('error', {
        message: 'Product not found',
      })
    }

    res.render('pages/product', {
      product,
    })
  } catch (error) {
    console.error(error)
    res.status(500).render('error', {
      message: 'Failed to load product',
    })
  }
})

Object.entries(infoPages).forEach(([slug, page]) => {
  router.get(`/${slug}`, (req, res) => {
    res.render('pages/info', page)
  })
})

module.exports = router
