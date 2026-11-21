// Isolated, opt-in support API. Disabled unless SUPPORT_API_ENABLED=true
// and all secure server-side dependencies are configured.
module.exports=async function handler(req,res){
  const {default:supportHandler}=await import('../services/support/server/support-http.mjs');
  return supportHandler(req,res);
};
