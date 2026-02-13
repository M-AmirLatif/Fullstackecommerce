const express = require('express')
const router = express.Router()

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'
const { adminOnly } = require('../middleware/auth')

router.post('/ai/chat', async (req, res) => {
  try {
    const question = String(req.body.question || '').trim()
    if (!question) {
      return res.status(400).json({ error: 'Question is required.' })
    }

    const response = await fetch(`${AI_SERVICE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        top_k: Number(req.body.top_k) || 6,
      }),
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'AI service unavailable.' })
    }

    const data = await response.json()
    return res.json(data)
  } catch (err) {
    console.error('AI CHAT ERROR:', err.message)
    return res.status(500).json({ error: 'Failed to process AI request.' })
  }
})

router.post('/ai/admin/generate', adminOnly, async (req, res) => {
  try {
    const payload = {
      action: String(req.body.action || ''),
      name: String(req.body.name || ''),
      category: String(req.body.category || ''),
      price: String(req.body.price || ''),
      description: String(req.body.description || ''),
      highlights: String(req.body.highlights || ''),
    }

    const response = await fetch(`${AI_SERVICE_URL}/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'AI service unavailable.' })
    }

    const data = await response.json()
    return res.json(data)
  } catch (err) {
    console.error('AI GENERATE ERROR:', err.message)
    return res.status(500).json({ error: 'Failed to generate content.' })
  }
})

module.exports = router
