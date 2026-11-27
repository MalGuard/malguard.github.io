const officialLogo = '/assets/fusion/assets/malguard-logo.svg';

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function conversationAction(label, handler) {
  const action = node('button', 'xvc-turn-action', label);
  action.type = 'button';
  action.addEventListener('click', handler);
  return action;
}

export function assistantIdentity() {
  const header = node('header', 'xvc-turn-identity');
  const logo = node('img');
  logo.src = officialLogo;
  logo.alt = '';
  logo.width = logo.height = 28;
  header.append(logo, node('strong', '', 'MalGuard XV'));
  return header;
}

export function userTurn({ bubble, attachment }, edit) {
  const turn = node('article', 'xvc-turn-user');
  turn.setAttribute('aria-label', 'Your message');
  const text = node('div', 'bubble', bubble);
  text.dir = 'auto';
  if (attachment) {
    const info = node('div', 'xvc-turn-file');
    const name = node('strong', '', attachment.name);
    name.dir = 'auto';
    info.append(name, node('small', '', `Attachment · ${fileSize(attachment.size)}`));
    text.append(info);
  }
  const actions = node('div', 'xvc-turn-actions');
  actions.append(conversationAction(attachment ? 'Reuse text' : 'Edit as draft', () => edit(bubble)));
  actions.append(conversationAction('Copy message', async event => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(bubble);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy unavailable';
    }
  }));
  turn.append(text, actions);
  return turn;
}

export function fileSize(bytes) {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${bytes} B`;
}

// Show only text actually received from a streaming model. Markdown and
// interactive elements are generated once, when the final message arrives.
export function streamReply(log, follow) {
  const card = node('article', 'result assistant-message xvc-stream-reply');
  const answer = node('p', 'answer');
  answer.dir = 'auto';
  card.append(assistantIdentity(), answer);
  let text = '';
  let frame;
  return {
    update(value) {
      text = value;
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        follow(() => {
          if (!card.isConnected) log.append(card);
          answer.textContent = text;
        });
      });
    },
    finish(update) {
      cancelAnimationFrame(frame);
      follow(() => {
        card.remove();
        update();
      });
    },
    text: () => text
  };
}

// An in-memory thumbnail of the selected image. File contents are not put in
// history or submitted until the existing attachment consent succeeds.
export function attachmentThumbnail(file) {
  if (typeof createImageBitmap !== 'function') return null;
  const canvas = node('canvas', 'xvc-attachment-thumbnail');
  canvas.width = 96;
  canvas.height = 72;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  void createImageBitmap(file, {resizeWidth:96,resizeHeight:72}).then(bitmap => {
    try {
      const context = canvas.getContext('2d');
      if (!context || !canvas.isConnected) return;
      context.drawImage(bitmap, 0, 0);
      canvas.hidden = false;
    } finally {
      bitmap.close();
    }
  }).catch(()=>{});
  return canvas;
}
