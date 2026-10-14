import { readFile } from 'node:fs/promises';

export async function readPreviewImage(stream, limit=1024*1024) {
  const chunks=[];let size=0;
  for await(const chunk of stream){size+=chunk.length;if(size>limit){stream.destroy?.();return null;}chunks.push(Buffer.from(chunk));}
  return size ? Buffer.concat(chunks) : null;
}

export async function renderCloudPreview(url, html) {
  const unavailable={status:'unavailable',detail:'پیش‌نمایش مرورگر جداگانه در دسترس نبود؛ شواهد HTML در گزارش آمده است.'};
  // Zero-budget operation must not silently create metered preview VMs.
  if (process.env.GUARD_CLOUD_PREVIEW_ENABLED !== 'true') return {status:'unavailable',detail:'پیش‌نمایش ابری خودکار برای کنترل هزینه فعال نیست؛ شواهد HTML دریافت‌شده در گزارش آمده است.'};
  if (!process.env.GUARD_BROWSER_SNAPSHOT_ID) return unavailable;
  let sandbox;
  try {
    const {Sandbox}=await import('@vercel/sandbox');
    sandbox=await Sandbox.create({source:{type:'snapshot',snapshotId:process.env.GUARD_BROWSER_SNAPSHOT_ID},resources:{vcpus:1},timeout:30000,persistent:false,ports:[],networkPolicy:'deny-all'});
    await sandbox.mkDir('/tmp/guard-preview');
    const driver=await readFile(new URL('./preview-worker.mjs',import.meta.url));
    await sandbox.writeFiles([
      {path:'/tmp/guard-preview/preview-worker.mjs',content:driver},
      {path:'/tmp/guard-preview/job.json',content:Buffer.from(JSON.stringify({url,html:html.toString('utf8')}))},
    ]);
    const command=await sandbox.runCommand({cmd:'node',args:['/tmp/guard-preview/preview-worker.mjs','/tmp/guard-preview/job.json'],cwd:'/vercel/sandbox',timeout:20000});
    if(command.exitCode!==0) return unavailable;
    const stream=await sandbox.readFile({path:'/tmp/guard-preview-output/preview.jpg'});
    if(!stream)return unavailable;
    const image=await readPreviewImage(stream);
    if(!image?.length)return unavailable;
    return {status:'done',image:`data:image/jpeg;base64,${image.toString('base64')}`,detail:'پیش‌نمایش مرورگر در ماشین جداگانهٔ سرور؛ جاوااسکریپت، دانلود و درخواست منابع بیرونی غیرفعال‌اند.'};
  } catch(error) {
    console.warn('Isolated preview unavailable:',error.code||error.name);
    return unavailable;
  } finally {if(sandbox)await sandbox.stop().catch(()=>{});}
}
