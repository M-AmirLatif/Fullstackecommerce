const protect = (req, res, next) => {
  if (req.session?.user) return next()
  req.session.flash = { type: 'error', text: 'Please login to continue.' }
  return res.redirect('/login')
}

const adminOnly = (req, res, next) => {
  if (req.session?.user?.role === 'admin') return next()
  req.session.flash = { type: 'error', text: 'Access denied: Admins only.' }
  return res.redirect('/login')
}

// Prevent admin users from performing customer-only actions (buying/orders)
const forbidAdmin = (req, res, next) => {
  if (req.session?.user?.role === 'admin') {
    req.session.flash = {
      type: 'error',
      text: 'Admins are not allowed to perform this action.',
    }
    return res.redirect('/admin')
  }
  return next()
}

module.exports = { protect, adminOnly, forbidAdmin }
