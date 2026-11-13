export const PRODUCTION_MODELS_ORIGIN='https://models.malguard.site';
const PRODUCTION=new Set(['malguard.site','www.malguard.site','malguard.github.io','localhost','127.0.0.1']);

export function isFrontendPreviewHost(hostname){
  return /^malguard-galaxy-mobile-test-git-[a-z0-9-]+-mcazarderakhsh-4187\.vercel\.app$/i.test(hostname||'')
    || /^malguard-galaxy-mobile-test(?:-[a-z0-9]{6,16})?-mcazarderakhsh-4187\.vercel\.app$/i.test(hostname||'')
    || hostname==='malguard-galaxy-mobile-test.vercel.app';
}

export function modelsApiRoot(hostname=globalThis.location?.hostname){
  if(!hostname||PRODUCTION.has(hostname))return PRODUCTION_MODELS_ORIGIN;
  // Preview hosts use the same-origin preview proxy, never a browser-side bypass.
  if(isFrontendPreviewHost(hostname))return '';
  return PRODUCTION_MODELS_ORIGIN;
}
