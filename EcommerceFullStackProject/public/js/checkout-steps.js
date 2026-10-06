(() => {
  const form = document.querySelector('#checkout-form')
  const steps = Array.from(document.querySelectorAll('.checkout-step'))
  const indicators = Array.from(document.querySelectorAll('.checkout-steps .step'))
  if (!steps.length) return

  const scrollToCheckoutTop = () => {
    const targetEl = document.querySelector('.checkout-steps') || document.querySelector('.checkout-container') || form
    if (targetEl) {
      const topOffset = targetEl.getBoundingClientRect().top + window.pageYOffset - 90
      window.scrollTo({
        top: Math.max(0, topOffset),
        behavior: 'smooth',
      })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const setStep = (target, shouldScroll = true) => {
    steps.forEach((step) => {
      const isActive = step.getAttribute('data-step') === String(target)
      step.classList.toggle('active', isActive)
    })
    indicators.forEach((indicator) => {
      const isActive = indicator.getAttribute('data-step') === String(target)
      indicator.classList.toggle('active', isActive)
    })

    if (shouldScroll) {
      // Small timeout ensures DOM layout reflow has completed before scrolling
      setTimeout(scrollToCheckoutTop, 30)
    }
  }

  setStep(1, false)

  document.querySelectorAll('[data-step-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const currentStepEl = btn.closest('.checkout-step')
      const targetStep = btn.getAttribute('data-step-next')

      // Validate inputs in current step before progressing
      if (currentStepEl) {
        const inputs = Array.from(currentStepEl.querySelectorAll('input[required], textarea[required], select[required]'))
        for (const input of inputs) {
          if (!input.value.trim() || !input.checkValidity()) {
            input.reportValidity()
            input.focus()
            return
          }
        }
      }

      setStep(targetStep, true)
    })
  })

  document.querySelectorAll('[data-step-prev]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setStep(btn.getAttribute('data-step-prev'), true)
    })
  })
})()
