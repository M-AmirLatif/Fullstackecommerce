const express = require('express')
const User = require('../models/user')
const PendingSignup = require('../models/pendingSignup')
const { z } = require('zod')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const router = express.Router()
let nodemailer
try {
  nodemailer = require('nodemailer')
} catch (_) {
  nodemailer = null
}

const OTP_EXPIRES_MIN = Number(process.env.OTP_EXPIRES_MIN || 10)
const OTP_MAX_ATTEMPTS = 5
const OTP_RESEND_COOLDOWN_SEC = 30
const RESET_PASSWORD_EXPIRES_MIN = Number(process.env.RESET_PASSWORD_EXPIRES_MIN || 30)
const LOGIN_ATTEMPT_WINDOW_MS = Number(process.env.LOGIN_ATTEMPT_WINDOW_MIN || 15) * 60 * 1000
const LOGIN_LOCK_MS = Number(process.env.LOGIN_LOCK_MIN || 15) * 60 * 1000
const LOGIN_MAX_FAILS = Number(process.env.LOGIN_MAX_FAILS || 5)
const LOGIN_IP_MAX_ATTEMPTS = Number(process.env.LOGIN_IP_MAX_ATTEMPTS || 25)
const LOGIN_IP_WINDOW_MS = Number(process.env.LOGIN_IP_WINDOW_MIN || 15) * 60 * 1000

// In-memory login protection (good for single-instance deployment; use Redis for multi-instance)
const loginAttemptStore = new Map()
const loginIpStore = new Map()

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
})

const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.',
})

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const clientIp = (req) => (
  req.headers['x-forwarded-for']?.split(',')[0]?.trim()
  || req.ip
  || req.socket?.remoteAddress
  || 'unknown'
)

const nowMs = () => Date.now()

const pruneOldLoginEntries = () => {
  const now = nowMs()
  for (const [key, record] of loginAttemptStore.entries()) {
    if ((record.lockUntil || 0) > now) continue
    if (now - (record.lastSeenAt || record.windowStartedAt || now) <= LOGIN_ATTEMPT_WINDOW_MS) continue
    loginAttemptStore.delete(key)
  }
  for (const [key, record] of loginIpStore.entries()) {
    if (now - (record.lastSeenAt || record.windowStartedAt || now) <= LOGIN_IP_WINDOW_MS) continue
    loginIpStore.delete(key)
  }
}

const makeAttemptKey = (ip, email) => `${ip}::${email}`

const checkIpThrottle = (ip) => {
  const now = nowMs()
  const current = loginIpStore.get(ip)
  if (!current || now - current.windowStartedAt > LOGIN_IP_WINDOW_MS) {
    loginIpStore.set(ip, { count: 1, windowStartedAt: now, lastSeenAt: now })
    return { blocked: false }
  }
  current.count += 1
  current.lastSeenAt = now
  if (current.count > LOGIN_IP_MAX_ATTEMPTS) {
    return { blocked: true, retryMs: LOGIN_IP_WINDOW_MS - (now - current.windowStartedAt) }
  }
  return { blocked: false }
}

const getLockStatus = (ip, email) => {
  const record = loginAttemptStore.get(makeAttemptKey(ip, email))
  if (!record) return { locked: false }
  const now = nowMs()
  if ((record.lockUntil || 0) > now) {
    return { locked: true, retryMs: record.lockUntil - now }
  }
  return { locked: false }
}

const recordLoginFailure = (ip, email) => {
  const now = nowMs()
  const key = makeAttemptKey(ip, email)
  const current = loginAttemptStore.get(key)
  if (!current || now - current.windowStartedAt > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttemptStore.set(key, {
      count: 1,
      windowStartedAt: now,
      lastSeenAt: now,
      lockUntil: 0,
    })
    return { locked: false, attemptsLeft: Math.max(0, LOGIN_MAX_FAILS - 1) }
  }

  current.count += 1
  current.lastSeenAt = now
  if (current.count >= LOGIN_MAX_FAILS) {
    current.lockUntil = now + LOGIN_LOCK_MS
    return { locked: true, retryMs: LOGIN_LOCK_MS }
  }
  return { locked: false, attemptsLeft: Math.max(0, LOGIN_MAX_FAILS - current.count) }
}

