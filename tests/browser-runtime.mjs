import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// CI uses the pinned dependency and its matching image. The local review can
// explicitly select its installed browser runtime without changing production.
const runtime=require(process.env.MALGUARD_QA_PLAYWRIGHT||'playwright');
export const chromium=runtime.chromium,webkit=runtime.webkit;
export function launchOptions(name){return name==='chromium'?{
 ...(process.env.TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.TEST_CHROMIUM_EXECUTABLE}:{}),
 args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']
}:{};}
