(() => {
  const buttons = document.querySelectorAll('.ai-tools [data-ai]')
  if (!buttons.length) return

  const form = document.querySelector('form')

  const getValue = (selector) =>
    document.querySelector(selector)?.value?.trim() || ''

  const setValue = (selector, value) => {
    const el = document.querySelector(selector)
    if (!el || !value) return
    el.value = value
  }

  const setListValue = (selector, values) => {
    if (!Array.isArray(values) || values.length === 0) return
    const sep = selector === '#faqs' ? '\n' : ', '
    setValue(selector, values.join(sep))
  }

  const showInlineMessage = (text, tone = 'info') => {
    if (!form) return
    let box = form.querySelector('.ai-status')
    if (!box) {
      box = document.createElement('p')
      box.className = 'ai-status'
      form.prepend(box)
    }
    box.textContent = text
    box.dataset.tone = tone
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
      let message = 'AI tools are unavailable.'
      try {
        const error = await response.json()
        if (error?.error) message = error.error
      } catch (_err) {}
      throw new Error(message)
    }

    return response.json()
  }

  const toggleButtons = (disabled, activeButton = null) => {
    buttons.forEach((btn) => {
      btn.disabled = disabled
      if (disabled && btn === activeButton) {
        btn.dataset.originalText = btn.textContent
        btn.textContent = 'Generating...'
      } else if (!disabled && btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText
        delete btn.dataset.originalText
      }
    })
  }

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.getAttribute('data-ai')
      if (!getValue('#name')) {
        showInlineMessage('Enter Product Name first for best AI output.', 'warn')
        return
      }

      toggleButtons(true, button)
      showInlineMessage('Generating content with AI...', 'info')
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
          if (data.category) {
            const category = document.querySelector('#category')
            if (category) {
              const optionExists = [...category.options].some(
                (opt) => opt.value === data.category,
              )
              if (!optionExists) {
                const option = document.createElement('option')
                option.value = data.category
                option.textContent = data.category
                category.appendChild(option)
              }
            }
            setValue('#category', data.category)
          }
          setListValue('#colors', data.colors)
        }
        showInlineMessage('AI content generated successfully.', 'success')
      } catch (err) {
        showInlineMessage(err.message, 'error')
      } finally {
        toggleButtons(false)
      }
    })
  })
})()