const clearLoginFailures = (ip, email) => {
  loginAttemptStore.delete(makeAttemptKey(ip, email))
}

setInterval(pruneOldLoginEntries, 5 * 60 * 1000).unref()

const getSafePostLoginRedirect = (req, user) => {
  const fallback = user?.role === 'admin' ? '/admin' : '/'
  const candidate = String(req.session?.returnTo || '').trim()
  delete req.session.returnTo

  if (!candidate) return fallback
  if (!candidate.startsWith('/')) return fallback
  if (candidate.startsWith('//')) return fallback

  const blockedPrefixes = ['/login', '/logout', '/register', '/forgot-password', '/reset-password']
  if (blockedPrefixes.some((prefix) => candidate === prefix || candidate.startsWith(`${prefix}?`))) {
    return fallback
  }

  return candidate
}

const createOtp = () => String(Math.floor(100000 + Math.random() * 900000))
const createResetToken = () => crypto.randomBytes(24).toString('hex')
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex')

const getTransporter = () => {
  if (!nodemailer) return null
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

const sendOtpEmail = async (email, otp) => {
  const transporter = getTransporter()
  if (!transporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.')
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Your E-Shop verification code',
    text: `Your E-Shop verification code is: ${otp}. It expires in ${OTP_EXPIRES_MIN} minutes.`,
    html: `<p>Your E-Shop verification code is:</p><h2>${otp}</h2><p>Expires in ${OTP_EXPIRES_MIN} minutes.</p>`,
  })
}

