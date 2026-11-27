const search = document.getElementById('search');
const topics = Array.from(document.querySelectorAll('#topics details'));
const empty = document.getElementById('empty');

search.addEventListener('input', () => {
  const query = search.value.trim().toLocaleLowerCase();
  for (const topic of topics) {
    topic.hidden = !topic.textContent.toLocaleLowerCase().includes(query);
  }
  empty.style.display = topics.every(topic => topic.hidden) ? 'block' : 'none';
});
