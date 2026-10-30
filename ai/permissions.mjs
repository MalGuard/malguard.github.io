const key='malguard-ai-permissions-v1';
const fields=['fileUpload','websiteFetch','remoteLookup','modelShare','freeFallback'];
export function readPermissions(storage){
 try{const value=JSON.parse(storage.getItem(key));return Object.fromEntries(fields.map(f=>[f,value?.version===1&&value[f]===true]));}catch{return Object.fromEntries(fields.map(f=>[f,false]));}
}
export function savePermissions(storage,permissions){
 try{storage.setItem(key,JSON.stringify({version:1,...Object.fromEntries(fields.map(f=>[f,permissions[f]===true]))}));return true;}catch{return false;}
}
export function revokePermissions(storage){try{storage.removeItem(key);}catch{}}
