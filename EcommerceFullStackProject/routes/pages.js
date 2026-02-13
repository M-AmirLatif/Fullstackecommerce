const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const mongoose = require('mongoose')
const { z } = require('zod')
const { protect, forbidAdmin } = require('../middleware/auth')

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'
const AI_TOP_K = 200

const pageCache = new Map()
const buildCacheKey = (req) => req.originalUrl

const cacheRender = (ttlMs) => (req, res, next) => {
  if (req.method !== 'GET') return next()
  if (req.session?.user) return next()

  const key = buildCacheKey(req)
  const cached = pageCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    res.set('Cache-Control', 'public, max-age=60')
    res.set('X-Cache', 'HIT')
    return res.send(cached.html)
  }

  const render = res.render.bind(res)
  res.render = (view, locals) => {
    render(view, locals, (err, html) => {
      if (err) return next(err)
      pageCache.set(key, { html, expiresAt: Date.now() + ttlMs })
      res.set('Cache-Control', 'public, max-age=60')
      res.set('X-Cache', 'MISS')
      return res.send(html)
    })
  }
  return next()
}

const fetchSemanticResults = async (query) => {
  const response = await fetch(`${AI_SERVICE_URL}/ai/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: AI_TOP_K }),
  })

  if (!response.ok) {
    throw new Error(`AI search failed: ${response.status}`)
  }

  const data = await response.json()
  if (!data || !Array.isArray(data.results)) return []

  return data.results.map((item) => String(item.id))
}

const buildSearchRegex = (query) => {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const terms = escaped.split(/\s+/).filter(Boolean).slice(0, 6)
  if (!terms.length) return null
  return new RegExp(terms.join('|'), 'i')
}

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
      { heading: 'Returns & shipping', text: 'Policies are available for customers who need details before buying.', link: { href: '/returns', label: 'View returns' } },
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
    lead: 'A clear overview of what data we collect and how we use it.',
    sections: [
      { heading: 'What we store', points: ['Account information for login', 'Cart items in session', 'Orders and basic fulfillment data'] },
      { heading: 'What we do not do', points: ['We do not sell personal data', 'We do not expose sensitive fields in templates'] },
      { heading: 'Your controls', text: 'Email support to request account deletion or data export.' },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    lead: 'Key terms for using this storefront demo and placing orders.',
    sections: [
      { heading: 'Use of the demo', points: ['This site is a learning project', 'Data may be reset during seeding', 'UI changes are expected while you iterate'] },
      { heading: 'Payments', text: 'Checkout is demo-only unless you connect a payment provider.' },
      { heading: 'Next step', text: 'Replace this with your own policies once you go beyond demo mode.' },
    ],
  },
  shipping: {
    title: 'Shipping Information',
    lead: 'Estimated delivery times and shipping costs by region.',
    sections: [
      { heading: 'Processing time', text: 'Orders typically ship within 24-48 hours, Monday through Friday.' },
      { heading: 'Delivery estimates', points: ['US Standard: 3-5 business days', 'US Express: 1-2 business days', 'International: 7-12 business days'] },
      { heading: 'Costs', text: 'Free standard shipping over $50. Express options calculated at checkout.' },
    ],
  },
  returns: {
    title: 'Returns & Refunds',
    lead: 'Simple returns with clear timelines and instructions.',
    sections: [
      { heading: 'Return window', text: 'Items can be returned within 30 days of delivery for a full refund.' },
      { heading: 'Condition', points: ['Unused and in original packaging', 'All accessories included', 'Proof of purchase required'] },
      { heading: 'Refund timing', text: 'Refunds are issued within 5-7 business days after approval.' },
    ],
  },
  support: {
    title: 'Support Center',
    lead: 'Everything you need to get help fast.',
    sections: [
      { heading: 'Quick help', points: ['Track your order with the order confirmation email', 'Update shipping details before dispatch', 'Use the chat widget for product help'] },
      { heading: 'Still stuck?', text: 'Reach us directly and we will respond within 1 business day.', link: { href: '/contact', label: 'Contact support' } },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    lead: 'We use cookies to keep your session and cart working.',
    sections: [
      { heading: 'Essential cookies', text: 'Used for login sessions and cart functionality.' },
      { heading: 'Analytics', text: 'Only enabled if you add analytics in production.' },
      { heading: 'Controls', text: 'You can clear cookies any time in your browser settings.' },
    ],
  },
}

router.get('/', cacheRender(60 * 1000), async (req, res) => {
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

router.get('/shop', cacheRender(60 * 1000), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 12
    const skip = (page - 1) * limit

    const { category, minPrice, maxPrice } = req.query
    const q = String(req.query.q || '').trim()
    const sortKey = String(req.query.sort || '').trim()

    const query = {}

    if (category) {
      query.category = category
    }

    if (minPrice || maxPrice) {
      query.price = {}
      if (minPrice) query.price.$gte = Number(minPrice)
      if (maxPrice) query.price.$lte = Number(maxPrice)
    }

    let totalProducts = 0
    let products = []
    let aiError = false

    const sortMap = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { rating: -1 },
      newest: { createdAt: -1 },
    }

    if (q) {
      try {
        const semanticIds = await fetchSemanticResults(q)
        if (semanticIds.length > 0) {
          const searchQuery = { ...query, _id: { $in: semanticIds } }
          const matches = await Product.find(searchQuery)
          const orderMap = new Map(semanticIds.map((id, idx) => [id, idx]))
          const ordered = matches.sort(
            (a, b) => (orderMap.get(String(a._id)) ?? 0) - (orderMap.get(String(b._id)) ?? 0),
          )
          const sorted = sortMap[sortKey]
            ? ordered.sort((a, b) => {
                if (sortKey === 'newest') return b.createdAt - a.createdAt
                if (sortKey === 'rating') return (b.rating || 0) - (a.rating || 0)
                if (sortKey === 'price_desc') return (b.price || 0) - (a.price || 0)
                if (sortKey === 'price_asc') return (a.price || 0) - (b.price || 0)
                return 0
              })
            : ordered

          totalProducts = sorted.length
          products = sorted.slice(skip, skip + limit)
        } else {
          const regex = buildSearchRegex(q)
          if (regex) {
            const fuzzyQuery = {
              ...query,
              $or: [
                { name: regex },
                { description: regex },
                { category: regex },
              ],
            }
            totalProducts = await Product.countDocuments(fuzzyQuery)
            const sortOptions = sortMap[sortKey] || {}
            products = await Product.find(fuzzyQuery)
              .sort(sortOptions)
              .skip(skip)
              .limit(limit)
          }
        }
      } catch (error) {
        console.error('AI SEARCH ERROR:', error.message)
        aiError = true
      }
    }

    if (!q || aiError) {
      totalProducts = await Product.countDocuments(query)
      const sortOptions = sortMap[sortKey] || {}
      products = await Product.find(query).sort(sortOptions).skip(skip).limit(limit)
    }
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
      q,
      sort: sortKey,
      aiError,
    })
  } catch (error) {
    console.error(error)
    res.status(500).send('Failed to load products')
  }
})

router.get('/product/:id', cacheRender(60 * 1000), async (req, res) => {
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

    const priceValue = Number(product.price || 0)
    const priceMin = Math.max(priceValue * 0.8, 0)
    const priceMax = priceValue * 1.2

    const recommendations = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      price: { $gte: priceMin, $lte: priceMax },
    })
      .limit(6)

    res.render('pages/product', {
      product,
      recommendations,
    })
  } catch (error) {
    console.error(error)
    res.status(500).render('error', {
      message: 'Failed to load product',
    })
  }
})

router.post('/product/:id/rate', protect, forbidAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).render('error', { message: 'Product not found' })
    }

    const ratingSchema = z.object({
      rating: z.coerce.number().int().min(1).max(5),
    })
    const parsed = ratingSchema.safeParse(req.body)
    if (!parsed.success) {
      req.session.flash = { type: 'error', text: 'Invalid rating.' }
      return res.redirect('back')
    }

    const productId = String(req.params.id)
    const rated = req.session.ratedProducts || []
    if (rated.includes(productId)) {
      req.session.flash = { type: 'error', text: 'You already rated this product.' }
      return res.redirect('back')
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).render('error', { message: 'Product not found' })
    }

    const reviewCount = Math.max(0, Number(product.reviewCount) || 0)
    const currentRating = Math.max(0, Number(product.rating) || 0)
    const newCount = reviewCount + 1
    const newRating = ((currentRating * reviewCount) + parsed.data.rating) / newCount

    product.reviewCount = newCount
    product.rating = Number(newRating.toFixed(2))
    await product.save()

    req.session.ratedProducts = [...rated, productId]
    req.session.flash = { type: 'success', text: 'Thanks for your rating!' }
    return res.redirect('back')
  } catch (error) {
    console.error('RATING ERROR:', error)
    req.session.flash = { type: 'error', text: 'Failed to submit rating.' }
    return res.redirect('back')
  }
})

Object.entries(infoPages).forEach(([slug, page]) => {
  router.get(`/${slug}`, (req, res) => {
    res.render('pages/info', page)
  })
})

module.exports = router
