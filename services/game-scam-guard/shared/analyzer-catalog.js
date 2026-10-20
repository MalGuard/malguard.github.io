// Distinct, testable checks in one website analysis engine. These are not
// independent commercial antivirus products or promises of complete detection.
export const ANALYSIS_VERSION='2.0.0';
export const analyzerCatalog=[
 ['url-identity','URL identity','هویت نشانی','Checks IP-literal and mixed-script hostnames.','نشانی‌های عددی و دامنه‌های دارای خط‌های نوشتاری مخلوط بررسی می‌شوند.'],
 ['brand-domain','Gaming brand impersonation','جعل دامنهٔ برند بازی','Checks deceptive brand tokens in the actual hostname.','توکن‌های فریبندهٔ برند در نام واقعی دامنه بررسی می‌شوند.'],
 ['form-destinations','Sensitive form destinations','مقصد فرم‌های حساس','Checks where password and payment forms send data.','مقصد ارسال فرم‌های رمز و پرداخت بررسی می‌شود.'],
 ['form-methods','Sensitive form methods','روش ارسال فرم‌های حساس','Checks for sensitive values exposed through GET.','احتمال قرارگرفتن دادهٔ حساس در نشانی با روش گت بررسی می‌شود.'],
 ['verification-codes','Verification code collection','جمع‌آوری کد تأیید','Checks code forms for insecure or external destinations.','مقصد ناامن یا بیرونی فرم‌های کد تأیید بررسی می‌شود.'],
 ['wallet-secrets','Wallet recovery requests','درخواست عبارت بازیابی کیف پول','Checks actual form controls requesting wallet secrets.','فیلدهای واقعی فرم که عبارت بازیابی یا کلید خصوصی می‌خواهند بررسی می‌شوند.'],
 ['payment-boundary','Payment transport','ارتباط فرم پرداخت','Checks payment fields for unencrypted submission.','رمزگذاری ارتباط فرم‌های دارای اطلاعات کارت بررسی می‌شود.'],
 ['script-transport','Active mixed content','محتوای فعال با ارتباط ناامن','Checks HTTP script references on HTTPS pages.','اسکریپت‌های بدون رمزگذاری در صفحهٔ رمزگذاری‌شده بررسی می‌شوند.'],
 ['script-obfuscation','Encoded dynamic code','کد پویای رمزگذاری‌شده','Checks inline script syntax for decoding inside dynamic evaluation.','ساختار اسکریپت داخلی برای رمزگشایی در ارزیابی پویا بررسی می‌شود.'],
 ['credential-network','Credential and network patterns','الگوی دادهٔ ورود و شبکه','Checks inline code combining credential reads and external requests.','هم‌زمانی خواندن رمز و درخواست به مبدأ بیرونی در کد بررسی می‌شود.'],
 ['clipboard-traps','Clipboard execution traps','تلهٔ اجرای دستور از کلیپ‌بورد','Checks copy-to-clipboard code paired with shell-run instructions.','کد کپی در کلیپ‌بورد همراه با راهنمای اجرای دستور بررسی می‌شود.'],
 ['script-navigation','Script redirect targets','مقصد انتقال اسکریپتی','Checks literal cross-origin navigation assignments without executing them.','نشانی صریح انتقال اسکریپتی به مبدأ دیگر، بدون اجرای کد بررسی می‌شود.'],
 ['html-redirects','HTML redirect targets','مقصد انتقال در صفحه','Checks meta refresh destinations without following them.','مقصد انتقال خودکار در صفحه بدون دنبال‌کردن آن بررسی می‌شود.'],
 ['link-mismatch','Displayed link mismatch','ناسازگاری متن و مقصد لینک','Compares explicit URL labels with actual link hosts.','نام دامنهٔ نوشته‌شده روی لینک با مقصد واقعی آن مقایسه می‌شود.'],
 ['frame-boundaries','Embedded frame boundaries','مرز قاب‌های جاسازی‌شده','Checks active data frames and external sign-in frames.','قاب‌های دادهٔ فعال و قاب‌های ورود با مبدأ بیرونی بررسی می‌شوند.'],
 ['embedded-plugins','Legacy active plugins','افزونه‌های فعال قدیمی','Checks executable plugin MIME types and ActiveX objects.','نوع افزونه‌های اجرایی و اشیای اکتیوایکس بررسی می‌شود.'],
 ['service-workers','Persistent browser code','کد ماندگار مرورگر','Records service worker registration; presence alone is not a threat.','ثبت سرویس‌ورکر ثبت می‌شود؛ وجود آن به‌تنهایی نشانهٔ تهدید نیست.'],
 ['encoded-documents','Encoded embedded documents','سند جاسازی‌شدهٔ رمزگذاری‌شده','Checks executable HTML data documents without decoding or running them.','سندهای داده‌ای صفحه بدون رمزگشایی یا اجرا بررسی می‌شوند.'],
 ['web-mining','Browser mining patterns','الگوی استخراج در مرورگر','Checks specific mining endpoints and known mining script references.','مقصدها و منابع مشخص اسکریپت استخراج بررسی می‌شوند.'],
 ['resource-integrity','External script integrity','یکپارچگی اسکریپت بیرونی','Records missing integrity metadata; absence alone is not a threat.','نبود اطلاعات یکپارچگی ثبت می‌شود؛ این موضوع به‌تنهایی شاهد تهدید نیست.']
].map(([id,en,fa,enDetail,faDetail])=>({id,name:{en,fa},description:{en:enDetail,fa:faDetail}}));
