import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

export function blobStore(token, client = { get, put }, now = Date.now) {
  const options = { token, access: 'private' };
  const read = async key => {
    const result = await client.get(key, { ...options, useCache: false });
    if (!result) return null;
    return { value: await new Response(result.stream).json(), tag: result.blob.etag };
  };
  const write = (key, value, previous) => client.put(key, JSON.stringify(value), {
    ...options, addRandomSuffix: false, contentType: 'application/json', ttlDays: 1,
    ...(previous ? { ifMatch: previous.tag } : { allowOverwrite: false })
  });

  async function update(key, change) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const previous = await read(key);
      const { value, outcome } = change(previous?.value);
      if (!value) return outcome;
      try {
        await write(key, value, previous);
        return outcome;
      } catch (failure) {
        if (!(failure instanceof BlobPreconditionFailedError)) {
          // A concurrent first write can surface as a generic "already exists" error.
          if (previous || !/already exists/i.test(failure.message)) throw failure;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 35));
    }
    throw new Error('Preview state changed. Please retry.');
  }

  const previewKey = id => 'malguard-agent/v1/sites/' + id + '.json';
  const quotaPath = key => 'malguard-agent/v1/limits/' + key.replaceAll(':', '/') + '.json';
  return {
    create(id, html, owner, lifetime) {
      return update(previewKey(id), existing => {
        if (existing) return { outcome: 0 };
        const expiresAt = now() + lifetime;
        return { value: { html, owner, expiresAt, accepted: false }, outcome: expiresAt };
      });
    },
    async view(id) {
      const site = (await read(previewKey(id)))?.value;
      return !site || site.accepted || site.expiresAt <= now() ? [410] : [200, site.html];
    },
    accept(id, owner) {
      return update(previewKey(id), site => {
        if (!site || site.expiresAt <= now()) return { outcome: [410] };
        if (site.owner !== owner) return { outcome: [403] };
        const outcome = [200, site.html];
        return site.accepted ? { outcome } : { outcome, value: { ...site, accepted: true } };
      });
    },
    reserve(key, account, reservation, globalLimit, accountLimit) {
      return update(quotaPath(key), (quota = { total: 0, attempts: 0, users: {}, reservations: {} }) => {
        if (quota.attempts >= globalLimit * 3 || quota.total >= globalLimit
          || (quota.users[account] || 0) >= accountLimit) return { outcome: false };
        quota.total++;
        quota.attempts++;
        quota.users[account] = (quota.users[account] || 0) + 1;
        quota.reservations[reservation] = account;
        return { value: quota, outcome: true };
      });
    },
    finish(key, reservation, success) {
      return update(quotaPath(key), quota => {
        const account = quota?.reservations[reservation];
        if (!account) return { outcome: true };
        if (!success) {
          quota.total--;
          quota.users[account]--;
        }
        delete quota.reservations[reservation];
        return { value: quota, outcome: true };
      });
    }
  };
}
