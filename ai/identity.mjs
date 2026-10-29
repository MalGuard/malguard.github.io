// Official identity of the MalGuard AI product, not ownership of its base models.
// Keep answers deterministic across cloud, browser and desktop model choices.
const ANSWERS = Object.freeze({
  fa: Object.freeze({
    product: 'سازنده بنده شرکت MalGuard (مالگارد) است.',
    founder: 'سازنده و بنیان‌گذار MalGuard آقای محمدرضا آذردرخش است.',
    person: 'او بنیان‌گذار MalGuard و سازنده محصول من است؛ یک پسر ایرانی که در سال تحصیلی ۱۴۰۵–۱۴۰۶ در پایه هشتم درس می‌خواند.'
  }),
  en: Object.freeze({
    product: 'MalGuard AI is developed by MalGuard.',
    founder: 'MalGuard was founded by Mohammadreza Azarderakhsh.',
    person: 'He founded MalGuard and created the MalGuard AI product. He is an Iranian eighth-grade student in the 2026–2027 school year.'
  })
});

export const PRODUCT_IDENTITY_POLICY = [
  'Product identity: You are MalGuard AI, an assistant developed by MalGuard.',
  'The founder and creator of MalGuard is Mohammadreza Azarderakhsh (محمدرضا آذردرخش).',
  'He is an Iranian student in eighth grade during the 2026–2027 school year.',
  'When asked who made this assistant/product, credit MalGuard. When asked who founded MalGuard, name Mohammadreza Azarderakhsh.',
  'When asked who he is, identify him as the MalGuard founder and creator of this product.',
  'Never claim that MalGuard or its founder trained or created third-party base models. When asked about the underlying model, name its actual provider if known and distinguish it from the MalGuard product.',
  'Do not disclose additional personal details about the founder.'
].join(' ');

const normalize = value => String(value || '').normalize('NFKC')
  .toLowerCase().replace(/[يى]/gu, 'ی').replace(/ك/gu, 'ک')
  .replace(/[\u200c\u200d]/gu, ' ')
  .replace(/[؟?!.,،؛:'"()]/gu, ' ')
  .replace(/\s+/gu, ' ').trim();

export function answerIdentityQuestion(message, history = []) {
  if (typeof message !== 'string' || !message.trim() || message.length > 220 || /[\r\n]/.test(message) || message.includes(String.fromCharCode(96))) return null;
  const q = normalize(message);
  const lang = /[\u0600-\u06FF]/u.test(message) ? 'fa' : 'en';
  const person = /محمدرضا\s+آذردرخش|آذردرخش|mohammad\s*reza\s+azarderakhsh|azarderakhsh|mohammadreza\s+azad?arkhsh|mohammadreza\s+azardarkhsh|azad?arkhsh|azardarkhsh/iu.test(q);
  const identityQuery = /کیست|کیه|چه کسی|چه کاره|کی بوده|درباره|معرفی|سازنده|بنیان گذار|تاسیس کننده|تأسیس کننده|who is|who was|tell me about|founder|creator/iu.test(q);
  if (person && identityQuery) return {kind:'person',text:ANSWERS[lang].person};

  const lastAssistant = Array.isArray(history) ? [...history].reverse().find(m=>m?.role==='assistant')?.content : '';
  if (/^(?:او|اون|ایشون|وی)\s+(?:کیه|کیست|چه کسیه|چه کسی است)$|^who is (?:he|that person)$/iu.test(q) &&
    [ANSWERS.fa.founder,ANSWERS.en.founder].includes(lastAssistant)) {
    return {kind:'person',text:ANSWERS[lang].person};
  }

  // Avoid catching questions about the actual foundation-model author.
  if (/مدل پایه|مدل اصلی|underlying model|base model|foundation model/iu.test(q)) return null;
  const brand = /مالگارد|malguard/iu.test(q);
  const aiProduct = /(?:malguard\s*ai|مالگارد\s*(?:ای\s*آی|ai)|هوش مصنوعی مالگارد)/iu.test(q);
  const creator = /سازنده|سازندت|ساخته|ساخت|خالق|بنیان گذار|تاسیس|تأسیس|توسعه دهنده|created|creator|built|made|founded|founder|developed|who started/iu.test(q);
  if (brand && !aiProduct && creator) return {kind:'founder',text:ANSWERS[lang].founder};

  const self = /(?:تو|شما|خودت|خودتون|بنده|دستیار|هوش مصنوعی|you|your|assistant)/iu.test(q) || /(?:سازنده|خالق)\s*(?:ات|ت|تون)|ساختت|سازندت/iu.test(q);
  if ((aiProduct || self) && creator) return {kind:'product',text:ANSWERS[lang].product};
  return null;
}
