"""Prepare the approved Fusion surfaces and harmonize actual public pages.
No network calls and no deployment. The baseline remains reproducible in Git.
"""
from pathlib import Path
import argparse,hashlib,json,re,shutil,subprocess
ROOT=Path(__file__).resolve().parents[1]
BASE='52826c9d7a6fa533b322358639cb4a8e91df41e9'
arg=argparse.ArgumentParser();arg.add_argument('--reference',required=True);opt=arg.parse_args()
REF=Path(opt.reference).resolve();TARGET=ROOT/'assets/fusion';TARGET.mkdir(parents=True,exist_ok=True)
def baseline(path):return subprocess.check_output(['git','show',BASE+':'+str(path)],cwd=ROOT).decode()
runtime=['fonts.css','reference.css','styles.css','home-sections.css','home-opening.css','device-story.css','common.js','lab.js','home-opening.js','energy.js','home-sections.js','gta-guard.css','gta-guard.js','gta-guard-scene.js','gta-guard-source.js','gta-guard-scene-source.js','home-opening-scene.js','home-opening-scene-source.js']
assets=['malguard-logo.svg','gta-v-official.svg','Inter-OFL.txt','JetBrainsMono-OFL.txt','Sora-OFL.txt']+[f'font-{i}.ttf' for i in range(10)]

def resolve(text):
 # Shared navigation names the authentic brand mg-brand; the scene samples
 # its image into a texture. Keep that binding when transplanting the scene.
 text=text.replace("querySelector('.brand img')", "querySelector('.mg-brand img')").replace('querySelector(".brand img")', 'querySelector(".mg-brand img")')
 text=re.sub(r'([\"\'])(assets/[A-Za-z0-9_.\-/]+)(\?[^\"\']*)?\1',lambda m:m[1]+'/assets/fusion/'+m[2]+(m[3]or'')+m[1],text)
 text=re.sub(r'url\(assets/', 'url(/assets/fusion/assets/',text)
 for name in ['gta-guard-scene.js','home-opening-scene.js']:
  text=re.sub(r'([\"\'])'+re.escape(name)+r'(\?[^\"\']*)?\1',lambda m:m[1]+'/assets/fusion/'+name+(m[2]or'')+m[1],text)
 return text
