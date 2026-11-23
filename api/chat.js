// The rest of the site uses CommonJS Vercel entry points.
module.exports = async function handler(request, response) {
  const { endpoint } = await import('../services/site-builder/src/vercel.js');
  return endpoint('chat')(request, response);
};
