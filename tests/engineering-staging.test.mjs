import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalLab} from '../tools/engineering-staging/lab.mjs';
test('isolated PostgreSQL lab exercises shared attempts, single use and account separation',async()=>{
 const lab=await createLocalLab();try{const result=await lab.runChecks();assert.equal(result.passed,true);assert.equal(result.checks.length,4);assert.ok(result.checks.every(c=>c.passed));assert.ok(!JSON.stringify(result).includes('sessionToken'));assert.ok(!JSON.stringify(result).includes('verificationToken'));}finally{await lab.close();}
});
