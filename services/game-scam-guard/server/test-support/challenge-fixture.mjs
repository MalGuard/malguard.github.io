// Test-only shared transaction model. Production must use the database RPC.
export function challengeFixture(now=Date.now){
 const rows=new Map(),sends=new Map();
 return {enabled:true,async issue({id,subject}){const old=sends.get(subject)||0;if(old>=3)return false;sends.set(subject,old+1);rows.set(id,{count:0,used:false,expires:now()+600000});return true;},async attempt({id,matched}){const row=rows.get(id);if(!row||row.used||row.expires<=now()||row.count>=5)return false;row.count++;if(matched)row.used=true;return matched;}};
}
