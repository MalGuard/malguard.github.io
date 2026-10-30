import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDevice,assessDesktopModel} from '../../../ai/model-compatibility.mjs';

const small={id:'native_qwen8',downloadGB:5.2};
const huge={id:'native_deepseek671',downloadGB:404};
const windows=detectDevice({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'});

test('Samsung Android, iOS and iPadOS never offer desktop Ollama downloads',()=>{
 for(const device of [
  detectDevice({userAgent:'Mozilla/5.0 (Linux; Android 16; SM-S928B) AppleWebKit/537.36 SamsungBrowser/29.0 Mobile Safari/537.36'}),
  detectDevice({userAgent:'Mozilla/5.0 (Linux; Android 16; SM-X900) AppleWebKit/537.36'}),
  detectDevice({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)'}),
  detectDevice({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',maxTouchPoints:5}),
  detectDevice({mobileHint:true,userAgent:'Mozilla/5.0 (Linux x86_64)'})
 ]){
  assert.equal(device.kind,'mobile');
  assert.equal(assessDesktopModel(small,device,{ramGB:32,freeDiskGB:999}).reason,'mobile');
  assert.equal(assessDesktopModel(huge,device,{ramGB:999,freeDiskGB:999}).status,'blocked');
 }
});
test('a Samsung Windows laptop is treated as desktop, not blocked based on brand',()=>{
 assert.equal(windows.kind,'desktop');
 assert.equal(assessDesktopModel(small,windows,{}).reason,'specs_required');
 assert.equal(assessDesktopModel(small,windows,{ramGB:16,freeDiskGB:100}).status,'eligible');
});
test('insufficient free disk and conservative memory rule produce actionable blocks',()=>{
 assert.equal(assessDesktopModel(huge,windows,{ramGB:512,freeDiskGB:256}).reason,'disk');
 assert.equal(assessDesktopModel(huge,windows,{ramGB:64,freeDiskGB:900}).reason,'memory_recommendation');
 assert.equal(assessDesktopModel(huge,windows,{ramGB:512,freeDiskGB:900}).status,'eligible');
 assert.equal(assessDesktopModel(small,windows,{ramGB:8,freeDiskGB:50,gpuGB:16}).status,'eligible');
});
test('unknown devices, invalid model specs, empty and malformed values do not enable a download',()=>{
 assert.equal(detectDevice({userAgent:'unknown'}).kind,'unknown');
 assert.equal(assessDesktopModel(small,{kind:'unknown'},{ramGB:32,freeDiskGB:100}).status,'unknown');
 for(const value of ['',undefined,'NaN','-10','Infinity','10000000']){
  assert.notEqual(assessDesktopModel(small,windows,{ramGB:value,freeDiskGB:50}).status,'eligible');
 }
 assert.equal(assessDesktopModel({id:'bad',downloadGB:0},windows,{ramGB:32,freeDiskGB:50}).status,'blocked');
});
