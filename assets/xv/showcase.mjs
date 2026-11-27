const scenes = [...document.querySelectorAll('.xvb-scene')];

const currentScene = new IntersectionObserver(entries => {
  for (const entry of entries) entry.target.classList.toggle('xvb-active', entry.isIntersecting);
}, { threshold: .2 });
scenes.forEach(scene => currentScene.observe(scene));

const dialog = document.getElementById('xvb-model-dialog');
const title = document.getElementById('xvb-model-dialog-title');
const description = document.getElementById('xvb-model-dialog-description');
const destination = document.getElementById('xvb-model-dialog-link');
let selectedModel;
for (const tile of document.querySelectorAll('[data-xvb-model]')) {
  tile.setAttribute('aria-haspopup', 'dialog');
  tile.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectedModel = tile;
    title.textContent = tile.textContent.trim();
    description.textContent = tile.dataset.xvbModel;
    destination.href = tile.href;
    dialog.showModal();
  });
}
dialog.addEventListener('close', () => selectedModel?.focus());
