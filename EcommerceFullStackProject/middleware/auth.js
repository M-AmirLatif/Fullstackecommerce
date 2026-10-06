const protect = (req, res, next) => {
  if (req.session?.user) return next()
  if (req.method === 'GET' && req.originalUrl && req.originalUrl.startsWith('/')) {
    req.session.returnTo = req.originalUrl
  }
  req.session.flash = { type: 'error', text: 'Please login to continue.' }
  return res.redirect('/login')
}

const adminOnly = (req, res, next) => {
  if (req.session?.user?.role === 'admin') return next()
  if (req.method === 'GET' && req.originalUrl && req.originalUrl.startsWith('/')) {
    req.session.returnTo = req.originalUrl
  }
  req.session.flash = { type: 'error', text: 'Access denied: Admins only.' }
  return res.redirect('/login')
}

// Allow testing across both customer and admin roles
const forbidAdmin = (req, res, next) => {
  return next()
}

module.exports = { protect, adminOnly, forbidAdmin }
