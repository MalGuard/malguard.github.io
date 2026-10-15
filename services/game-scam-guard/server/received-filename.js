// An observed filename helps select static parsers/runtimes, not publisher trust.
// It is metadata only: never use it as a local path or a shell argument.
const valid=value=>typeof value==='string'&&value.length>0&&value.length<=180&&!/[\x00-\x1f\x7f\/\\]/.test(value)&&!['.','..'].includes(value);
import {FILE_LINK} from './site-analysis.js';
const recognized=value=>FILE_LINK.test(value)||/\.(?:vbs|txt|json|xml|html?|ini|cfg|manifest)$/i.test(value);

export function receivedFilename(response,fallback='فایل'){
  const header=response.headers?.['content-disposition'];
  if(typeof header==='string'&&header.length<=2048){
    const encoded=/(?:^|;)\s*filename\*\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(header);
    const utf8=/^UTF-8'[^']*'(.*)$/i.exec((encoded?.[1]??encoded?.[2]??'').trim());
    if(utf8)try{const name=decodeURIComponent(utf8[1]);if(valid(name))return name;}catch{}
    const plain=/(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(header);
    const name=(plain?.[1]??plain?.[2]??'').trim();if(valid(name))return name;
  }
  let basename;
  try{basename=decodeURIComponent(new URL(response.url).pathname.split('/').pop());}catch{}
  if(valid(basename)&&recognized(basename))return basename;
  if(valid(fallback)&&recognized(fallback))return fallback;
  return valid(basename)?basename:valid(fallback)?fallback:'فایل';
}