for name in runtime:(TARGET/name).write_text(resolve((REF/name).read_text()).replace("const menu=document.querySelector('.site-menu');document","const menu=document.querySelector('.site-menu');if(menu){document").replace("menu.open=false));\n const shell","menu.open=false));}\n const shell"))
p=TARGET/'common.js';t=p.read_text()
t=t.replace("function flip(){","function flip(){const transferFocus=card.contains(document.activeElement);")
t=t.replace("card.setAttribute('aria-pressed',String(open));","card.dataset.flipped=String(open);card.querySelectorAll('.mg-card-control').forEach(b=>b.setAttribute('aria-expanded',String(open)));")
t=t.replace("if(e.target!==card)return;","if(e.target!==card&&!e.target.matches('.mg-card-control'))return;")
t=t.replace("card.addEventListener('pointermove',e=>{", "card.addEventListener('pointermove',e=>{if(e.target.closest('.mg-card-control,a'))return;")
t=t.replace("front.inert=open;back.inert=!open;link.tabIndex=open?0:-1;","front.inert=open;back.inert=!open;link.tabIndex=open?0:-1;if(transferFocus)(open?back:front).querySelector('.mg-card-control')?.focus({preventScroll:true});")
p.write_text(t)
(TARGET/'assets').mkdir(exist_ok=True)
for name in assets:shutil.copy2(REF/'assets'/name,TARGET/'assets'/name)
# The Lab is authored in CSS; its old laptop/model assets are not dependencies.
# No inactive Apple mark, laptop GLB or superseded device implementation is copied.
header='''<header class="nav mg-context-header" id="navbar"><div class="container nav-inner"><a href="/" class="mg-brand" aria-label="MalGuard home"><img src="/assets/fusion/assets/malguard-logo.svg" alt="" width="27" height="29">MalGuard</a><nav class="nav-links" id="navLinks" aria-label="All MalGuard pages" hidden><a href="/products.html">Products</a><a href="/tools.html">Tools</a><a href="/trust.html">Trust Center</a></nav><div class="nav-actions"><button class="nav-icon" id="searchButton" type="button" aria-label="Search MalGuard" aria-expanded="false" aria-controls="siteSearch"><svg class="search-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button><a class="nav-download" href="/download.html">GTA Guard status</a><button class="menu-btn" id="menuBtn" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="navLinks"><span class="menu-glyph" aria-hidden="true"><span></span><span></span><span></span></span></button></div></div></header>'''
footer='''<footer class="mg-site-footer"><div class="mg-footer-grid"><div><a class="mg-footer-brand" href="/">MalGuard</a><p>Scan smart. Play safe.</p><p>Security analysis reduces risk. No scan can guarantee that a file, mod, link, or destination is harmless.</p><p>A clean result is never a guarantee.</p></div><div><h2>TOOLS</h2><a href="/gta-guard.html">GTA Guard</a><a href="/malware-ai.html">Malware AI</a><a href="/game-scam-guard.html">Game Scam Guard</a><a href="/tools.html">Local tools</a><a href="/download.html">Release status</a></div><div><h2>SECURITY</h2><a href="/trust.html">Trust Center</a><a href="/privacy.html">Privacy</a><a href="/.well-known/security.txt">Security contact</a><a href="/labs.html">Labs</a><a href="https://github.com/MalGuard/malguard.github.io" target="_blank" rel="noopener">Open source</a></div><div><h2>SUPPORT</h2><a href="/docs.html">Documentation</a><a href="/support.html">Support</a><a href="/sandbox-help.html">Incomplete analysis</a><a href="/about.html">About MalGuard</a><a href="/founder.html">Founder</a><a href="/#admin-access">Administrator access</a></div></div></footer>'''
styles='<link rel="stylesheet" href="/assets/fusion/fonts.css"><link rel="stylesheet" href="/assets/malguard-unified.css?v=20261009-fusion">'
ctx='<script src="/assets/contextual-header.js?v=20261009-fusion" defer></script>'
unified='<script src="/assets/malguard-unified.js?v=20261009-fusion" defer></script>'
locale='<script type="module" src="/assets/i18n.mjs"></script>'
nojs='''<noscript><style>.mg-unified #navbar .menu-btn,.mg-unified #navbar .nav-icon{display:none!important}.mg-unified #navbar .mg-primary-links{display:flex!important;gap:8px!important}.mg-unified #navbar .mg-primary-links a{font-size:10px!important}.mg-unified .mg-reveal{opacity:1!important;filter:none!important;translate:none!important}.mg-fusion .scene .t,.mg-fusion .rv,.mg-fusion .hero,.mg-fusion .w{visibility:visible!important;opacity:1!important;filter:none!important;transform:none!important}.mg-fusion #home-opening-controls,.mg-fusion #home-opening{display:none!important}.site-entry-gate{display:none!important}</style></noscript>'''
base_index=baseline('index.html');gate=re.search(r'<section\b[^>]*id="siteEntryGate"[\s\S]*?</section>',base_index)[0]
gate=gate.replace('id="siteEntryGate"','id="siteEntryGate" data-optional="true" hidden')
page_paths=sorted(ROOT.glob('*.html'))+[ROOT/'ios-preview/index.html',*sorted((ROOT/'research').glob('*.html')),*sorted((ROOT/'release').glob('*.html'))]
records=[]
for page in page_paths:
 name=str(page.relative_to(ROOT));special=name in ['index.html','gta-guard.html'];text=(REF/name).read_text() if special else baseline(name)
 if special:
  for fname in runtime:text=re.sub(r'((?:href|src)=[\"\'])'+re.escape(fname)+r'(?=[?\"\'])',r'\g<1>/assets/fusion/'+fname,text)
  text=resolve(text)
  text=re.sub(r'content="noindex,nofollow"','content="index,follow"',text)
  text=re.sub(r'<link\b[^>]*rel="canonical"[^>]*>','',text)
  canonical='https://malguard.github.io/'+(''if name=='index.html' else name)
  text=text.replace('</head>','<link rel="canonical" href="'+canonical+'"><meta property="og:url" content="'+canonical+'"></head>')
  text=text.replace('https://malguard.github.io/','/')
  # Canonicals remain absolute; only navigation becomes local.
  text=text.replace('href="'+('/'if name=='index.html'else'/'+name)+'"><meta property="og:url"', 'href="'+canonical+'"><meta property="og:url"')
  text=re.sub(r'(<meta property="og:url" content=")[^"]*(")',r'\g<1>'+canonical+r'\2',text)
  text=re.sub(r'(<a\b[^>]*href=[\"\'](?:/|index\.html|gta-guard\.html)[^>]*?)\s+target="_blank"',r'\1',text)
  text=re.sub(r'href="index\.html(?=[#\"?])','href="/(?=[#\"?])',text) if False else text.replace('href="index.html#','href="/#').replace('href="index.html"','href="/"').replace('href="gta-guard.html','href="/gta-guard.html')
 if name=='index.html':
  text=text.replace('aria-pressed="false" class="card" role="button" tabindex="0"','data-flipped="false" class="card" role="group" tabindex="-1"')
  text=text.replace('<div class="face front">','<div class="face front"><button type="button" class="mg-card-control" aria-label="Show product details" aria-expanded="false">＋</button>')
  text=re.sub(r'(<div\b[^>]*class="face back"[^>]*>)',r'\1<button type="button" class="mg-card-control" aria-label="Return to product overview" aria-expanded="false">↶</button>',text)
  text=re.sub(r'<nav\b[^>]*>[\s\S]*?</nav>',header,text,count=1)
  text=re.sub(r'<body\b([^>]*)>',r'<body\1 class="mg-unified mg-fusion"><span id="admin-access" aria-hidden="true"></span>'+gate,text,count=1)
  text=text.replace('<main ', '<main tabindex="-1" ',1)
 elif name=='gta-guard.html':
  motion=re.search(r'<button[^>]*id="motion-toggle"[^>]*>[\s\S]*?</button>',text)[0].replace('id="motion-toggle"','id="motion-toggle" class="mg-motion-toggle"')
  text=re.sub(r'<header class="site-header">[\s\S]*?</header>',header+motion,text,count=1)
  text=re.sub(r'<body\b([^>]*)>',r'<body\1 class="mg-unified mg-gta">',text,count=1)
  text=text.replace('<footer class="page-footer">', '<footer class="mg-replace-footer">')
  text=re.sub(r'<footer class="mg-replace-footer">[\s\S]*?</footer>',footer,text,count=1)
  text=text.replace('<section class="content-section method-section" id="method"','<span id="models" aria-hidden="true"></span><span id="hybrid-isolation" aria-hidden="true"></span><section class="content-section method-section" id="method"')
  text=text.replace('<section class="content-section availability-section" id="availability"','<span id="platforms" aria-hidden="true"></span><span id="isolation" aria-hidden="true"></span><section class="content-section availability-section" id="availability"')
  text=text.replace('</section>\n\n    <section class="content-section trust-section', '<p class="legacy-release-link"><a class="button secondary" href="/download.html#updates">Check your installed build</a></p></section>\n\n    <section class="content-section trust-section',1)
 else:
  kind='mg-content-page'
  if name=='ios-preview/index.html':kind='mg-app-page'
  elif name=='malware-ai-windows.html':kind='mg-ai-app-page'
  elif name=='research/security-motion.html':kind='mg-content-page mg-research-page'
  # Append classes rather than changing application DOM or legacy selectors.
  def body(m):
   tag=m[0]
   if 'class='in tag:tag=re.sub(r'class="([^"]*)"',lambda c:'class="'+c[1]+' mg-unified '+kind+'"',tag)
   else:tag=tag[:-1]+' class="mg-unified '+kind+'">'
   return tag
  text=re.sub(r'<body\b[^>]*>',body,text,count=1)
  if 'id="navbar"' in text:text=re.sub(r'<header\b[^>]*id="navbar"[^>]*>[\s\S]*?</header>',header,text,count=1)
  elif name!='ios-preview/index.html':
   if re.search(r'<header\b',text):text=re.sub(r'<header\b[^>]*>[\s\S]*?</header>',header,text,count=1)
   else:text=re.sub(r'(<body\b[^>]*>)',r'\1'+header,text,count=1)
  if name=='ios-preview/index.html':text=text.replace('<main class="app">','<main class="app mg-app-shell">')
 if name=='research/repackaged-mod.html':
  text=text.replace('<div class="nav-actions">','<div class="nav-actions"><button type="button" class="nav-icon" data-malguard-back aria-label="Back to previous MalGuard page">←</button>',1)
 if name=='research/security-motion.html':
  text=text.replace('</header>','</header><button type="button" id="motion" class="mg-motion-toggle">Pause motion</button>',1)
 if name!='gta-guard.html':
  if re.search(r'<footer\b',text):text=re.sub(r'<footer\b[^>]*>[\s\S]*?</footer>',footer,text,count=1)
  else:text=text.replace('</body>',footer+'</body>')
 text=text.replace('>Windows download →','>Windows availability →')
 if name=='download.html':
  text=text.replace('The scanner. Ready for your next mod.','Preview status. Evidence before installation.')
  text=text.replace('<main id="main">','<main id="main"><aside class="notice container" id="public-download-status" style="margin-top:110px"><strong>Download paused.</strong> Public installer distribution remains paused. Existing authorized preview testers can use password-protected access below. No public installer link is offered.</aside>',1)
 if name=='products.html':
  text=text.replace('<span>Windows scanner</span>','<span>Download paused</span>')
 if name=='game-scam-guard.html':
  text=text.replace('<h1>Game Scam Guard</h1>','<h1>Game Scam Guard</h1><p class="notice">In development. No public release yet.</p>')
  text=text.replace('<head>', '<head><link rel="canonical" href="https://malguard.github.io/game-scam-guard.html">',1)
 # The active page controllers and i18n stay intact; do not load header twice.
 text=re.sub(r'<script\b[^>]*src="/assets/contextual-header\.js[^>]*>[\s\S]*?</script>','',text)
 text=text.replace('</head>',styles+'</head>')
 scripts=ctx+unified+(('<script src="/assets/site-entry.js?v=20261009-fusion" defer></script>') if name=='index.html' else '')+(locale if '/assets/i18n.mjs' not in text else '')
 text=text.replace('</body>',nojs+scripts+'</body>')
 page.write_text(text)
 records.append({'path':name,'baselineSHA256':hashlib.sha256(baseline(name).encode()).hexdigest(),'preparedSHA256':hashlib.sha256(text.encode()).hexdigest(),'surface':'approved Fusion'if special else'preserved content and functional controls'})
