const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const mongoose = require('mongoose')
const { z } = require('zod')
const { protect, forbidAdmin } = require('../middleware/auth')

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'
const AI_TOP_K = 200

router.get('/api/image-proxy', async (req, res) => {
  const targetUrl = req.query.url
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return res.redirect('/images/placeholder.png')
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return res.redirect('/images/placeholder.png')
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
    const buffer = await response.arrayBuffer()
    return res.send(Buffer.from(buffer))
  } catch (err) {
    return res.redirect('/images/placeholder.png')
  }
})

const redirectBack = (req, res, fallback = '/shop') => {
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

const fetchSemanticResults = async (query) => {
  if (!AI_SERVICE_URL || AI_SERVICE_URL.includes('127.0.0.1') || AI_SERVICE_URL.includes('localhost')) {
    return []
  }
  try {
    const response = await fetch(`${AI_SERVICE_URL}/ai/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: AI_TOP_K }),
    })

    if (!response.ok) return []

    const data = await response.json()
    if (!data || !Array.isArray(data.results)) return []

    return data.results.map((item) => String(item.id))
  } catch (err) {
    return []
  }
}

const buildSearchRegex = (query) => {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const terms = escaped.split(/\s+/).filter(Boolean).slice(0, 6)
  if (!terms.length) return null
  return new RegExp(terms.join('|'), 'i')
}

const infoPages = {
  about: {
    title: 'About Tech Innovation Store',
    lead: 'We Deliver Best — Premium Tech & Smart Gadgets in Pakistan.',
    sections: [
      { heading: 'Who We Are', text: 'Tech Innovation Store (Tech Innovation.pk) is your trusted destination for cutting-edge electronics, smart gadgets, and premium tech accessories.' },
      { heading: 'Our Promise', points: ['100% Genuine & Quality Tested Products', 'Fast Nationwide Delivery Across Pakistan', '24/7 Dedicated Customer & AI Shopping Support'] },
      { heading: 'Explore Collection', text: 'Explore our latest arrivals and top-rated gadgets.', link: { href: '/shop', label: 'Browse the shop' } },
    ],
  },
  blogs: {
    title: 'Tech News & Updates',
    lead: 'Stay ahead with the latest in gadgets, guides, and innovations.',
    sections: [
      { heading: 'Tech Insights', points: ['Flagship smartphone reviews & buying guides', 'Smart home audio & wearable accessories comparisons'] },
      { heading: 'Exclusive Perks', points: ['Weekly flash sales with up to 30% off', 'VIP discounts for tech enthusiasts'] },
    ],
  },
  contact: {
    title: 'Contact Tech Innovation Store',
    lead: 'We are here to assist you with inquiries, orders, and recommendations.',
    sections: [
      { heading: 'Reach Us', points: ['Email: support@techinnovation.pk', 'Phone: +92 300 1234567', 'Hours: Mon-Sat, 9 AM to 9 PM PKT'] },
      { heading: 'Need help first?', text: 'Check our frequently asked questions.', link: { href: '/faqs', label: 'Read FAQs' } },
      { heading: 'Returns & Shipping', text: 'Clear policies for hassle-free shopping across Pakistan.', link: { href: '/returns', label: 'View returns' } },
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

router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ featured: -1, createdAt: -1 }).limit(12)
    const bestSellers = await Product.find().sort({ rating: -1, reviewCount: -1 }).limit(8)

    res.render('pages/home', {
      products: products || [],
      bestSellers: bestSellers || [],
    })
  } catch (error) {
    console.error('HOME ROUTE ERROR:', error)
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

router.get('/forgot-password', (req, res) => {
  res.render('pages/forgot-password')
})

router.get('/reset-password', (req, res) => {
  const token = String(req.query.token || '').trim()
  if (!token) {
    req.session.flash = { type: 'error', text: 'Reset link is invalid or missing.' }
    return res.redirect('/forgot-password')
  }
  return res.render('pages/reset-password', { token })
})

router.get('/shop', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.max(1, parseInt(req.query.limit) || 12)
    const skip = (page - 1) * limit

    const categoryRaw = String(req.query.category || '').trim()
    const isFeatured = req.query.featured === 'true' || req.query.deals === 'true'
    const { minPrice, maxPrice } = req.query
    const q = String(req.query.q || '').trim()
    const sortKey = String(req.query.sort || '').trim()

    const andConditions = []

    if (isFeatured) {
      andConditions.push({
        $or: [
          { featured: true },
          { $expr: { $gt: ['$originalPrice', '$price'] } },
        ],
      })
    }

    if (categoryRaw && categoryRaw.toLowerCase() !== 'all') {
      const catLower = categoryRaw.toLowerCase()
      if (['smartphones', 'smartphone', 'phones', 'phone', 'mobile'].includes(catLower)) {
        andConditions.push({
          $or: [
            { category: /^smartphones?/i },
            { category: /^phones?/i },
            { name: /\bphones?\b|smartphone|galaxy|iphone|pixel|redmi|mobile/i },
          ],
        })
      } else if (['audio', 'audio & sound', 'sound', 'headphones', 'speakers'].includes(catLower)) {
        andConditions.push({
          $or: [
            { category: /^audio/i },
            { category: /^sound/i },
            { name: /headphone|speaker|earbud|airpod|sound|audio/i },
          ],
        })
      } else if (['wearables', 'wearable', 'smartwatches', 'smartwatch', 'watches', 'watch'].includes(catLower)) {
        andConditions.push({
          $or: [
            { category: /^(wearables?|smartwatches?|watches?)/i },
            { name: /watch|band|wearable|tracker/i },
          ],
        })
      } else if (['accessories', 'accessory'].includes(catLower)) {
        andConditions.push({
          $or: [
            { category: /^accessories/i },
            { name: /cable|charger|adapter|wallet|sunglasses|backpack|cap|case/i },
          ],
        })
      } else if (['electronics', 'electronic', 'gadgets'].includes(catLower)) {
        andConditions.push({
          $or: [
            { category: /^electronics/i },
            { name: /webcam|speaker|watch|cable|charger|camera|keyboard/i },
          ],
        })
      } else if (['clothing', 'apparel', 'lifestyle'].includes(catLower)) {
        andConditions.push({
          $or: [
            { category: /^(clothing|apparel|lifestyle)/i },
            { name: /shirt|jean|hoodie|jacket|wear/i },
          ],
        })
      } else if (['shoes', 'footwear'].includes(catLower)) {
        andConditions.push({
          $or: [
            { category: /^(shoes|footwear)/i },
            { name: /shoe|sneaker|runner|boot/i },
          ],
        })
      } else {
        const escaped = categoryRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        andConditions.push({ category: new RegExp(`^${escaped}$`, 'i') })
      }
    }

    if (minPrice || maxPrice) {
      const priceFilter = {}
      if (minPrice && !isNaN(Number(minPrice))) priceFilter.$gte = Number(minPrice)
      if (maxPrice && !isNaN(Number(maxPrice))) priceFilter.$lte = Number(maxPrice)
      if (Object.keys(priceFilter).length > 0) {
        andConditions.push({ price: priceFilter })
      }
    }

    const sortMap = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { rating: -1 },
      bestseller: { rating: -1, reviewCount: -1 },
      newest: { createdAt: -1 },
    }
    const sortOptions = sortMap[sortKey] || { createdAt: -1 }

    let totalProducts = 0
    let products = []
    let aiError = false

    if (q) {
      try {
        const semanticIds = await fetchSemanticResults(q)
        if (semanticIds.length > 0) {
          const searchQuery = andConditions.length > 0
            ? { $and: [...andConditions, { _id: { $in: semanticIds } }] }
            : { _id: { $in: semanticIds } }

          const matches = await Product.find(searchQuery)
          const orderMap = new Map(semanticIds.map((id, idx) => [id, idx]))
          const ordered = matches.sort(
            (a, b) => (orderMap.get(String(a._id)) ?? 0) - (orderMap.get(String(b._id)) ?? 0),
          )
          const sorted = sortMap[sortKey]
            ? ordered.sort((a, b) => {
                if (sortKey === 'newest') return b.createdAt - a.createdAt
                if (sortKey === 'rating' || sortKey === 'bestseller') return (b.rating || 0) - (a.rating || 0)
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
            const fuzzySearchCondition = {
              $or: [
                { name: regex },
                { description: regex },
                { category: regex },
                { tags: regex },
              ],
            }
            const fullQuery = andConditions.length > 0
              ? { $and: [...andConditions, fuzzySearchCondition] }
              : fuzzySearchCondition

            totalProducts = await Product.countDocuments(fullQuery)
            products = await Product.find(fullQuery)
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

    if (!q || aiError || (products.length === 0 && !aiError && andConditions.length > 0 && !q)) {
      const finalQuery = andConditions.length > 0 ? { $and: andConditions } : {}
      totalProducts = await Product.countDocuments(finalQuery)
      products = await Product.find(finalQuery).sort(sortOptions).skip(skip).limit(limit)
    }

    const categories = await Product.distinct('category')

    const totalPages = Math.max(1, Math.ceil(totalProducts / limit))

    res.render('pages/shop', {
      products: products || [],
      currentPage: page,
      totalPages,
      limit,
      category: categoryRaw,
      isFeatured,
      minPrice,
      maxPrice,
      categories: categories || [],
      selectedCategory: categoryRaw || '',
      q,
      sort: sortKey,
      aiError,
    })
  } catch (error) {
    console.error('SHOP ROUTE ERROR:', error)
    res.render('pages/shop', {
      products: [],
      currentPage: 1,
      totalPages: 1,
      limit: 12,
      category: '',
      minPrice: '',
      maxPrice: '',
      categories: [],
      selectedCategory: '',
      q: '',
      sort: '',
      aiError: false,
    })
  }
})

router.get('/product/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.session.flash = { type: 'error', text: 'Product not found.' }
      return res.redirect('/shop')
    }

    const product = await Product.findById(req.params.id)

    if (!product) {
      req.session.flash = { type: 'error', text: 'Product not found.' }
      return res.redirect('/shop')
    }

    const priceValue = Number(product.price || 0)
    const priceMin = Math.max(priceValue * 0.8, 0)
    const priceMax = priceValue * 1.2

    let recommendations = []
    try {
      recommendations = await Product.find({
        _id: { $ne: product._id },
        category: product.category,
        price: { $gte: priceMin, $lte: priceMax },
      }).limit(6)
    } catch (_) {
      recommendations = []
    }

    res.render('pages/product', {
      product,
      recommendations: recommendations || [],
    })
  } catch (error) {
    console.error('PRODUCT ROUTE ERROR:', error)
    req.session.flash = { type: 'error', text: 'Unable to load product.' }
    return res.redirect('/shop')
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
      return redirectBack(req, res)
    }

    const productId = String(req.params.id)
    const rated = req.session.ratedProducts || []
    if (rated.includes(productId)) {
      req.session.flash = { type: 'error', text: 'You already rated this product.' }
      return redirectBack(req, res)
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
    return redirectBack(req, res)
  } catch (error) {
    console.error('RATING ERROR:', error)
    req.session.flash = { type: 'error', text: 'Failed to submit rating.' }
    return redirectBack(req, res)
  }
})

Object.entries(infoPages).forEach(([slug, page]) => {
  router.get(`/${slug}`, (req, res) => {
    res.render('pages/info', page)
  })
})

module.exports = router
