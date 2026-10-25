import {createHash} from 'node:crypto';
import {identifyArtifact} from '../../../game-scam-guard/server/artifact-engine.js';
import {runCloudBehavior,cloudExecutionStatus} from '../../../game-scam-guard/server/cloud-execution.js';
import {InputError,report,text} from '../contracts.js';
const source={name:'MalGuard isolated Linux execution collector',url:'https://github.com/MalGuard/malguard.github.io/tree/main/services/game-scam-guard/server'};
export function createFileSandbox({behavior=runCloudBehavior,capability=cloudExecutionStatus,identify=identifyArtifact}={}){
 return {
  status:()=>{const state=capability();return {state:state.ready?'configured':'disabled',scope:'isolated_linux_execution',liveVerified:false,reason:text(state.reason),supported:state.supported,maxFileBytes:1048576};},
  async run(input,{consent}={}){
   if(!consent?.isolatedExecution)throw new InputError('isolated_execution_consent_required',403);
   if(!consent.fileUpload)throw new InputError('file_consent_required',403);
   if(!input.file)return report('file_sandbox','insufficient',{reason:'file_required',sources:[{...source,status:'not_checked'}],metadata:{executed:false,attempted:false}});
   if(!capability().ready)return report('file_sandbox','insufficient',{reason:'isolation_unavailable',sources:[{...source,status:'unavailable'}],metadata:{executed:false,attempted:false},limitations:[text(capability().reason),'No execution was attempted; validation and free-quota gates remain mandatory.']});
   const {bytes,name}=input.file,format=identify(bytes,name),r=await behavior(bytes,{name,format});
   const metadata={sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,format:text(format,80),executed:r.executed===true,attempted:r.attempted===true,teardownConfirmed:r.teardownConfirmed===true};
   if(r.executed===true){
    metadata.runtime=['elf','js','python','shell'].includes(r.runtime)?r.runtime:'unknown';
    metadata.isolation={uid:Number.isInteger(r.isolation?.uid)?r.isolation.uid:null,noNewPrivileges:r.isolation?.noNewPrivileges===true,networkProbeDenied:r.isolation?.networkProbeDenied===true,appSecretsAbsent:r.isolation?.appSecretsAbsent===true};
    metadata.execution={exitCode:Number.isInteger(r.execution?.exitCode)?r.execution.exitCode:null,timedOut:r.execution?.timedOut===true,budgetExceeded:r.execution?.budgetExceeded===true,durationMs:Number.isFinite(r.execution?.durationMs)?Math.max(0,Math.min(r.execution.durationMs,60000)):null};
    metadata.createdFileCount=Array.isArray(r.createdFiles)?Math.min(r.createdFiles.length,32):0;
   }
   return report('file_sandbox','insufficient',{reason:r.executed?'behavior_observed_no_verdict':'execution_unavailable',sources:[{...source,status:r.executed?(r.status==='done'&&r.teardownConfirmed?'completed':'partial'):'unavailable'}],metadata,evidence:r.executed?[{rule:'isolated_execution',detail:'The collector reported execution in an isolated Linux microVM. This is an observation, not a malware verdict.'}]:[],limitations:[text(r.reason),'Windows, Android, browser extensions and unknown formats are not executed by this Linux collector.','Raw sample output and created-file contents are never returned or sent to a language model.']});
  }
 };
}
