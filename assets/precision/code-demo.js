/* Only a few explicit patterns in built-in illustrative examples. No code execution. */
(()=>{
 const examples={
  clean:['const input = new URL(url);','const protocol = input.protocol;','const allowed = protocol === "https:";','const scope = "URL text only";','return { allowed, scope };'],
  risky:['const payload = "ZXhhbXBsZQ==";','const decoded = atob(payload);','eval(decoded);','// decoded code would execute','// do not run unknown payloads']
 };
 function review(lines){const source=lines.join('\n'),flags=[];if(/\beval\s*\(/.test(source)&&/\batob\s*\(/.test(source))flags.push('Encoded dynamic execution');if(/document\.cookie/.test(source)&&/\bfetch\s*\(/.test(source))flags.push('Cookie read with a network request');return {verdict:flags.length?'flagged':'reviewed',flags};}
 globalThis.MalGuardCodeDemo=Object.freeze({examples,review});
})();
