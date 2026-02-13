const express = require('express')
const User = require('../models/user')
const { z } = require('zod')

const router = express.Router()

// =========================
// REGISTER
// =========================
// =========================
// REGISTER
// =========================
router.post('/register', async (req, res) => {
  try {
    const registerSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
    })
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      req.session.flash = { type: 'error', text: 'All fields are required.' }
      return res.redirect('/register')
    }
    const { name, email, password } = parsed.data

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      req.session.flash = {
        type: 'error',
        text: 'Email already exists. Please log in.',
      }
      return res.redirect('/login')
    }

    const user = await User.create({ name, email, password, role: 'user' })

    req.session.user = { id: user._id, email: user.email, role: user.role }
    req.session.flash = {
      type: 'success',
      text: 'Account created successfully.',
    }

    return res.redirect('/')
  } catch (err) {
    console.error('REGISTER ERROR:', err)
    req.session.flash = {
      type: 'error',
      text: 'Something went wrong. Please try again.',
    }
    return res.redirect('/register')
  }
})

// =========================
// LOGIN
// =========================
// =========================
// LOGIN
// =========================
router.post('/login', async (req, res) => {
  try {
    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    })
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      req.session.flash = {
        type: 'error',
        text: 'Email and password are required.',
      }
      return res.redirect('/login')
    }
    const { email, password } = parsed.data

    const user = await User.findOne({ email })
    if (!user) {
      req.session.flash = { type: 'error', text: 'Invalid email or password.' }
      return res.redirect('/login')
    }

    const passwordMatch = await user.comparePassword(password)
    if (!passwordMatch) {
      req.session.flash = { type: 'error', text: 'Invalid email or password.' }
      return res.redirect('/login')
    }

    req.session.user = { id: user._id, email: user.email, role: user.role }
    req.session.flash = { type: 'success', text: 'Logged in successfully.' }

    return res.redirect('/')
  } catch (err) {
    console.error('LOGIN ERROR:', err)
    req.session.flash = {
      type: 'error',
      text: 'Something went wrong. Please try again.',
    }
    return res.redirect('/login')
  }
})

// =========================
// LOGOUT
// =========================
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    req.session = null
    res.redirect('/login')
  })
})


module.exports = router
