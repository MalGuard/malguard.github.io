// Opt-in server API. No provider credentials or arbitrary routes in the client.
module.exports=async function(req,res){
  const endpoint=req.query?.endpoint;
  if(!['status','chat'].includes(endpoint))return res.status(404).json({error:'not_found'});
  req.url=`/${endpoint}`;req.originalUrl=req.url;
  const {default:app}=await import('../services/malguard-ai/server/app.js');
  return app(req,res);
};
