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

})()
