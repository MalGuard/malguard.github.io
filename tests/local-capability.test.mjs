import test from 'node:test';
import assert from 'node:assert/strict';
import {localCapabilityDetails} from '../ai/local-models.mjs';
test('local capability reports actionable reasons without downloading',async()=>{
 const gpu=features=>({requestAdapter:async()=>({features:new Set(features)})});
 assert.deepEqual(await localCapabilityDetails({secure:false,gpu:gpu(['shader-f16'])}),{ready:false,reason:'insecure_context'});
 assert.deepEqual(await localCapabilityDetails({secure:true,gpu:null}),{ready:false,reason:'webgpu_unavailable'});
 assert.deepEqual(await localCapabilityDetails({secure:true,gpu:{requestAdapter:async()=>null}}),{ready:false,reason:'adapter_unavailable'});
 assert.deepEqual(await localCapabilityDetails({secure:true,gpu:gpu([])}),{ready:false,reason:'shader_f16_unavailable'});
 assert.deepEqual(await localCapabilityDetails({secure:true,gpu:gpu(['shader-f16'])}),{ready:true,reason:'ready'});
 assert.deepEqual(await localCapabilityDetails({secure:true,gpu:{requestAdapter:async()=>{throw new Error('unavailable')}}}),{ready:false,reason:'adapter_unavailable'});
});
