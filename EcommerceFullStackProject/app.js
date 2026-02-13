const express = require('express')
const session = require('express-session')
const connectMongo = require('connect-mongo')
const compression = require('compression')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const mongoSanitize = require('express-mongo-sanitize')
const morgan = require('morgan')
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

const app = express()

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}


const sessionStore = process.env.MONGO_URI
  ? MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
    })
  : undefined

// View engine
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

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
    secret: process.env.SESSION_SECRET || 'dev_secret_123',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  }),
)

// Flash message middleware (simple)
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null
  delete req.session.flash
  next()
})

// ✅ Make user available to all PUG pages
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null
  res.locals.currentPath = req.path || ''
  next()
})

// ✅ Initialize cart safely (after session)
app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = []
  next()
})

app.use(cartRoutes)

/**
 * ✅ IMAGE PATH HELPER (available in all PUG pages)
 * Supports:
 * - Full URLs: https://...
 * - /images/file.jpg
 * - images/file.jpg
 * - public/images/file.jpg
 * - file.jpg   -> becomes /images/file.jpg
 */
app.use((req, res, next) => {
  res.locals.imageUrl = (img) => {
    if (!img) return '/images/placeholder.png'

    // keep external URLs as-is
    if (/^https?:\/\//i.test(img)) return img

    let p = String(img).trim().replace(/\\/g, '/')

    // remove leading public/
    p = p.replace(/^public\//, '')

    // ensure leading slash
    if (!p.startsWith('/')) p = `/${p}`

    // if not already under /images, map it there
    if (!p.startsWith('/images/')) {
      // if it's like "/jacket.jpg" -> "/images/jacket.jpg"
      p = `/images/${p.replace(/^\//, '')}`
    }

    return p
  }

  next()
})

// ✅ ROUTES (after session)
app.use(authRoutes)
app.use('/', pagesRouter)
app.use('/admin', adminRouter)
app.use(checkoutRoutes)
app.use(orderRoutes)
app.use(aiRoutes)

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).render('error', {
    message: 'Something went wrong. Please try again.',
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page Not Found' })
})

module.exports = app
