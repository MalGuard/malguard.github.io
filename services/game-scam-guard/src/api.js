// The application lives on Pages. Only its two canonical hosts use the cloud API;
// development and Vercel verification retain their own same-origin API.
export function apiUrl(endpoint,hostname=globalThis.location?.hostname){
  if(!['health','account-config','auth/status','auth/start','auth/verify','auth/session','scan','advanced','jobs/start','jobs/step','upload'].includes(endpoint))throw new Error('Unknown API endpoint');
  const origin=['malguard.site','malguard.github.io'].includes(hostname)?'https://game-scam-guard-connected.vercel.app':'';
  return `${origin}/api/game-scam-guard/${endpoint}`;
}
