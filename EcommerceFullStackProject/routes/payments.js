const express = require('express')
const crypto = require('crypto')
const { applyPaymentEvent } = require('../services/paymentEvents')

const router = express.Router()

const verifySignature = (payload, signature) => {
  const secret = process.env.DEMO_WEBHOOK_SECRET || ''
  if (!secret) return true
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return expected === signature
}

router.post('/payments/webhook/demo', async (req, res) => {
  try {
    const rawPayload = JSON.stringify(req.body || {})
    const signature = String(req.headers['x-demo-signature'] || '')
    if (!verifySignature(rawPayload, signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature' })
    }

    const eventType = String(req.body?.event || '')
    const orderId = String(req.body?.orderId || '')
    const transactionId = String(req.body?.transactionId || '')
    if (!eventType || !orderId) {
      return res.status(400).json({ error: 'event and orderId are required' })
    }

    const result = await applyPaymentEvent({ orderId, eventType, transactionId })
    if (!result.ok) {
      const status = result.reason === 'ORDER_NOT_FOUND' ? 404 : 400
      return res.status(status).json({ error: result.reason })
    }

    return res.json({
      ok: true,
      orderId,
      status: result.order.status,
      paymentStatus: result.order.payment?.status,
      duplicate: Boolean(result.duplicate),
    })
  } catch (err) {
    console.error('PAYMENT WEBHOOK ERROR:', err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
})

module.exports = router