# Use the existing site navigation/search controller and its keyboard contract.
p=ROOT/'assets/contextual-header.js';text=p.read_text()
if "['Game Scam Guard'" not in text:
 text=text.replace("    ['GTA Guard',", "    ['Game Scam Guard', 'In development — no public release', '/game-scam-guard.html', 'game gaming scam'],\n    ['Malware AI', 'Platform-specific web preview', '/malware-ai.html', 'ai preview platforms'],\n    ['Windows AI Preview', 'Malware AI web workspace', '/malware-ai-windows.html', 'ai windows chat'],\n    ['iPhone Preview', 'Bounded local mobile inspection', '/ios-preview/', 'iphone ios'],\n    ['GTA Guard',",1)
if 'openAdminAccess'not in text:
 text=text.replace("  if (sections.length)","  if(document.body.classList.contains('mg-fusion')){const admin=document.createElement('button');admin.id='openAdminAccess';admin.type='button';admin.textContent='Administrator access';menu.append(admin);}else{menu.append(link('Administrator access','/#admin-access'));}\n  if (sections.length)")
p.write_text(text)
# The deployment continues to whitelist public assets, never the whole repo.
p=ROOT/'.github/workflows/static.yml';t=p.read_text();t=t.replace('cp index.html 404.html founder.html _site/','cp index.html 404.html founder.html game-scam-guard.html _site/');p.write_text(t)
p=ROOT/'sitemap.xml';t=p.read_text()
if '/game-scam-guard.html'not in t:t=t.replace('</urlset>','<url><loc>https://malguard.github.io/game-scam-guard.html</loc></url>\n</urlset>')
p.write_text(t)
report={'baselineCommit':BASE,'approvedFusionCommit':'303949729a0775e552549b913831e3d28e6a34b0','routes':records,'publicRouteCount':len(records),'unshippedDeveloperPrototypes':'Excluded from Pages exactly as before. No admin/server/download source is published.','functionalRuntimePreserved':['assets/public-release.mjs','assets/public-release-model.mjs','assets/i18n.mjs','assets/malware-ai-update.js','assets/page-history.js','ios-preview/app.js'],'assetPolicy':'Authentic marks, exact approved particle/GTA engine and time lines; no inactive laptop or Apple model copied.'}
(ROOT/'tests/unified-source-inventory.json').write_text(json.dumps(report,indent=2)+'\n')
print('Prepared',len(records),'public HTML routes with approved motion preserved and shared identity.')
