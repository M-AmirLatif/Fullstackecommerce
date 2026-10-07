const express = require('express')
const session = require('express-session')
const connectMongo = require('connect-mongo')
const compression = require('compression')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const mongoSanitize = require('express-mongo-sanitize')
const morgan = require('morgan')
const csrf = require('csurf')
const MongoStore = connectMongo.MongoStore || connectMongo.default || connectMongo
const cartRoutes = require('./routes/cart')

const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '.env'),
  override: process.env.NODE_ENV !== 'production',
})

const authRoutes = require('./routes/auth')
const pagesRouter = require('./routes/pages')
const adminRouter = require('./routes/admin')
const checkoutRoutes = require('./routes/checkout')
const orderRoutes = require('./routes/order')
const aiRoutes = require('./routes/ai')
const paymentRoutes = require('./routes/payments')

const app = express()

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}


let sessionStore = undefined
if (process.env.MONGO_URI) {
  try {
    sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
      ttl: 30 * 24 * 60 * 60, // 30 days
      touchAfter: 24 * 3600, // lazy session update once per 24 hours
      autoRemove: 'native',
    })
    if (sessionStore && typeof sessionStore.on === 'function') {
      sessionStore.on('error', (err) => {
        console.warn('MongoStore warning:', err.message)
      })
    }
  } catch (storeErr) {
    console.warn('Failed to initialize MongoStore, falling back to memory store:', storeErr.message)
    sessionStore = undefined
  }
}

// View engine
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

const formatImageUrl = (img) => {
  if (!img) return '/images/placeholder.png'
  if (/^https?:\/\//i.test(img)) return img
  let p = String(img).trim().replace(/\\/g, '/')
  p = p.replace(/^public\//, '')
  if (!p.startsWith('/')) p = `/${p}`
  if (!p.startsWith('/images/')) {
    p = `/images/${p.replace(/^\//, '')}`
  }
  return p
}
app.locals.imageUrl = formatImageUrl

// Middleware (body + static)
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
  }),
)

app.use(helmet())
app.use(compression())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(mongoSanitize())

// ✅ SESSION MUST COME BEFORE ANY ROUTES
app.use(
  session({
    name: 'tech_session',
    secret: process.env.SESSION_SECRET || 'dev_secret_123',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: process.env.NODE_ENV === 'production',
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days persistent session
    },
  }),
)

const csrfProtection = csrf({
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
})

app.use((req, res, next) => {
  if (req.path === '/logout' || req.path.startsWith('/logout')) return next()
  if (req.path.startsWith('/ai/')) return next()
  if (req.path.startsWith('/payments/webhook/')) return next()
  return csrfProtection(req, res, next)
})

// Flash message middleware (simple)
app.use((req, res, next) => {
  res.locals.flash = req.session?.flash || null
  if (req.session?.flash) {
    delete req.session.flash
  }
  next()
})

// ✅ Make user available to all PUG pages
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null
  res.locals.currentPath = req.path || ''
  try {
    res.locals.csrfToken = req.csrfToken ? req.csrfToken() : null
  } catch (_) {
    res.locals.csrfToken = null
  }
  next()
})

// ✅ Initialize cart safely (after session)
app.use((req, res, next) => {
  if (req.session && !req.session.cart) req.session.cart = []
  const items = Array.isArray(req.session?.cart) ? req.session.cart : []
  res.locals.cartCount = items.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0)
  next()
})

app.use(cartRoutes)

/**
 * ✅ IMAGE PATH HELPER (available in all PUG pages)
 */
app.use((req, res, next) => {
  res.locals.imageUrl = formatImageUrl
  next()
})

// ✅ Ensure DB connection before routes
app.use(async (req, res, next) => {
  try {
    const mongoose = require('mongoose')
    if (process.env.MONGO_URI && mongoose.connection.readyState !== 1) {
      const connectDB = require('./config/db')
      await connectDB()
    }
    next()
  } catch (err) {
    console.error('DB connection check note:', err.message)
    next()
  }
})

// ✅ ROUTES (after session)
app.use(authRoutes)
app.use('/', pagesRouter)
app.use('/admin', adminRouter)
app.use(checkoutRoutes)
app.use(orderRoutes)
app.use(aiRoutes)
app.use(paymentRoutes)

// CSRF error handler
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    if (req.session) {
      req.session.flash = { type: 'error', text: 'Session expired. Please try again.' }
    }
    const back = req.get('referer')
    return res.redirect(303, back || '/')
  }
  return next(err)
})

// Global Error handler
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }

  console.error('GLOBAL ERROR HANDLER on', req.method, req.originalUrl, ':', err)

  // If this is a standard GET page navigation, recover gracefully instead of breaking the UI
  if (req.method === 'GET' && !req.xhr && !req.headers.accept?.includes('application/json')) {
    if (req.session) {
      req.session.flash = { type: 'error', text: 'An unexpected error occurred. Please try again.' }
    }
    const back = req.get('referer')
    if (back && !back.includes('/error') && !back.includes(req.originalUrl)) {
      return res.redirect(303, back)
    }
    return res.redirect(303, '/shop')
  }

  return res.status(err.status || 500).render('error', {
    message: err.message || 'Something went wrong. Please try again.',
  })
})

// 404 handler
app.use((req, res) => {
  if (req.method === 'GET') {
    return res.status(404).render('error', { message: 'Page Not Found' })
  }
  return res.status(404).json({ error: 'Page Not Found' })
})

module.exports = app
