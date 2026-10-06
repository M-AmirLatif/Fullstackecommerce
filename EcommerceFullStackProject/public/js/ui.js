(() => {
  // Mobile navigation drawer toggle
  const toggleBtn = document.querySelector('.nav-toggle-btn') || document.querySelector('.nav-toggle')
  const drawer = document.getElementById('mobileDrawer') || document.querySelector('.nav-links')
  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      drawer.classList.toggle('open')
    })

    document.addEventListener('click', (e) => {
      if (!drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
        drawer.classList.remove('open')
      }
    })
  }

  // Toast Auto-Dismissal & Click-to-Close
  const toasts = document.querySelectorAll('.toast')
  toasts.forEach((toast) => {
    // Click to dismiss immediately
    toast.style.cursor = 'pointer'
    toast.title = 'Click to dismiss'
    toast.addEventListener('click', () => dismissToast(toast))

    // Auto-dismiss after 2.5 seconds
    setTimeout(() => {
      dismissToast(toast)
    }, 2500)
  })

  function dismissToast(el) {
    if (!el || el.dataset.dismissing) return
    el.dataset.dismissing = 'true'
    el.classList.add('toast--exit')
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el)
    }, 320)
  }

  // Form submit triggers
  document.querySelectorAll('[data-submit-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const selector = btn.getAttribute('data-submit-target')
      const form = selector ? document.querySelector(selector) : null
      if (form) form.requestSubmit()
    })
  })
})()
