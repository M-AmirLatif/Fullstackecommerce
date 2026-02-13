(() => {
  const buttons = document.querySelectorAll('.ai-tools [data-ai]')
  if (!buttons.length) return

  const getValue = (selector) =>
    document.querySelector(selector)?.value?.trim() || ''

  const setValue = (selector, value) => {
    const el = document.querySelector(selector)
    if (!el || !value) return
    el.value = value
  }

  const setListValue = (selector, values) => {
    if (!Array.isArray(values) || values.length === 0) return
    setValue(selector, values.join(', '))
  }

  const requestAI = async (action) => {
    const payload = {
      action,
      name: getValue('#name'),
      category: getValue('#category'),
      price: getValue('#price'),
      description: getValue('#description'),
      highlights: getValue('#highlights'),
    }

    const response = await fetch('/ai/admin/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error('AI tools are unavailable.')
    }

    return response.json()
  }

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.getAttribute('data-ai')
      button.disabled = true
      try {
        const data = await requestAI(action)
        if (action === 'description' || action === 'autofill') {
          setValue('#description', data.description)
        }
        if (action === 'highlights' || action === 'autofill') {
          setListValue('#highlights', data.highlights)
        }
        if (action === 'seo' || action === 'autofill') {
          setValue('#seoTitle', data.seoTitle)
          setListValue('#tags', data.tags)
        }
        if (action === 'faqs' || action === 'autofill') {
          setListValue('#faqs', data.faqs)
        }
        if (action === 'autofill') {
          if (data.category) setValue('#category', data.category)
          setListValue('#colors', data.colors)
        }
      } catch (err) {
        alert(err.message)
      } finally {
        button.disabled = false
      }
    })
  })
})()
