export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.status(200).json({status:'ok',app:'MalGuard ChatGPT MCP',version:'0.2.0',mode:'preview'});
}