const sendResetPasswordEmail = async (req, email, token) => {
  const transporter = getTransporter()
  if (!transporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.')
  }
  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Reset your E-Shop password',
    text: `Reset your E-Shop password using this link (expires in ${RESET_PASSWORD_EXPIRES_MIN} minutes): ${resetUrl}`,
    html: `
      <p>Reset your E-Shop password.</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link expires in ${RESET_PASSWORD_EXPIRES_MIN} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  })
}

// =========================
// REGISTER
// =========================
router.post('/register/start', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      req.session.flash = { type: 'error', text: 'All fields are required.' }
      return res.redirect('/register')
    }
    const { name, password } = parsed.data
    const email = normalizeEmail(parsed.data.email)

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      req.session.flash = {
        type: 'error',
        text: 'Email already exists. Please log in.',
      }
      return res.redirect('/login')
    }

    const otp = createOtp()
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)
    const otpHash = await bcrypt.hash(otp, salt)
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MIN * 60 * 1000)
    const now = Date.now()

    const existingPending = await PendingSignup.findOne({ email })
    if (existingPending && now - new Date(existingPending.updatedAt).getTime() < OTP_RESEND_COOLDOWN_SEC * 1000) {
      req.session.flash = {
        type: 'error',
        text: `Please wait ${OTP_RESEND_COOLDOWN_SEC} seconds before requesting another OTP.`,
      }
      return res.redirect(`/register/verify?email=${encodeURIComponent(email)}`)
    }

    await PendingSignup.findOneAndUpdate(
      { email },
      {
        name,
        email,
        passwordHash,
        otpHash,
        otpExpiresAt: expiresAt,
        attempts: 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    await sendOtpEmail(email, otp)

    req.session.flash = {
      type: 'success',
      text: 'OTP sent to your email. Enter it to complete signup.',
    }
    return res.redirect(`/register/verify?email=${encodeURIComponent(email)}`)
  } catch (err) {
    console.error('REGISTER START ERROR:', err)
    req.session.flash = {
      type: 'error',
      text: err.message || 'Failed to send OTP. Please try again.',
    }
    return res.redirect('/register')
  }
})

router.get('/register/verify', (req, res) => {
  const email = normalizeEmail(req.query.email)
  if (!email) return res.redirect('/register')
  return res.render('pages/register-verify', { email })
})

router.post('/register/verify', async (req, res) => {
  try {
    const parsed = otpSchema.safeParse(req.body)
    if (!parsed.success) {
      req.session.flash = { type: 'error', text: 'Enter a valid 6-digit OTP.' }
      return res.redirect(`/register/verify?email=${encodeURIComponent(req.body.email || '')}`)
    }

    const email = normalizeEmail(parsed.data.email)
    const otp = parsed.data.otp
    const pending = await PendingSignup.findOne({ email })
    if (!pending) {
      req.session.flash = { type: 'error', text: 'No pending signup found. Please register again.' }
      return res.redirect('/register')
    }

    if (pending.otpExpiresAt.getTime() < Date.now()) {
      await PendingSignup.deleteOne({ _id: pending._id })
      req.session.flash = { type: 'error', text: 'OTP expired. Please register again.' }
      return res.redirect('/register')
    }

    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await PendingSignup.deleteOne({ _id: pending._id })
      req.session.flash = { type: 'error', text: 'Too many invalid attempts. Please register again.' }
      return res.redirect('/register')
    }

    const valid = await bcrypt.compare(otp, pending.otpHash)
    if (!valid) {
      pending.attempts += 1
      await pending.save()
      req.session.flash = { type: 'error', text: 'Invalid OTP. Please try again.' }
      return res.redirect(`/register/verify?email=${encodeURIComponent(email)}`)
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      await PendingSignup.deleteOne({ _id: pending._id })
      req.session.flash = { type: 'error', text: 'Email already registered. Please log in.' }
      return res.redirect('/login')
    }

    const user = await User.create({
      name: pending.name,
      email: pending.email,
      password: pending.passwordHash,
      role: 'user',
    })
    await PendingSignup.deleteOne({ _id: pending._id })

    req.session.user = { id: user._id, email: user.email, role: user.role }
    req.session.flash = { type: 'success', text: 'Account created successfully.' }
    return res.redirect('/')
  } catch (err) {
    console.error('REGISTER VERIFY ERROR:', err)
    req.session.flash = { type: 'error', text: 'Failed to verify OTP. Please try again.' }
    return res.redirect('/register')
  }
})

router.post('/register/resend-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email)
    if (!email) return res.redirect('/register')

    const pending = await PendingSignup.findOne({ email })
    if (!pending) {
      req.session.flash = { type: 'error', text: 'No pending signup found. Please register again.' }
      return res.redirect('/register')
    }

    const now = Date.now()
    if (now - new Date(pending.updatedAt).getTime() < OTP_RESEND_COOLDOWN_SEC * 1000) {
      req.session.flash = {
        type: 'error',
        text: `Please wait ${OTP_RESEND_COOLDOWN_SEC} seconds before resending OTP.`,
      }
      return res.redirect(`/register/verify?email=${encodeURIComponent(email)}`)
    }

    const otp = createOtp()
    const salt = await bcrypt.genSalt(10)
    pending.otpHash = await bcrypt.hash(otp, salt)
    pending.otpExpiresAt = new Date(now + OTP_EXPIRES_MIN * 60 * 1000)
    pending.attempts = 0
    await pending.save()
    await sendOtpEmail(email, otp)

    req.session.flash = { type: 'success', text: 'New OTP sent to your email.' }
    return res.redirect(`/register/verify?email=${encodeURIComponent(email)}`)
  } catch (err) {
    console.error('RESEND OTP ERROR:', err)
    req.session.flash = { type: 'error', text: 'Failed to resend OTP.' }
    return res.redirect('/register')
  }
})

// =========================
// FORGOT / RESET PASSWORD
// =========================
router.post('/forgot-password', async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      req.session.flash = { type: 'error', text: 'Enter a valid email address.' }
      return res.redirect('/forgot-password')
    }

    const email = normalizeEmail(parsed.data.email)
    const user = await User.findOne({ email })

    // Always respond with a generic success to avoid email enumeration
    const genericSuccess = () => {
      req.session.flash = {
        type: 'success',
        text: 'If an account exists for that email, a password reset link has been sent.',
      }
      return res.redirect('/login')
    }

    if (!user) return genericSuccess()

    const rawToken = createResetToken()
    user.resetPasswordTokenHash = hashToken(rawToken)
    user.resetPasswordExpiresAt = new Date(Date.now() + RESET_PASSWORD_EXPIRES_MIN * 60 * 1000)
    await user.save()

    try {
      await sendResetPasswordEmail(req, email, rawToken)
    } catch (mailErr) {
      user.resetPasswordTokenHash = null
      user.resetPasswordExpiresAt = null
      await user.save()
      throw mailErr
    }

    return genericSuccess()
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err)
    req.session.flash = {
      type: 'error',
      text: err.message || 'Failed to send reset email. Please try again.',
    }
    return res.redirect('/forgot-password')
  }
})

router.post('/reset-password', async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      req.session.flash = {
        type: 'error',
        text: 'Enter a valid new password and make sure both passwords match.',
      }
      return res.redirect(`/reset-password?token=${encodeURIComponent(req.body.token || '')}`)
    }

    const tokenHash = hashToken(parsed.data.token)
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    })

    if (!user) {
      req.session.flash = {
        type: 'error',
        text: 'Reset link is invalid or expired. Please request a new one.',
      }
      return res.redirect('/forgot-password')
    }

    user.password = parsed.data.password
    user.resetPasswordTokenHash = null
    user.resetPasswordExpiresAt = null
    await user.save()

    if (req.session?.user && String(req.session.user.id) === String(user._id)) {
      req.session.user = null
    }

    req.session.flash = { type: 'success', text: 'Password reset successful. Please log in.' }
    return res.redirect('/login')
  } catch (err) {
    console.error('RESET PASSWORD ERROR:', err)
    req.session.flash = {
      type: 'error',
      text: 'Failed to reset password. Please try again.',
    }
    return res.redirect('/forgot-password')
  }
})

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
    const ip = clientIp(req)
    const throttle = checkIpThrottle(ip)
    if (throttle.blocked) {
      req.session.flash = {
        type: 'error',
        text: 'Too many login attempts from this network. Please wait a few minutes and try again.',
      }
      return res.redirect('/login')
    }

    const email = normalizeEmail(parsed.data.email)
    const { password } = parsed.data

    const lock = getLockStatus(ip, email)
    if (lock.locked) {
      const retryMin = Math.max(1, Math.ceil(lock.retryMs / 60000))
      req.session.flash = {
        type: 'error',
        text: `Account login is temporarily locked for this device/network. Try again in ${retryMin} minute${retryMin !== 1 ? 's' : ''}.`,
      }
      return res.redirect('/login')
    }

    const user = await User.findOne({ email })
    if (!user) {
      recordLoginFailure(ip, email)
      req.session.flash = { type: 'error', text: 'Invalid email or password.' }
      return res.redirect('/login')
    }

    const passwordMatch = await user.comparePassword(password)
    if (!passwordMatch) {
      const fail = recordLoginFailure(ip, email)
      if (fail.locked) {
        req.session.flash = {
          type: 'error',
          text: 'Too many failed login attempts. Login temporarily locked for 15 minutes.',
        }
        return res.redirect('/login')
      }
      req.session.flash = { type: 'error', text: 'Invalid email or password.' }
      return res.redirect('/login')
    }

    clearLoginFailures(ip, email)
    req.session.user = { id: user._id, email: user.email, role: user.role }
    req.session.flash = { type: 'success', text: 'Logged in successfully.' }

    // Force GET after login form POST (some clients may preserve POST on 302)
    return res.redirect(303, getSafePostLoginRedirect(req, user))
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
