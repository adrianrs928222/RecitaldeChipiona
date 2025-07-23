document.getElementById('comprar').addEventListener('click', () => {
  fetch('https://recitaldechipiona.onrender.com/create-checkout-session', {
    method: 'POST',
  })
  .then(res => res.json())
  .then(data => {
    window.location.href = data.url;
  });
});