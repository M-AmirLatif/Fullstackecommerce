(() => {
  const toggle = document.querySelector('.nav-toggle')
  const links = document.querySelector('.nav-links')
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open')
    })
  }

  const toast = document.querySelector('.toast')
  if (toast) {
    setTimeout(() => {
      toast.classList.add('hide')
    }, 3000)
  }

  document.querySelectorAll('[data-submit-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const selector = btn.getAttribute('data-submit-target')
      const form = selector ? document.querySelector(selector) : null
      if (form) form.requestSubmit()
    })
  })

  const revealSelectors = [
    'main .hero',
    'main .section-head',
    'main .card',
    'main .product',
    'main .category-card',
    'main .promo-banner',
    'main .pagination-bar',
    '.admin-hero',
    '.stat-card',
    '.table-container',
    '.product-detail-grid',
    '.checkout-form',
    '.checkout-summary',
  ]

  const revealTargets = document.querySelectorAll(revealSelectors.join(','))
  if (revealTargets.length) {
    revealTargets.forEach((el, index) => {
      el.classList.add('reveal')
      const delay = Math.min(index * 60, 600)
      el.style.setProperty('--delay', `${delay}ms`)
    })

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible')
              observer.unobserve(entry.target)
            }
          })
        },
        { threshold: 0.2 }
      )
      revealTargets.forEach((el) => observer.observe(el))
    } else {
      requestAnimationFrame(() => {
        revealTargets.forEach((el) => el.classList.add('is-visible'))
      })
    }
  }
})()
