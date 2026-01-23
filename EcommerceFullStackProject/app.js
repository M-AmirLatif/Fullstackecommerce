const express = require('express')
const session = require('express-session')
const cartRoutes = require('./routes/cart')

require('dotenv').config()
const path = require('path')

const authRoutes = require('./routes/auth')
const pagesRouter = require('./routes/pages')
const adminRouter = require('./routes/admin')
const checkoutRoutes = require('./routes/checkout')
const orderRoutes = require('./routes/order')

const app = express()

// View engine
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

// Middleware (body + static)
app.use(express.static(path.join(__dirname, 'public')))

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// ✅ SESSION MUST COME BEFORE ANY ROUTES
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret_123',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // true only on HTTPS hosting
    },
  }),
)

app.use(cartRoutes)

// Flash message middleware (simple)
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null
  delete req.session.flash
  next()
})

// ✅ Make user available to all PUG pages
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null
  next()
})

// ✅ Initialize cart safely (after session)
app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = []
  next()
})

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

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page Not Found' })
})

module.exports = app
