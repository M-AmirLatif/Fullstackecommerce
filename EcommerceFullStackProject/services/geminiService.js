const Product = require('../models/product')

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.AI_GEMINI_MODEL || 'gemini-2.5-flash'

/**
 * Direct call to Google Gemini API
 */
async function callGemini(prompt, systemInstruction = '') {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment.')
  }

  const models = [GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
  let lastError = null

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
    
    const payload = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
      },
    }

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      }
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errText = await response.text()
        lastError = new Error(`Gemini API error (${model}): ${response.status} - ${errText}`)
        continue
      }

      const data = await response.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) {
        return text.trim()
      }
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('Gemini API call failed across all candidate models.')
}

/**
 * Smart product retrieval based on customer query
 */
async function retrieveRelevantProducts(question, limit = 6) {
  try {
    const terms = String(question || '')
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .split(/\s+/)
      .filter((t) => t.length >= 2)
      .slice(0, 6)

    if (!terms.length) {
      return await Product.find({ inStock: true }).sort({ rating: -1, createdAt: -1 }).limit(limit).lean()
    }

    const regexPattern = new RegExp(terms.join('|'), 'i')

    const products = await Product.find({
      $or: [
        { name: regexPattern },
        { description: regexPattern },
        { category: regexPattern },
      ],
    })
      .limit(limit)
      .lean()

    if (!products || products.length < limit) {
      const existingIds = (products || []).map((p) => p._id)
      const fallback = await Product.find({ _id: { $nin: existingIds }, inStock: true })
        .sort({ rating: -1 })
        .limit(limit - (products ? products.length : 0))
        .lean()
      return [...(products || []), ...(fallback || [])]
    }

    return products
  } catch (err) {
    console.warn('Product retrieval fallback:', err.message)
    try {
      return await Product.find().limit(limit).lean()
    } catch (_) {
      return []
    }
  }
}

/**
 * AI Shopping Assistant Chat
 */
async function chatWithAssistant(question, sessionContext = []) {
  const lower = String(question || '').trim().toLowerCase()
  const isGreeting = /^(hi|hello|hey|salam|assalam|aoa|good\s+(morning|afternoon|evening)|hola|yo)\b/i.test(lower)
  const isThanks = /^(thanks|thank\s+you|thx|jazakallah)\b/i.test(lower)
  const isAffirmation = /^(ok|okay|great|nice|cool|perfect|fine|alright)\b/i.test(lower)

  let products = []
  try {
    products = await retrieveRelevantProducts(question, 6)
  } catch (_) {
    products = []
  }

  const productContext = (products || [])
    .map(
      (p, idx) =>
        `${idx + 1}. ${p.name} | $${Number(p.price || 0).toFixed(2)} | Category: ${p.category || 'General'} | In Stock: ${p.stock || 'Yes'} | Rating: ${p.rating || 4.5} | Highlights: ${(p.highlights || []).join(', ')} | Description: ${p.description || ''}`,
    )
    .join('\n')

  const prompt = `You are a helpful, courteous, and smart AI Shopping Assistant for "Tech Innovation Store" (Tech Innovation.pk - "We Deliver Best").
Available product catalog:
${productContext}

Customer message: "${question}"

Instructions:
1. Understand the customer's intent naturally:
   - If they are saying "Thanks", "Thank you", acknowledge warmly and politely (e.g., "You're very welcome! Let me know if you need anything else or want product advice.").
   - If they say "Ok", "Okay", "Great", "Nice", "Cool", respond pleasantly and offer to help them explore any deals or gadget specs.
   - If they are greeting ("Hi", "Hello", "Hey"), greet them warmly and ask how you can assist with our tech collection today.
   - If they ask about specific products, categories, prices, stock, or recommendations, answer accurately with details from the catalog above.
2. Keep your response conversational, concise (2 to 4 sentences), and natural.
3. Do NOT repeat generic introductory greetings when acknowledging 'Ok' or 'Thanks'.`

  let answer = ''
  try {
    answer = await callGemini(prompt)
  } catch (err) {
    if (isGreeting) {
      answer = 'Hello! 👋 Welcome to Tech Innovation Store. How can I help you find smartphones, headphones, smartwatches, or exclusive deals today?'
    } else if (isThanks) {
      answer = "You're very welcome! Feel free to ask anytime if you need more gadget recommendations or assistance."
    } else if (isAffirmation) {
      answer = 'Awesome! Let me know if you would like to explore our top-rated tech products or check our latest discounts.'
    } else if (products && products.length > 0) {
      answer = `Here are some of our top tech products matching your request: ${products.slice(0, 3).map((p) => `${p.name} ($${Number(p.price).toFixed(2)})`).join(', ')}. Let me know if you would like details on any of these!`
    } else {
      answer = 'Welcome to Tech Innovation Store! Ask me anything about our gadgets, specs, prices, or recommendations.'
    }
  }

  return {
    answer,
    products: (products || []).map((p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      image: p.image,
      category: p.category,
      rating: p.rating,
      stock: p.stock,
      inStock: p.inStock,
      highlights: p.highlights,
    })),
  }
}

/**
 * Admin Content Generation (Description, Highlights, SEO Tags, FAQs)
 */
async function generateAdminContent({ action, name, category, price, description, highlights }) {
  const productInfo = `Product: ${name || 'Item'} (Category: ${category || 'General'}, Price: $${price || '0'})\nExisting Description: ${description || 'None'}\nExisting Highlights: ${highlights || 'None'}`

  let prompt = ''
  switch (action) {
    case 'description':
      prompt = `Write a captivating, high-converting 2-paragraph ecommerce product description for:\n${productInfo}\nReturn only the clean description text without markdown headers.`
      break
    case 'highlights':
      prompt = `Generate 4 punchy, bullet-point product highlights/features for:\n${productInfo}\nReturn each highlight on a new line starting with '- '.`
      break
    case 'tags':
      prompt = `Generate 6-8 relevant, comma-separated SEO keywords/tags for:\n${productInfo}\nReturn ONLY the comma-separated tags.`
      break
    case 'faqs':
      prompt = `Generate 3 customer FAQs with helpful answers for:\n${productInfo}\nFormat as:\nQ: ...\nA: ...`
      break
    case 'autofill':
      prompt = `Suggest suitable colors (comma separated) and a standard category name for:\n${productInfo}\nFormat as JSON: {"category": "...", "colors": ["..."]}`
      break
    default:
      prompt = `Improve the product details for:\n${productInfo}`
  }

  const result = await callGemini(prompt)
  return { output: result, result }
}

module.exports = {
  callGemini,
  chatWithAssistant,
  generateAdminContent,
  retrieveRelevantProducts,
}
