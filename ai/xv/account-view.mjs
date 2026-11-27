import { createAccount } from '../account.mjs';

const view = new URLSearchParams(location.search).get('view');
if (['signin', 'signup', 'policies', 'verify', 'verified'].includes(view)) setupAccount(view);

function icon(sprite, name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const use = document.createElementNS(ns, 'use');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', `/assets/xv/${sprite}.svg#${name}`);
  svg.append(use);
  return svg;
}

function setupAccount(openView) {
  const root = document.getElementById('xvc-auth');
  document.getElementById('xvc-workspace').hidden = true;
  document.querySelector('.xvc-skip').setAttribute('href', '#xvc-auth');
  root.tabIndex = -1;
  root.hidden = false;
  root.append(document.getElementById('xvc-auth-template').content.cloneNode(true));

  const mount = root.querySelector('#xvc-auth-mount');
  const policies = root.querySelector('#xvc-policies');
  const policyAgreed = policies.querySelector('#xvc-policy-agree');
  const policyContent = policies.querySelector('#xvc-policy-content');
  const control = document.createElement('button');
  control.type = 'button';
  control.hidden = true;
  root.append(control);
  let agreement;
  let priorStage = 'signup';
  let policyTrigger;
  const topics = [
    ['Terms of Service', [
      ['Account access', 'Keep your account details accurate and your sign-in credentials private.'],
      ['Use of the service', 'Use MalGuard for lawful, authorized analysis. Follow the instructions and scope of each tool.'],
      ['Service availability', 'Features may be unavailable or change. Check the app for current model and tool availability.']
    ], '/security-policy.html'],
    ['Privacy Policy', [
      ['Local and connected data', 'The workspace fingerprints files locally. Connected analysis and AI features describe what they send before use.']
    ], '/privacy.html'],
    ['Acceptable Use', [
      ['Authorized analysis', 'Only submit materials you have permission to inspect. The security policy explains responsible disclosure.']
    ], '/security-policy.html'],
    ['AI Disclaimer', [
      ['Review important results', 'AI outputs can be incomplete or incorrect. Verify findings against the evidence before relying on them.']
    ], '/ai/help/'],
    ['Data Retention', [
      ['Local workspace', 'The workspace stores recent report metadata and hashes for this browser tab. Read the privacy policy for connected services.']
    ], '/privacy.html']
  ];
  const topicNav = policies.querySelector('.xvc-policy-topics');
  for (const [index, [title, items, href]] of topics.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'xvc-chip';
    button.append(icon('showcase-icons', ['file','verify','layers','chip','fingerprint'][index]), title);
    button.addEventListener('click', () => {
      for (const topic of topicNav.children) topic.setAttribute('aria-current', String(topic === button));
      const heading = document.createElement('h2');
      heading.textContent = title;
      const description = document.createElement('p');
      description.textContent = 'Review this summary alongside the published MalGuard policies.';
      policyContent.replaceChildren(heading, description);
      for (const [headingText, detail] of items) {
        const h = document.createElement('h3');
        h.textContent = headingText;
        const p = document.createElement('p');
        p.textContent = detail;
        policyContent.append(h, p);
      }
      const link = document.createElement('a');
      link.href = href;
      link.textContent = 'Read the published policy';
      policyContent.append(link);
    });
    topicNav.append(button);
  }
  topicNav.firstElementChild.click();

  function setStage(stage) {
    root.dataset.stage = stage;
    const heading = mount.querySelector('[data-account-stage="' + stage + '"] h2');
    const display = { signin: ['Welcome ', 'Back', 'Sign in to your MalGuard XV account'], signup: ['Create an ', 'Account', 'Create your MalGuard XV account'], verify: ['Verify Your ', 'Email'] }[stage];
    if (heading && display && !heading.querySelector('em')) {
      if (stage === 'verify') {
        const mark = document.createElement('span');
        mark.className = 'xvc-verify-icon';
        mark.append(icon('product-icons', 'mail'));
        heading.before(mark);
      }
      const accent = document.createElement('em');
      accent.textContent = display[1];
      heading.replaceChildren(display[0], accent);
      if (display[2]) {
        const subtitle = document.createElement('p');
        subtitle.className = 'xvc-auth-subtitle';
        subtitle.textContent = display[2];
        heading.after(subtitle);
      }
    }
    document.title = `MalGuard XV · ${({signin:'Sign In',signup:'Create Account',verify:'Verify Email',verified:'Account Verified',policies:'Terms and Policies'})[stage]}`;
  }
  function showPolicies(trigger) {
    priorStage = root.dataset.stage || 'signup';
    policyTrigger = trigger;
    policyAgreed.checked = false;
    mount.hidden = true;
    policies.hidden = false;
    setStage('policies');
    policies.querySelector('h1').focus();
  }
  function returnToSignup(accepted) {
    if (!agreement?.isConnected) {
      account.open(true);
      priorStage = 'signup';
    }
    if (accepted && agreement) {
      agreement.checked = true;
      agreement.dispatchEvent(new Event('change'));
    }
    policies.hidden = true;
    mount.hidden = false;
    setStage(priorStage);
    (policyTrigger?.isConnected ? policyTrigger : mount.querySelector('input'))?.focus();
  }
  for (const button of policies.querySelectorAll('#xvc-policy-back,#xvc-policy-nav-back')) button.addEventListener('click', () => returnToSignup(false));
  policies.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    if (policyAgreed.checked) returnToSignup(true);
  });
  const account = createAccount({
    button: control,
    presentation: {
      mount,
      onStage: setStage,
      codeInput(input) {
        const group = document.createElement('span');
        group.className = 'xvc-code-entry';
        const boxes = Array.from({ length: 6 }, () => {
          const box = document.createElement('span');
          box.className = 'xvc-code-cell';
          box.setAttribute('aria-hidden', 'true');
          return box;
        });
        input.before(group);
        group.append(input, ...boxes);
        const sync = () => {
          const position = Math.min(input.selectionStart ?? input.value.length, 5);
          for (const [i, box] of boxes.entries()) {
            box.textContent = input.value[i] || '';
            box.toggleAttribute('data-active', document.activeElement === input && i === position);
          }
        };
        for (const event of ['input','focus','blur','keyup','click','select']) input.addEventListener(event, sync);
      },
      agreement(form) {
        const terms = document.createElement('button');
        terms.type = 'button';
        terms.className = 'xvc-open-policy xvc-chip';
        terms.textContent = 'Terms & Policies →';
        terms.addEventListener('click', () => showPolicies(terms));
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.required = true;
        const label = document.createElement('label');
        label.className = 'xvc-agreement';
        label.append(checkbox, ' I have read and agree to the Terms & Policies');
        form.append(terms, label);
        agreement = checkbox;
        return checkbox;
      },
      onSignedIn({ verified }) {
        if (!verified) {
          location.assign('./');
          return;
        }
        setStage('verified');
        const confirmation = root.querySelector('#xvc-verified');
        confirmation.hidden = false;
        confirmation.querySelector('h1').focus();
      }
    }
  });

  if (openView === 'policies') showPolicies();
  else {
    account.open(openView === 'signup');
    if (openView === 'verify' || openView === 'verified') {
      const notice = document.createElement('p');
      notice.role = 'status';
      notice.textContent = 'Start sign-in or registration to request a verification code.';
      mount.prepend(notice);
    }
  }
}
