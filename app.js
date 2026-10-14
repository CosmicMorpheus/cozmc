document.documentElement.classList.add('has-js');

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(isOpen));
  navigation.classList.toggle('is-open', isOpen);
});
navigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
window.matchMedia('(min-width: 601px)').addEventListener('change', closeMenu);
document.querySelector('#year').textContent = String(new Date().getFullYear());

const copyButton = document.querySelector('.copy-link');
const toast = document.querySelector('.toast');
let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 5500);
}
copyButton.addEventListener('click', async () => {
  const siteUrl = new URL('./', window.location.href).href;
  try {
    await navigator.clipboard.writeText(siteUrl);
    showToast('Website link copied.');
  } catch {
    showToast(`Website address: ${siteUrl}`);
  }
});
document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      showToast(`${button.dataset.copyLabel} copied.`);
    } catch {
      showToast(`${button.dataset.copyLabel}: ${button.dataset.copy}`);
    }
  });
});

const holographicCard = document.querySelector('.holographic-card');
const cardMotionButton = document.querySelector('.card-motion-toggle');
const wordmarkImages = document.querySelectorAll('.wordmark-image');
cardMotionButton.addEventListener('click', () => {
  const isPaused = holographicCard.classList.toggle('is-paused');
  cardMotionButton.setAttribute('aria-pressed', String(isPaused));
  cardMotionButton.setAttribute('aria-label', isPaused ? 'Play animations' : 'Pause animations');
  cardMotionButton.textContent = isPaused ? 'Play animations' : 'Pause animations';
  wordmarkImages.forEach(image => {
    image.src = isPaused ? image.dataset.staticSrc : image.dataset.animatedSrc;
  });
});
