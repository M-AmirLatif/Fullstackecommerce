(() => {
  const widget = document.querySelector('.assistant-widget')
  if (!widget) return

  const toggleBtn = widget.querySelector('.assistant-toggle')
  const closeBtn = widget.querySelector('.assistant-close')
  const panel = widget.querySelector('.assistant-panel')
  const form = widget.querySelector('.assistant-form')
  const input = widget.querySelector('.assistant-input')
  const messages = widget.querySelector('.assistant-messages')

  const appendMessage = (text, className) => {
    const div = document.createElement('div')
    div.className = `assistant-message ${className}`
    div.textContent = text
    messages.appendChild(div)
    messages.scrollTop = messages.scrollHeight
  }

  const togglePanel = (open) => {
    panel.classList.toggle('open', open)
  }

  toggleBtn.addEventListener('click', () => togglePanel(true))
  closeBtn.addEventListener('click', () => togglePanel(false))

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const question = input.value.trim()
    if (!question) return

    appendMessage(question, 'assistant-user')
    input.value = ''

    try {
      const response = await fetch('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })

      if (!response.ok) {
        throw new Error('Assistant is unavailable.')
      }

      const data = await response.json()
      appendMessage(data.answer || 'No response received.', 'assistant-bot')
    } catch (err) {
      appendMessage(err.message, 'assistant-bot')
    }
  })
})()
