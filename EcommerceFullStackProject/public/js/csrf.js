(() => {
  const tokenMeta = document.querySelector('meta[name="csrf-token"]')
  const csrfToken = tokenMeta ? tokenMeta.getAttribute('content') : ''
  if (!csrfToken) return

  document.querySelectorAll('form').forEach((form) => {
    const method = String(form.getAttribute('method') || 'GET').toUpperCase()
    if (method !== 'POST') return
    if (form.querySelector('input[name="_csrf"]')) return

    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = '_csrf'
    input.value = csrfToken
    form.appendChild(input)
  })

  const nativeFetch = window.fetch
  window.fetch = (resource, options = {}) => {
    const nextOptions = { ...options }
    const method = String(nextOptions.method || 'GET').toUpperCase()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const headers = new Headers(nextOptions.headers || {})
      if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrfToken)
      nextOptions.headers = headers
    }
    return nativeFetch(resource, nextOptions)
  }
})()
