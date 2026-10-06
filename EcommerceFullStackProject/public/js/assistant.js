(() => {
  const widget = document.querySelector('.assistant-widget')
  if (!widget) return

  const toggleBtn = widget.querySelector('.assistant-toggle')
  const closeBtn = widget.querySelector('.assistant-close')
  const panel = widget.querySelector('.assistant-panel')
  const form = widget.querySelector('.assistant-form')
  const input = widget.querySelector('.assistant-input')
  const messages = widget.querySelector('.assistant-messages')

  const escapeHtml = (str) => {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  const formatMarkdown = (text) => {
    if (!text) return ''
    let safe = escapeHtml(text)

    // Convert **bold** and __bold__ to <strong>bold</strong>
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    safe = safe.replace(/__(.+?)__/g, '<strong>$1</strong>')

    // Convert *italic* to <em>italic</em>
    safe = safe.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')

    // Convert bullet lists starting with - or *
    safe = safe.replace(/(?:^|\n)\s*[-*]\s+(.+)/g, '<div class="assistant-bullet">• $1</div>')

    // Convert paragraph linebreaks
    safe = safe.replace(/\n\n+/g, '<div class="assistant-spacer"></div>')
    safe = safe.replace(/\n/g, '<br>')

    return safe
  }

  const appendMessage = (text, className) => {
    const div = document.createElement('div')
    div.className = `assistant-message ${className}`
    div.innerHTML = formatMarkdown(text)
    messages.appendChild(div)
    messages.scrollTop = messages.scrollHeight
  }

  const togglePanel = (open) => {
    panel.classList.toggle('open', open)
    if (open) {
      setTimeout(() => input.focus(), 100)
    }
  }

  toggleBtn.addEventListener('click', () => togglePanel(true))
  closeBtn.addEventListener('click', () => togglePanel(false))

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const question = input.value.trim()
    if (!question) return

    appendMessage(question, 'assistant-user')
    input.value = ''

    // Loading indicator
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'assistant-message assistant-bot assistant-loading'
    loadingDiv.innerHTML = '<span class="assistant-typing">Searching store catalog...</span>'
    messages.appendChild(loadingDiv)
    messages.scrollTop = messages.scrollHeight

    try {
      const response = await fetch('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })

      loadingDiv.remove()

      if (!response.ok) {
        throw new Error('Assistant is temporarily unavailable.')
      }

      const data = await response.json()
      appendMessage(data.answer || 'No response received.', 'assistant-bot')
    } catch (err) {
      loadingDiv.remove()
      appendMessage(err.message, 'assistant-bot')
    }
  })
})()

