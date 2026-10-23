export function replyLanguage(message,locale='en',history=[]){
 const text=String(message).replace(/```[\s\S]*?```|`[^`]*`|https?:\/\/\S+/gu,' ');
 if(/(?:به|زبان)\s*انگلیسی|\b(?:answer|reply|respond|write|translate)[^.!?\n]{0,40}\b(?:in|into|to) English\b/iu.test(text))return 'en';
 if(/(?:به|زبان)\s*فارسی|\b(?:answer|reply|respond|write|translate)[^.!?\n]{0,40}\b(?:in|into|to) (?:Persian|Farsi)\b/iu.test(text))return 'fa';
 if(/[\u0621-\u063a\u0641-\u064a\u0671-\u06d3]/u.test(text))return 'fa';
 if(/[a-z]/iu.test(text))return 'en';
 const previous=history.findLast(m=>m.role==='user'&&/[a-z\u0621-\u063a\u0641-\u064a\u0671-\u06d3]/iu.test(m.content));
 return previous?replyLanguage(previous.content,locale):locale;
}
