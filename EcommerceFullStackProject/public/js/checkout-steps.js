(() => {
  const steps = Array.from(document.querySelectorAll('.checkout-step'))
  const indicators = Array.from(document.querySelectorAll('.checkout-steps .step'))
  if (!steps.length) return

  const requiredFields = Array.from(
    document.querySelectorAll('.checkout-step [required]'),
  )

  const updateRequired = (activeStep) => {
    requiredFields.forEach((field) => {
      const parentStep = field.closest('.checkout-step')
      const isActive = parentStep?.getAttribute('data-step') === String(activeStep)
      field.required = Boolean(isActive)
    })
  }

  const setStep = (target) => {
    steps.forEach((step) => {
      const isActive = step.getAttribute('data-step') === String(target)
      step.classList.toggle('active', isActive)
    })
    indicators.forEach((indicator) => {
      const isActive = indicator.getAttribute('data-step') === String(target)
      indicator.classList.toggle('active', isActive)
    })
    updateRequired(target)
  }

  setStep(1)

  document.querySelectorAll('[data-step-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setStep(btn.getAttribute('data-step-next'))
    })
  })

  document.querySelectorAll('[data-step-prev]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setStep(btn.getAttribute('data-step-prev'))
    })
  })
})()
