(() => {
  const main = document.querySelector('#product-main-image')
  if (!main) return

  document.querySelectorAll('.product-thumbs .thumb').forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = btn.getAttribute('data-src')
      if (src) main.src = src
    })
  })
})()
