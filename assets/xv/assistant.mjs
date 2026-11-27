// The approved XV view is opt-in. It takes model availability and actions
// from the original application and never creates a provider connection.
const logo = '/assets/fusion/assets/malguard-logo.svg';
const prompt = 'Ask anything about security, files, games, or threats…';
const paths = { workspace: '/ai/xv/', analysis: '/ai/xv/#xvc-upload', radar: '/threat-radar.html' };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function image(src, width) {
  const node = element('img');
  node.src = src;
  node.alt = '';
  node.width = node.height = width;
  return node;
}

function icon(id, sprite = 'assistant-icons') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `/assets/xv/${sprite}.svg#${id}`);
  node.setAttribute('aria-hidden', 'true');
  node.append(use);
  return node;
}

function link(label, href, glyph) {
  const node = element('a', '', label);
  node.href = href;
  if (glyph) node.prepend(icon(glyph));
  return node;
}

function loadXV() {
  const byId = id => document.getElementById(id);
  const select = byId('model');
  const intro = document.querySelector('.workspace .intro');
  const header = document.querySelector('.site-header');
  const composer = document.querySelector('.composer-area');
  const sidebar = byId('navigation');
  const sidebarToggle = byId('navigation-toggle');
  const input = byId('message');
  const account = byId('account');
  const mobile = matchMedia('(max-width: 635px)');
  const drawer = matchMedia('(max-width: 940px), (max-width: 1100px) and (orientation: portrait)');
  const landscape = matchMedia('(min-width: 941px) and (max-width: 1400px) and (min-aspect-ratio: 1/1) and (max-aspect-ratio: 8/5)');
  const body = document.body;

  function setLayout() {
    const previous = body.dataset.xvcLayout;
    const layout = mobile.matches ? 'mobile' : drawer.matches ? 'portrait' : landscape.matches ? 'landscape' : 'desktop';
    if (previous === layout) return;
    body.dataset.xvcLayout = layout;
    const wasDrawer = previous === 'mobile' || previous === 'portrait';
    if (drawer.matches !== wasDrawer && body.classList.contains('navigation-closed') !== drawer.matches) {
      sidebarToggle.click();
    }
  }
  setLayout();
  for (const query of [mobile, drawer, landscape]) query.addEventListener('change', setLayout);

  for (const path of ['foundation.css', 'product.css', 'assistant.css', 'conversation.css']) {
    const css = element('link');
    css.rel = 'stylesheet';
    css.href = '/assets/xv/' + path;
    document.head.append(css);
  }
  body.classList.add('xvc-assistant');

  const log = byId('conversation');
  const conversationHeader = element('header', 'xvc-chat-header');
  const conversationTitle = element('h1', '', 'Conversation');
  conversationTitle.id = 'xvc-chat-title';
  const modelPicker = element('select', 'xvc-chat-model');
  modelPicker.setAttribute('aria-label', 'Conversation model');
  modelPicker.addEventListener('change', () => selectModel(modelPicker.value));
  conversationHeader.append(conversationTitle, modelPicker);
  log.before(conversationHeader);
  log.tabIndex = 0;
  new MutationObserver(() => {
    if (log.children.length) {
      intro.parentElement.setAttribute('aria-labelledby', conversationTitle.id);
    } else {
      refresh();
    }
  }).observe(log, { childList: true });

  // On iOS the keyboard can shrink the visual viewport without resizing the
  // document. Give the focused composer scroll room only while it's occluded.
  const visual = window.visualViewport;
  if (visual) {
    let frame;
    function updateComposerViewport() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const active = body.dataset.xvcLayout !== 'desktop' && document.activeElement === input && Math.abs(visual.scale - 1) < .01;
        const inset = active ? document.documentElement.clientHeight - visual.height : 0;
        if (inset < 96) {
          body.style.removeProperty('--xvc-ai-keyboard-inset');
          return;
        }
        body.style.setProperty('--xvc-ai-keyboard-inset', `${Math.ceil(inset)}px`);
        if (log.children.length && body.dataset.projectOpen !== 'true') return;
        const below = byId('composer').getBoundingClientRect().bottom - visual.offsetTop - visual.height + 12;
        if (below > 0) window.scrollBy(0, Math.ceil(below));
      });
    }
    visual.addEventListener('resize', updateComposerViewport);
    input.addEventListener('focus', updateComposerViewport);
    input.addEventListener('blur', updateComposerViewport);
  }

  function nav(className, name, items) {
    const row = element('nav', className);
    row.setAttribute('aria-label', name);
    for (const item of items) {
      const anchor = link(...item);
      if (item[0] === 'AI Assistant') anchor.setAttribute('aria-current', 'page');
      row.append(anchor);
    }
    return row;
  }

  const brand = link('MalGuard ', paths.workspace);
  brand.className = 'xvc-ai-brand';
  brand.prepend(image(logo, 48));
  brand.append(element('b', '', 'XV'));
  const top = nav('xvc-ai-top', 'Product navigation', [
    ['Workspace', paths.workspace], ['AI Assistant', '/ai/?view=xv'], ['Analysis', paths.analysis], ['Threat Radar', paths.radar]
  ]);
  const utilities = element('div', 'xvc-ai-utilities');
  const search = element('button', 'xvc-ai-utility');
  search.type = 'button';
  search.setAttribute('aria-label', 'Search chats');
  search.setAttribute('aria-keyshortcuts', 'Control+K Meta+K');
  search.append(icon('search'));
  const notifications = element('details', 'xvc-ai-notifications');
  const bell = element('summary', 'xvc-ai-utility');
  bell.setAttribute('aria-label', 'Notifications');
  bell.append(icon('bell'));
  notifications.append(bell, element('p', 'xvc-ai-flyout', 'No notifications are available in this view.'));
  const profile = element('div', 'xvc-ai-profile');
  profile.append(icon('user'), account);
  utilities.append(search, notifications, profile);
  header.prepend(brand, top, utilities);

  // Keep the original sidebar controls as the working search and settings view.
  for (const child of sidebar.children) child.classList.add('xvc-ai-legacy');
  const rail = nav('xvc-ai-rail', 'AI assistant', [
    ['AI Assistant', '/ai/?view=xv', 'sparkle'], ['Workspace', paths.workspace, 'home'],
    ['Analysis', paths.analysis, 'analysis'], ['Reports', '/ai/xv/?view=report', 'file'],
    ['Models', '#xvc-available-models', 'models'], ['Tools', '/tools.html', 'tools'], ['Documentation', '/docs.html', 'book']
  ]);
  const badge = link('', paths.workspace);
  badge.className = 'xvc-ai-badge';
  const badgeTitle = element('strong', '', 'MalGuard ');
  badgeTitle.append(element('b', '', 'XV'));
  badge.append(image(logo, 66), badgeTitle, element('small', '', 'AI Cyber Defense'));
  sidebar.prepend(rail, badge);
  sidebar.addEventListener('click', event => {
    if (!drawer.matches || !event.target.closest('.history-open') || log.getAttribute('aria-busy') === 'true') return;
    if (!body.classList.contains('navigation-closed')) sidebarToggle.click();
    body.classList.remove('xvc-ai-searching');
    sidebarToggle.focus({preventScroll:true});
  });
  const closeSearch = element('button', 'xvc-ai-search-close', 'Back to navigation');
  closeSearch.type = 'button';
  sidebar.prepend(closeSearch);
  search.addEventListener('click', () => {
    document.body.classList.add('xvc-ai-searching');
    if (document.body.classList.contains('navigation-closed')) sidebarToggle.click();
    byId('chat-search').focus();
    byId('chat-search').select();
  });
  function dismissSearch() {
    document.body.classList.remove('xvc-ai-searching');
    if (!body.classList.contains('navigation-closed') && (drawer.matches || log.children.length)) sidebarToggle.click();
    search.focus();
  }
  closeSearch.addEventListener('click', dismissSearch);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      search.click();
    }
  }, { capture: true });

  const heading = element('div', 'xvc-ai-heading');
  const title = element('h1', '', 'AI ');
  title.id = 'xvc-assistant-title';
  title.append(element('em', '', 'Assistant'));
  heading.append(element('p', 'xvc-ai-kicker', 'XV LightFlow'), title,
    element('p', 'xvc-ai-subtitle', 'Multi-Model Intelligence for Security, Analysis and Development'));
  intro.prepend(heading);

  const deck = element('section', 'xvc-ai-deck');
  deck.setAttribute('aria-label', 'Model families');
  const cards = [];
  for (const [label, match, glyph, color] of [
    ['Llama 4', /llama.?4|scout/i, 'infinity', '#008dff'],
    ['Mistral', /mistral/i, 'mistral', '#f76d18'],
    ['GPT', /gpt|chat_think|openai/i, '', '#e2f6ff'],
    ['Gemini', /gemini|chat_flash/i, 'gemini', '#a768ff'],
    ['Nemotron', /nemotron|code_super|code_ultra/i, 'nemotron', '#78ca00']
  ]) {
    const button = element('button', 'xvc-ai-model');
    button.type = 'button';
    button.disabled = true;
    button.style.setProperty('--model-ink', color);
    button.append(glyph ? icon(glyph, glyph === 'nemotron' ? 'assistant-icons' : 'icons') : image('/assets/precision/provider-openai.svg', 34),
      element('span', '', label));
    button.addEventListener('click', () => {
      const option = [...select.options].find(item => !item.disabled && match.test(item.value));
      if (!select.disabled && option) selectModel(option.value);
    });
    cards.push({ button, label, match });
  }
  const center = element('div', 'xvc-ai-model-center');
  const selection = element('span', '', 'Auto');
  selection.setAttribute('aria-live', 'polite');
  center.append(image(logo, 92), element('strong', '', 'XV'), selection);
  const more = element('details', 'xvc-ai-more');
  more.id = 'xvc-available-models';
  const openModels = element('summary', 'xvc-ai-model');
  openModels.append(icon('more'), element('span', '', 'More'));
  const choices = element('div', 'xvc-ai-flyout xvc-ai-choices');
  more.append(openModels, choices);
  deck.append(...cards.slice(0, 3).map(card => card.button), center, ...cards.slice(3).map(card => card.button), more);
  composer.prepend(deck);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (document.body.classList.contains('xvc-ai-searching')) dismissSearch();
    else if (notifications.open) {
      notifications.open = false;
      bell.focus();
    } else if (more.open) {
      more.open = false;
      openModels.focus();
    } else if ((drawer.matches || log.children.length) && !body.classList.contains('navigation-closed')) {
      sidebarToggle.click();
      sidebarToggle.focus();
    }
  });
  rail.querySelector('a[href="#xvc-available-models"]').addEventListener('click', event => {
    if (deck.getClientRects().length === 0) return;
    event.preventDefault();
    if (drawer.matches && !body.classList.contains('navigation-closed')) sidebarToggle.click();
    more.open = true;
    openModels.focus();
  });

  function selectModel(value) {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const actions = element('nav', 'xvc-ai-actions');
  actions.setAttribute('aria-label', 'Assistant shortcuts');
  for (const [label, glyph, target] of [['Analyze', 'analysis', 'workspace-tab'], ['Build', 'code', 'build-tab']]) {
    const button = element('button', '', label);
    button.type = 'button';
    button.prepend(icon(glyph));
    button.addEventListener('click', () => byId(target).click());
    actions.append(button);
  }
  actions.append(link('Investigate', paths.radar, 'sparkle'));
  byId('composer').after(actions);
  byId('attach-toggle').querySelector('svg')?.replaceWith(icon('attachment'));
  byId('send-arrow').replaceChildren(...icon('send').childNodes);

  let listing = '';
  function refresh() {
    const options = [...select.options].filter(option => !option.disabled && option.value);
    for (const { button, label, match } of cards) {
      const matching = options.some(option => match.test(option.value));
      button.disabled = select.disabled || !matching;
      const available = !button.disabled;
      button.title = available ? label : `${label} is unavailable in this mode`;
      button.setAttribute('aria-label', button.title);
    }
    const selected = options.find(option => option.value === select.value);
    selection.textContent = selected ? (/auto/i.test(selected.value) ? 'Auto' : selected.textContent.split(' · ')[0]) : 'Auto';
    center.title = selected?.textContent ?? 'No model selected';
    const signature = JSON.stringify([select.disabled, options.map(option => [option.value, option.textContent])]);
    if (listing !== signature) {
      listing = signature;
      choices.replaceChildren();
      const available = options.filter(option => !option.value.startsWith('__'));
      if (available.length === 0) choices.append(element('p', '', 'No models are currently available.'));
      for (const option of options) {
        const button = element('button', '', option.textContent);
        button.type = 'button';
        button.disabled = select.disabled;
        button.addEventListener('click', () => {
          selectModel(option.value);
          more.open = false;
          if (!option.value.startsWith('__')) openModels.focus();
        });
        choices.append(button);
      }
    }
    if (modelPicker.dataset.options !== signature) {
      modelPicker.dataset.options = signature;
      modelPicker.replaceChildren(...options.map(option => {
        const copy = element('option', '', option.textContent);
        copy.value = option.value;
        return copy;
      }));
    }
    modelPicker.value = select.value;
    modelPicker.disabled = select.disabled || options.length === 0;
    const isChat = document.body.dataset.mode === 'chat';
    intro.parentElement.setAttribute('aria-labelledby', log.children.length ? conversationTitle.id : isChat ? title.id : 'title');
    const label = log.children.length && byId('media-draft').hidden ? 'Message MalGuard XV…' : prompt;
    if (isChat && byId('media-draft').hidden && input.placeholder !== label) input.placeholder = label;
  }
  const observer = new MutationObserver(refresh);
  observer.observe(select, { childList: true, attributes: true, subtree: true });
  observer.observe(input, { attributes: true, attributeFilter: ['placeholder'] });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
  select.addEventListener('change', refresh);
  refresh();
}

if (new URLSearchParams(location.search).get('view') === 'xv') loadXV();
