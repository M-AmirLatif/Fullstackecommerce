(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const applyStaggerDelays = () => {
    document.querySelectorAll('[data-stagger]').forEach((parent) => {
      const step = Number(parent.getAttribute('data-stagger') || 70)
      parent.querySelectorAll(':scope > [data-reveal]').forEach((child, index) => {
        if (!child.hasAttribute('data-reveal-delay')) {
          child.setAttribute('data-reveal-delay', String(index * step))
        }
      })
    })
  }

  const initReveal = () => {
    const items = Array.from(document.querySelectorAll('[data-reveal]'))
    if (!items.length) return

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target
          const delay = Number(el.getAttribute('data-reveal-delay') || 0)
          if (delay > 0) {
            window.setTimeout(() => el.classList.add('is-visible'), delay)
          } else {
            el.classList.add('is-visible')
          }
          observer.unobserve(el)
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' },
    )

    items.forEach((el) => observer.observe(el))
  }

  const initButtonPress = () => {
    document.querySelectorAll('.btn, .auth-submit').forEach((btn) => {
      btn.addEventListener('pointerdown', () => btn.classList.add('is-pressing'))
      const clear = () => btn.classList.remove('is-pressing')
      btn.addEventListener('pointerup', clear)
      btn.addEventListener('pointercancel', clear)
      btn.addEventListener('pointerleave', clear)
    })
  }

  const initToastEntrance = () => {
    const toast = document.querySelector('.toast')
    if (!toast) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('toast--in'))
    })
  }

  const initHeroTyping = () => {
    const targets = Array.from(
      document.querySelectorAll('.hero-title, .auth-hero-title, .admin-hero h1'),
    ).filter((el) => el && el.childElementCount === 0)

    if (!targets.length) return

    if (reduceMotion) {
      targets.forEach((el) => el.classList.add('typing-done'))
      return
    }

    let chainDelay = 120

    targets.forEach((el) => {
      const original = (el.textContent || '').trim()
      if (!original) return

      el.classList.add('typing-ready')
      el.setAttribute('aria-label', original)

      const textNode = document.createElement('span')
      textNode.className = 'typed-text'
      const caret = document.createElement('span')
      caret.className = 'typed-caret'
      caret.setAttribute('aria-hidden', 'true')

      el.textContent = ''
      el.append(textNode, caret)

      let index = 0
      const startTyping = () => {
        el.classList.remove('typing-ready')
        el.classList.add('is-typing')

        const tick = () => {
          index += 1
          textNode.textContent = original.slice(0, index)
          if (index >= original.length) {
            el.classList.remove('is-typing')
            el.classList.add('typing-done')
            window.setTimeout(() => caret.remove(), 220)
            return
          }

          const char = original[index - 1]
          const pause =
            char === ' ' ? 18 :
            /[,.!?]/.test(char) ? 95 :
            34
          window.setTimeout(tick, pause)
        }

        tick()
      }

      window.setTimeout(startTyping, chainDelay)
      chainDelay += Math.min(750, original.length * 16 + 120)
    })
  }

  applyStaggerDelays()
  initReveal()
  initButtonPress()
  initToastEntrance()
  initHeroTyping()
})()
