const express = require('express')
const router = express.Router()

const AI_SERVICE_URL = process.env.AI_SERVICE_URL
const { adminOnly } = require('../middleware/auth')
const geminiService = require('../services/geminiService')

const isSmallTalk = (q) => {
  const text = String(q || '').trim().toLowerCase()
  return ['thanks', 'thank you', 'ok', 'okay', 'great', 'nice', 'hello', 'hi', 'hey'].includes(text)
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
      return res.json({
        answer: 'Hello! 👋 How can I assist you with our tech gadgets, specs, or deals today?',
        products: [],
      })
    }

    let questionForAi = question
    const lastProducts = req.session?.aiChatState?.lastProducts || []
    if (isShortFollowUp(question) && lastProducts.length) {
      const contextList = lastProducts
        .slice(0, 4)
        .map((p, i) => `${i + 1}. ${p.name} (${p.category || 'N/A'}) - $${Number(p.price || 0).toFixed(2)}`)
        .join('\n')
      questionForAi = `${question}\n\nConversation context (previous product results):\n${contextList}`
    }

    // 1. Try external AI service if configured
    if (AI_SERVICE_URL && !AI_SERVICE_URL.includes('127.0.0.1') && !AI_SERVICE_URL.includes('localhost')) {
      try {
        const response = await fetch(`${AI_SERVICE_URL}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: questionForAi,
            top_k: Number(req.body.top_k) || 6,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (req.session) {
            req.session.aiChatState = {
              lastQuestion: question,
              lastProducts: Array.isArray(data.products) ? data.products.slice(0, 6) : [],
              updatedAt: Date.now(),
            }
          }
          return res.json(data)
        }
      } catch (externalErr) {
        console.warn('External AI service unavailable, falling back to native service:', externalErr.message)
      }
    }

    // 2. Native assistant service (runs reliably on Vercel)
    const result = await geminiService.chatWithAssistant(questionForAi, lastProducts)
    if (req.session) {
      req.session.aiChatState = {
        lastQuestion: question,
        lastProducts: Array.isArray(result.products) ? result.products.slice(0, 6) : [],
        updatedAt: Date.now(),
      }
    }
    return res.json(result)
  } catch (err) {
    console.error('AI CHAT ERROR:', err.message)
    return res.json({
      answer: 'Hello! 👋 Welcome to Tech Innovation Store. Ask me about any gadgets, specs, prices, or recommendations across our store!',
      products: [],
    })
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

    // 1. Try external AI service if configured
    if (AI_SERVICE_URL && !AI_SERVICE_URL.includes('127.0.0.1') && !AI_SERVICE_URL.includes('localhost')) {
      try {
        const response = await fetch(`${AI_SERVICE_URL}/ai/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          const data = await response.json()
          return res.json(data)
        }
      } catch (externalErr) {
        console.warn('External AI service unavailable, falling back to native Gemini:', externalErr.message)
      }
    }

    // 2. Native Gemini Generator
    const result = await geminiService.generateAdminContent(payload)
    return res.json(result)
  } catch (err) {
    console.error('AI GENERATE ERROR:', err.message)
    return res.status(500).json({ error: 'Failed to generate content.' })
  }
})

module.exports = router
