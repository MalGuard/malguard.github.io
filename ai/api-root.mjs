export const PRODUCTION_MODELS_ORIGIN='https://models.malguard.site';
const PRODUCTION=new Set(['malguard.site','www.malguard.site','malguard.github.io','localhost','127.0.0.1']);

export function modelsApiRoot(hostname=globalThis.location?.hostname){
  if(!hostname||PRODUCTION.has(hostname))return PRODUCTION_MODELS_ORIGIN;
  const git=String(hostname).match(/^malguard-galaxy-mobile-test-git-([a-z0-9-]+)-mcazarderakhsh-4187\.vercel\.app$/i);
  if(git)return `https://malware-ai-git-${git[1]}-mcazarderakhsh-4187.vercel.app`;
  if(/^malguard-galaxy-mobile-test(?:-[a-z0-9]{6,16})?-mcazarderakhsh-4187\.vercel\.app$/i.test(hostname)
     ||hostname==='malguard-galaxy-mobile-test.vercel.app'){
    return 'https://malware-ai-git-web-pro-p0-mcazarderakhsh-4187.vercel.app';
  }
  return PRODUCTION_MODELS_ORIGIN;
}
