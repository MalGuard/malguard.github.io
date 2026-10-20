import {parse} from '@babel/parser';

const member=node=>{
 const parts=[];let current=node;
 while(current?.type==='MemberExpression'||current?.type==='OptionalMemberExpression'){
  if(parts.length>=256)return null;
  const property=current.computed?(current.property?.type==='StringLiteral'?current.property.value:''):current.property?.name;
  if(!property)return '';parts.push(property);current=current.object;
 }
 if(current?.type!=='Identifier')return '';
 parts.push(current.name);return parts.reverse().join('.');
};
const literal=node=>node?.type==='StringLiteral'?node.value:undefined;

// Parse syntax without evaluating JavaScript. Comments and inert string examples
// cannot masquerade as executable calls. This is bounded static inspection, not
// a claim about the code's eventual runtime behavior.
export function scriptFacts(source){
 if(source.length>512*1024)return {status:'incomplete',reason:'size',calls:[],strings:[],navigation:[],requests:[]};
 let ast;try{ast=parse(source,{sourceType:'unambiguous',errorRecovery:false,plugins:['jsx']});}
 catch{return {status:'incomplete',reason:'syntax',calls:[],strings:[],navigation:[],requests:[]};}
 const facts={status:'done',calls:[],strings:[],navigation:[],requests:[],valueRead:false,encodedEvaluation:false};
 const stack=[ast];let visited=0;
 while(stack.length){
  if(++visited>100000){facts.status='incomplete';facts.reason='nodes';break;}
  const node=stack.pop();if(!node||typeof node!=='object')continue;
  if(node.type==='StringLiteral')facts.strings.push(node.value.slice(0,4096));
  if(node.type==='MemberExpression'&&((!node.computed&&node.property?.name==='value')||literal(node.property)==='value'))facts.valueRead=true;
  if(node.type==='CallExpression'||node.type==='NewExpression'||node.type==='OptionalCallExpression'){
   const name=member(node.callee);if(name===null){facts.status='incomplete';facts.reason='member-depth';break;}facts.calls.push(name);
   if(/(?:^|\.)(?:fetch|sendBeacon)$/.test(name)&&literal(node.arguments?.[0]))facts.requests.push(literal(node.arguments[0]));
   if(/\.open$/.test(name)&&literal(node.arguments?.[1]))facts.requests.push(literal(node.arguments[1]));
   if(/(?:^|\.)location\.(?:assign|replace)$/.test(name)&&literal(node.arguments?.[0]))facts.navigation.push(literal(node.arguments[0]));
   if(/(?:^|\.)(?:eval|Function)$/.test(name)){
    const nested=[...(node.arguments||[])];let count=0;
    while(nested.length&&count++<5000){const child=nested.pop();if(!child||typeof child!=='object')continue;if((child.type==='CallExpression'||child.type==='NewExpression'||child.type==='OptionalCallExpression')&&/(?:^|\.)(?:atob|unescape|fromCharCode)$/.test(member(child.callee)))facts.encodedEvaluation=true;for(const [key,value]of Object.entries(child)){if(['loc','comments','tokens'].includes(key))continue;if(Array.isArray(value)){for(const item of value)nested.push(item);}else if(value&&typeof value==='object')nested.push(value);}}
   }
  }
  if(node.type==='AssignmentExpression'){const name=member(node.left);if(name===null){facts.status='incomplete';facts.reason='member-depth';break;}if(/(?:^|\.)location(?:\.href)?$/.test(name)&&literal(node.right))facts.navigation.push(literal(node.right));}
  for(const [key,value]of Object.entries(node)){
   if(['loc','comments','tokens','leadingComments','trailingComments','innerComments','extra','errors'].includes(key))continue;
   if(Array.isArray(value)){for(const item of value)stack.push(item);}else if(value&&typeof value==='object')stack.push(value);
  }
 }
 return facts;
}
