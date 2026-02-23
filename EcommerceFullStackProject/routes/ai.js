const express = require('express')
const router = express.Router()

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'
const { adminOnly } = require('../middleware/auth')

const isSmallTalk = (q) => {
  const text = String(q || '').trim().toLowerCase()
  return ['thanks', 'thank you', 'ok', 'okay', 'great', 'nice'].includes(text)
}

const isShortFollowUp = (q) => {
  const text = String(q || '').trim().toLowerCase()
  if (!text) return false
  const followTokens = ['feature', 'features', 'detail', 'details', 'price', 'model', 'sku', 'stock', 'color', 'colors', 'spec', 'specs']
  if (followTokens.includes(text)) return true
  return text.split(/\s+/).length <= 3 && followTokens.some((t) => text.includes(t))
}

router.post('/ai/chat', async (req, res) => {
  try {
    const question = String(req.body.question || '').trim()
    if (!question) {
      return res.status(400).json({ error: 'Question is required.' })
    }

    if (isSmallTalk(question)) {
      return res.json({
        answer: "You're welcome. Ask me about any product, price, model, or features.",
        products: req.session?.aiChatState?.lastProducts || [],
      })
    }

    let questionForAi = question
    const lastProducts = req.session?.aiChatState?.lastProducts || []
    if (isShortFollowUp(question) && lastProducts.length) {
      const contextList = lastProducts
        .slice(0, 4)
        .map((p, i) => `${i + 1}. ${p.name} (${p.category || 'N/A'}) - $${Number(p.price || 0).toFixed(2)}`)
        .join('\n')
      questionForAi = `${question}\n\nConversation context (previous product results):\n${contextList}\nIf the user asks a vague follow-up like "feature" or "details", answer for the first product unless they specify another.`
    }

    const response = await fetch(`${AI_SERVICE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: questionForAi,
        top_k: Number(req.body.top_k) || 6,
      }),
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'AI service unavailable.' })
    }

    const data = await response.json()
    req.session.aiChatState = {
      lastQuestion: question,
      lastProducts: Array.isArray(data.products) ? data.products.slice(0, 6) : [],
      updatedAt: Date.now(),
    }
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
