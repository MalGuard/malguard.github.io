// Daily Cloudflare scheduled worker: delete private support files 30 days after
// a ticket is CLOSED. Reopened tickets are excluded. Fail closed and retry errors.
// This worker exposes no public HTTP endpoints and never uses user credentials.
export default {
  async fetch(){return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});},
  async scheduled(_controller,env,_context){
    const db=env.SUPPORT_DB,bucket=env.SUPPORT_FILES;
    if(!db||!bucket||typeof bucket.delete!=='function')
      throw Error('private_retention_bindings_unavailable');
    // Purge expired, provider-encrypted verification challenges without
    // keeping stale codes or session-bearing email tokens in D1.
    await db.prepare('DELETE FROM support_email_challenges WHERE expires_at<?')
      .bind(Date.now()-24*60*60*1000).run();
    const due=await db.prepare(
      "SELECT a.id AS attachment_id,a.ticket_id AS ticket_id FROM support_attachments AS a "+
      "JOIN support_tickets AS t ON t.id=a.ticket_id "+
      "WHERE t.status='closed' AND t.attachments_delete_at IS NOT NULL AND "+
      "t.attachments_delete_at<=? AND a.state!='deleted' LIMIT 100"
    ).bind(new Date().toISOString()).all();
    for(const item of due.results||[]){
      // Recheck closure immediately before deletion; a reopened ticket must
      // never have files deleted by an old scheduled batch.
      const check=await db.prepare(
        "SELECT id FROM support_tickets WHERE id=? AND status='closed' "+
        "AND attachments_delete_at IS NOT NULL AND attachments_delete_at<=?"
      ).bind(item.ticket_id,new Date().toISOString()).first();
      if(!check)continue;
      const parts=await db.prepare(
        'SELECT object_key FROM support_attachment_parts WHERE attachment_id=?'
      ).bind(item.attachment_id).all();
      try{
        await bucket.delete('tickets/'+item.ticket_id+'/ready/'+item.attachment_id);
        for(const p of parts.results||[])await bucket.delete(p.object_key);
      }catch{continue;} // Never claim deletion while R2 reports a failure.
      await db.prepare("UPDATE support_attachments SET state='deleted',deleted_at=?,consent_sha256=NULL,revoked_at=? WHERE id=? AND ticket_id=? AND state!='deleted'")
        .bind(new Date().toISOString(),new Date().toISOString(),item.attachment_id,item.ticket_id).run();
      await db.prepare('DELETE FROM support_attachment_parts WHERE attachment_id=?')
        .bind(item.attachment_id).run();
    }
  }
};
