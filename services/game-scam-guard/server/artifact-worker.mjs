import {parentPort,workerData} from 'node:worker_threads';
import {analyzeArtifactRaw} from './artifact-engine.js';
try{parentPort.postMessage(await analyzeArtifactRaw(workerData.bytes,workerData.name,{password:workerData.password}));}
catch{parentPort.postMessage({error:'تحلیل فایل کامل نشد.'});}
