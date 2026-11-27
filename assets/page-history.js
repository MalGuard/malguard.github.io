(() => {
  document.querySelectorAll('[data-malguard-back]').forEach(button => {
    button.addEventListener('click', () => {
      try {
        const ref = document.referrer ? new URL(document.referrer) : null;
        if (ref && ref.origin === location.origin) {
          history.back();
          return;
        }
      } catch (_) {}
      location.href = '/';
    });
  });
})();
