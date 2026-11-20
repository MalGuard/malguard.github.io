/**
 * Generate a username from the given name, and confirm availability against
 * the existing first-party account API before returning it. This is only a
 * preview: the server must recheck uniqueness and enforce the database UNIQUE
 * constraint when registering the account.
 */
export function usernameStem(firstName = '', lastName = '') {
  const pieces = [firstName, lastName]
    .map(value => String(value ?? '').trim().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, ''))
    .filter(Boolean);
  const stem = pieces.join('_').slice(0, 40).replace(/_+$/g, '');
  return stem.length >= 3 ? stem : 'MalGuard_User';
}

function suffix(random = globalThis.crypto) {
  if (!random || typeof random.getRandomValues !== 'function') {
    throw new Error('USERNAME_RANDOM_UNAVAILABLE');
  }
  const bytes = new Uint32Array(1);
  random.getRandomValues(bytes);
  return bytes[0].toString(36).padStart(7, '0').slice(-7);
}

export async function suggestAvailableUsername({firstName = '', lastName = '', check, random, maxAttempts = 6} = {}) {
  if (typeof check !== 'function') throw new TypeError('An account availability checker is required');
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new RangeError('Invalid attempt limit');
  const stem = usernameStem(firstName, lastName);
  const tried = new Set();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tail = attempt ? '_' + suffix(random) : '';
    const name = stem.slice(0, 48 - tail.length) + tail;
    if (tried.has(name)) continue;
    tried.add(name);
    let status;
    try { status = await check(name); }
    catch { throw new Error('USERNAME_AVAILABILITY_UNVERIFIED'); }
    if (status === 'available') return name;
    if (status !== 'taken' && status !== 'invalid') throw new Error('USERNAME_AVAILABILITY_UNVERIFIED');
  }
  throw new Error('USERNAME_NO_AVAILABLE_SUGGESTION');
}
