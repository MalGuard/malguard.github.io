// The application lives on Pages. Only its two canonical hosts use the cloud API;
// development and Vercel verification retain their own same-origin API.
export function apiUrl(endpoint,hostname=globalThis.location?.hostname){
  if(!['health','account-config','auth/status','auth/google/start','auth/google/complete-signup','auth/start','auth/verify','auth/password','auth/session','scan','jobs/start','jobs/step'].includes(endpoint))throw new Error('Unknown API endpoint');
  const origin=['malguard.site','malguard.github.io'].includes(hostname)?'https://game-scam-guard-connected.vercel.app':'';
  return `${origin}/api/game-scam-guard/${endpoint}`;
}
