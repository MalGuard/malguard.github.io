const entry = new URL(location.href);
if (entry.hostname === 'malguard.github.io') {
  entry.hostname = 'malguard.site';
  entry.protocol = 'https:';
  location.replace(entry);
} else if (entry.searchParams.has('demo')) {
  entry.pathname = '/ai/classic.html';
  location.replace(entry);
}
