const fs=require('fs'),path=require('path');
const playwright=require(process.env.MALGUARD_QA_PLAYWRIGHT||'playwright');
const siteURL=(process.env.TEST_BASE_URL||'https://127.0.0.1:8443').replace(/\/?$/,'/');
if(siteURL!=='https://127.0.0.1:8443/')throw Error('Only the isolated local HTTPS fixture is permitted');
const chromiumLaunch={...(process.env.TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.TEST_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']};
module.exports={playwright,siteURL,chromiumLaunch};
