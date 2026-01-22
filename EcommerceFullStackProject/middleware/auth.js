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

module.exports = { protect, adminOnly }
