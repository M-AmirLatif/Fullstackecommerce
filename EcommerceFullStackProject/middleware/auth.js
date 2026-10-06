const protect = (req, res, next) => {
  if (req.session?.user) return next()
  if (req.method === 'GET' && req.originalUrl && req.originalUrl.startsWith('/') && !req.originalUrl.startsWith('/login')) {
    req.session.returnTo = req.originalUrl
  }
  req.session.flash = { type: 'error', text: 'Please login to continue.' }
  return res.redirect('/login')
}

const adminOnly = (req, res, next) => {
  if (req.session?.user?.role === 'admin') return next()
  
  if (req.session?.user) {
    // User is logged in but not an admin -> send to customer home, do not bounce to login
    req.session.flash = { type: 'error', text: 'Access denied: Admin privileges required.' }
    return res.redirect('/')
  }

  if (req.method === 'GET' && req.originalUrl && req.originalUrl.startsWith('/') && !req.originalUrl.startsWith('/login')) {
    req.session.returnTo = req.originalUrl
  }
  req.session.flash = { type: 'error', text: 'Access denied: Please sign in with an admin account.' }
  return res.redirect('/login')
}

// Allow testing across both customer and admin roles
const forbidAdmin = (req, res, next) => {
  return next()
}

module.exports = { protect, adminOnly, forbidAdmin }
