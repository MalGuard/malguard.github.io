// Atomic scripts use one Redis key per operation, including on clustered Redis.
export const scripts = {
  create: `
    if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
    redis.call('HSET', KEYS[1], 'html', ARGV[1], 'owner', ARGV[2], 'accepted', '0')
    redis.call('PEXPIRE', KEYS[1], ARGV[3])
    local t = redis.call('TIME')
    return t[1] * 1000 + math.floor(t[2]/1000) + tonumber(ARGV[3])`,
  read: `
    if redis.call('EXISTS', KEYS[1]) == 0 then return {410} end
    if ARGV[1] == 'accept' then
      if redis.call('HGET', KEYS[1], 'owner') ~= ARGV[2] then return {403} end
      redis.call('HSET', KEYS[1], 'accepted', '1')
    elseif redis.call('HGET', KEYS[1], 'accepted') == '1' then return {410} end
    return {200,redis.call('HGET', KEYS[1], 'html')}`,
  reserve: `
    local total = tonumber(redis.call('HGET', KEYS[1], 'total') or '0')
    local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
    local user = tonumber(redis.call('HGET', KEYS[1], ARGV[1]) or '0')
    if attempts >= tonumber(ARGV[3]) * 3 or total >= tonumber(ARGV[3]) or user >= tonumber(ARGV[4]) then return 0 end
    redis.call('HINCRBY', KEYS[1], 'total', 1)
    redis.call('HINCRBY', KEYS[1], 'attempts', 1)
    redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
    redis.call('HSET', KEYS[1], ARGV[2], ARGV[1])
    redis.call('EXPIRE', KEYS[1], 172800)
    return 1`,
  finish: `
    local user = redis.call('HGET', KEYS[1], ARGV[1])
    if user then
      if ARGV[2] == 'release' then
        redis.call('HINCRBY', KEYS[1], 'total', -1)
        redis.call('HINCRBY', KEYS[1], user, -1)
      end
      redis.call('HDEL', KEYS[1], ARGV[1])
    end
    return 1`
};

export function redisStore(env) {
  const endpoint = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  async function evaluate(script,key,...args) {
    if (!endpoint || !token || !endpoint.startsWith("https://")) throw new Error("Preview storage unavailable");
    const result = await fetch(endpoint, {
      method:"POST", redirect:"error", signal:AbortSignal.timeout(5000),
      headers:{Authorization:"Bearer " + token, "Content-Type":"application/json"},
      body:JSON.stringify(["EVAL",script,"1","malguard:agent:v1:"+key,...args.map(String)])
    });
    if (!result.ok) throw new Error("Preview storage unavailable");
    const data = await result.json();
    if (data.error || data.result === undefined) throw new Error("Invalid storage response");
    return data.result;
  }
  return {
    create: (id,html,ownerHash,ttl) => evaluate(scripts.create,"site:"+id,html,ownerHash,ttl),
    view: id => evaluate(scripts.read,"site:"+id,"view",""),
    accept: (id,ownerHash) => evaluate(scripts.read,"site:"+id,"accept",ownerHash),
    reserve: (key,account,reservation,total,user) => evaluate(scripts.reserve,key,"u:"+account,"r:"+reservation,total,user),
    finish: (key,reservation,success) => evaluate(scripts.finish,key,"r:"+reservation,success?"commit":"release")
  };
}
