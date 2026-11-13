// Preview-only proxy entry. Disabled unless VERCEL_ENV is preview.
module.exports=async function(req,res){
  const {handlePreviewBackendProxy}=await import('../services/malguard-ai/server/preview-backend-proxy.mjs');
  return handlePreviewBackendProxy(req,res);
};
