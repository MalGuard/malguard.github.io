"use strict";
const $ = selector => document.querySelector(selector);
const paths = {
 panel:"M4 4h16v16H4zM9 4v16", plus:"M12 4v16M4 12h16",clock:"M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 6v6l5 3", chat:"M4 4h16v13H9l-5 4z",crown:"M3 7l4 4 5-7 5 7 4-4-2 12H5z",arrow:"M4 12h15m-6-6 6 6-6 6", settings:"M9 4l1-2h4l1 2 2 1 2-.3 2 3-1 2v3l1 2-2 3h-2l-2 2-1 2h-4l-1-2-2-1H5l-2-3 1-2v-3L3 9l2-3h2z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",help:"M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01",search:"M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6",bell:"M4 17h16l-2-3V9a6 6 0 0 0-12 0v5zM10 20q2 3 4 0",user:"M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M3 21c0-9 18-9 18 0z",code:"M7 7l-6 5 6 5m10-10 6 5-6 5m-3-14-5 18",layers:"M2 7l10-5 10 5-10 5zM2 12l10 5 10-5M2 17l10 5 10-5",image:"M3 3h18v18H3zM3 18l6-7 4 4 3-3 5 6M16 7h.1",shield:"M12 2l9 4v6q-1 7-9 10-8-3-9-10V6zM8 12l3 3 5-6",bars:"M3 20v-6h2v6zM9 20V9h2v11zM15 20V6h2v14zM21 20V2h1v18z",pen:"M3 17l-1 5 5-1L21 7l-4-4zM14 6l4 4M12 22h10",chevron:"M6 9l6 6 6-6",globe:"M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M2 12h20M12 2q-8 10 0 20 8-10 0-20",grid:"M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",clip:"M9 16l8-8a2 2 0 0 0-3-3l-9 9a5 5 0 0 0 7 7l9-9",send:"M2 10l20-8-7 20-4-8 6-7-8 6z",file:"M5 2h9l5 5v15H5zM13 2v6h6M8 12h8m-8 4h6",mic:"M9 4a3 3 0 0 1 6 0v9a3 3 0 0 1-6 0zM5 13a7 7 0 0 0 14 0m-7 7v3",x:"M5 5l14 14m0-14L5 19"
};
function icon(name){const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");const path=document.createElementNS(svg.namespaceURI,"path");path.setAttribute("d",paths[name]);svg.append(path);return svg;}
document.querySelectorAll("[data-icon]").forEach(n=>n.replaceWith(icon(n.dataset.icon)));
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
const modes=[
 ["Code","Write, debug, and improve code","code","Build a website for "],
 ["Research","Find, analyze, and summarize information","layers","Research "],
 ["Create Images","Generate high-quality images from text","image",""],
 ["Security Analysis","Analyze threats, risks, and security posture","shield","Review this code for defensive improvements: "],
 ["Data","Analyze, visualize, and get insights","bars",""],
 ["Writing","Draft, refine, and improve any content","pen","Help me draft "]
];
const examples=["Analyze Q4 Security Report","Create a Marketing Plan","Explain Quantum Computing","Generate Product Images","Summarize Research Paper"];
const dialog=$("#dialog"), dialogBody=$("#dialogBody"), promptBox=$("#prompt");
function openDialog(title){if(dialog.open)dialog.close();dialog.querySelector("h2").textContent=title;dialogBody.replaceChildren();dialog.showModal();return dialogBody;}
function dialogButton(title,fn){const b=make("button",title,"dialog-action");b.onclick=fn;dialogBody.append(b);return b;}
function dialogLink(title,href){const a=make("a",title,"dialog-action");a.href=href;dialogBody.append(a);}
dialog.querySelector(".close").onclick=()=>dialog.close();
const showNotice=(message="")=>{const bar=$("#notice");bar.textContent=message;bar.hidden=!message;bar.dir="auto";};
let pendingActivity;
let active=null,busy=false,web=true,forceBuild=false,allowModel=false,allowSearch=false;
let chats=[];
try{chats=JSON.parse(sessionStorage.getItem("malguard.studio.chats")||"[]");if(!Array.isArray(chats))chats=[];}catch{}
function save(){try{sessionStorage.setItem("malguard.studio.chats",JSON.stringify(chats.slice(0,24)));}catch{}}
function setBusy(value){busy=value;$(".send").disabled=value;promptBox.readOnly=value;$("#composer").setAttribute("aria-busy",String(value));}
function usePrompt(s,build=false){if(dialog.open)dialog.close();forceBuild=build;promptBox.value=s;promptBox.focus();document.body.classList.remove("mobile-open");}
function fresh(){active=null;forceBuild=false;promptBox.value="";showNotice();render();}
function entry(){if(!active){active={id:crypto.randomUUID(),title:"",messages:[]};chats.unshift(active);}return active;}
function push(chat,role,content,project){if(!chat.title)chat.title=content.slice(0,80);chat.messages.push({role,content,...(project?{project}:{})});save();render();}
function recentButton(text,click,selected=false){const b=make("button",null,"recent"+(selected?" active":""));b.append(icon("chat"),make("span",text));b.title=text;b.onclick=click;return b;}
function renderRecent(){const nav=$("#recent");nav.replaceChildren();if(chats.length){chats.forEach(c=>nav.append(recentButton(c.title,()=>{active=c;promptBox.value="";forceBuild=false;showNotice();document.body.classList.remove("mobile-open");render();},c===active)));}else{examples.forEach((s,i)=>{const btn=recentButton(s,()=>usePrompt(s),i===0);btn.title="Start a conversation: "+s;nav.append(btn);});}}
function updateTime(){document.querySelectorAll("[data-expiry]").forEach(node=>{const remaining=Math.max(0,Math.ceil((Number(node.dataset.expiry)-Date.now())/1000));node.textContent=remaining?"Preview expires in "+Math.floor(remaining/60)+":"+String(remaining%60).padStart(2,"0"):"Preview expired";if(!remaining){node.parentNode.querySelector("a")?.remove();const b=node.parentNode.querySelector("button");if(b)b.disabled=true;}});}
function render(){document.body.classList.toggle("chat-mode",!!active);const pane=$("#conversation");pane.hidden=!active;pane.replaceChildren();renderRecent();for(const item of active?.messages||[]){const line=make("div",null,"message "+item.role);line.dir="auto";if(item.role==="assistant") appendMessage(line,item.content);else line.textContent=item.content;showSources(line,item.sources);pane.append(line);if(item.activity?.length) pane.append(activityPanel(item.activity));if(!item.project)continue;const p=item.project,r=make("div",null,"result");line.append(r);if(p.code)line.append(codeBlock(p.code,"html"));if(p.accepted){r.append(make("span","Preview closed · ZIP accepted"));if(Date.now()<p.expiresAt){const again=make("button","Download ZIP again");again.onclick=()=>accept(p,again);r.append(again);}continue;}const a=make("a","Open preview");a.href=p.url;a.target="_blank";a.rel="noopener noreferrer";const b=make("button","Accept & download ZIP");b.onclick=()=>accept(p,b);const t=make("span");t.dataset.expiry=p.expiresAt;r.append(a,b,t);}if(pendingActivity?.chat===active)pane.append(pendingActivity.panel,pendingActivity.draft);updateTime();}
setInterval(updateTime,1000);
let account;
const accountReady=import("/ai/account.mjs").then(({createAccount})=>{account=createAccount({button:make("button"),locale:()=>"en",onChange:()=>{}});return account.restore();}).catch(()=>null);
async function accept(p,btn){btn.disabled=true;try{await accountReady;const headers={"Content-Type":"application/json"};const res=await fetch("/api/accept",{method:"POST",headers,body:JSON.stringify({id:p.id,token:p.token})});if(!res.ok)throw Error(res.status===410?"Preview expired.":"Download could not be completed. Try again.");const blob=await res.blob();const url=URL.createObjectURL(blob),link=make("a");link.href=url;link.download="malguard-site.zip";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);p.accepted=true;save();render();}catch(e){showNotice(e.message);btn.disabled=false;}}
function pickFile(type){const input=$("#file");input.accept=type==="csv"?".csv":".txt,.md,.json,.csv,.html,.css,.js";input.click();}
async function attach(file){if(!file)return;try{if(file.size>1024*1024)throw Error("Choose a file smaller than 1 MiB.");const text=await file.text();if(/\.csv$/i.test(file.name)){const {summarizeCsv}=await import("./data-analysis.mjs");const summary=summarizeCsv(text);const c=entry();push(c,"user",file.name);push(c,"assistant",summary);showNotice();}else{if(promptBox.value.length+file.name.length+text.length+5>4200)throw Error("The attachment exceeds the message limit of 4,200 characters.");promptBox.value+=(promptBox.value?"\n\n":"")+file.name+"\n"+text;promptBox.focus();}}catch(e){showNotice(e.message);}}
$("#file").onchange=e=>{const file=e.target.files[0];e.target.value="";attach(file);};
function selectMode(i){if(i===4){pickFile("csv");return;}if(i===2){openDialog("Create Images").append(make("p","Use the image tools in the MalGuard workspace."));dialogLink("Open image workspace","/ai/classic.html#work");return;}usePrompt(modes[i][3],false);}
modes.forEach(([title,desc,glyph],i)=>{const b=make("button",null,"card");b.append(icon(glyph),make("b",title),make("small",desc));b.onclick=()=>selectMode(i);$(".cards").append(b);});
[["Analyze a file","file",()=>pickFile("any")],["Create a report","bars",()=>usePrompt("Create a report about ")],["Generate an image","image",()=>selectMode(2)],["Research a topic","mic",()=>selectMode(1)]].forEach(([t,g,fn])=>{const b=make("button");b.append(icon(g),document.createTextNode(t));b.onclick=fn;$(".quick").append(b);});
const actions={
 sidebar(){if(innerWidth<=720){document.body.classList.toggle("mobile-open");$(".backdrop").hidden=!document.body.classList.contains("mobile-open");}else document.body.classList.toggle("collapsed");},
 new(){fresh();document.body.classList.remove("mobile-open");promptBox.focus();},
 pro(){openDialog("Upgrade to Pro").append(make("p","The Pro plan includes higher daily chat and site generation limits. Contact MalGuard about availability for your account."));dialogLink("Contact MalGuard","/contact.html");},
 async account(){await accountReady;if(account)account.open();else showNotice("Account service unavailable.");},
 settings(){openDialog("Settings");dialogButton("MalGuard account",async()=>{await accountReady;dialog.close();if(account)account.open();else showNotice("Account service unavailable.");});dialogButton("Reset sharing permissions",()=>{allowModel=false;allowSearch=false;dialog.close();showNotice("Sharing permissions reset.");});dialogLink("All MalGuard AI tools","/ai/classic.html");},
 help(){openDialog("Help & Support").append(make("p","Describe the website you want. After generation, open the preview and accept it within 20 minutes to download the source code."));dialogLink("MalGuard AI Help Center","/ai/help/");},
 search(){openDialog("Search chats");const input=make("input");input.type="search";input.placeholder="Find a conversation";input.setAttribute("aria-label","Search chats");const list=make("div");dialogBody.append(input,list);const filter=()=>{list.replaceChildren();const matches=chats.filter(c=>c.title.toLowerCase().includes(input.value.toLowerCase()));matches.forEach(c=>list.append(recentButton(c.title,()=>{dialog.close();active=c;render();})));if(!matches.length)list.append(make("p","No matching conversations."));};input.oninput=filter;filter();input.focus();},
 activity(){openDialog("Activity");let count=0;for(const c of chats)for(const m of c.messages)if(m.project){count++;dialogButton(c.title,()=>{active=c;dialog.close();render();});}if(!count)dialogBody.append(make("p","Your generated previews will appear here."));},
 model(){openDialog("MalGuard Ultra 1.5").append(make("p","MalGuard’s coding agent uses GPT-OSS 120B for site generation."));},
 web(){web=!web;syncWeb();},
 tools(){openDialog("Tools");dialogButton("Build a website",()=>usePrompt("Build a website for ",true));dialogButton("Analyze a CSV",()=>{dialog.close();pickFile("csv");});dialogLink("All tools","/ai/classic.html");},
 attach(){pickFile("any");}
};
function syncWeb(){const b=$('[data-action="web"]');b.setAttribute("aria-pressed",String(web));b.querySelector(".toggle").classList.toggle("on",web);}
syncWeb();document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>actions[b.dataset.action]());$(".backdrop").onclick=actions.sidebar;
function consent() {
  if (allowModel && (!web || allowSearch)) return Promise.resolve(true);
  const message = "Share this message with MalGuard’s model provider." +
    (web ? " The model can also send a public query to the search provider when needed." : "");
  openDialog("Send this request?").append(make("p", message));
  return new Promise(resolve => {
    let confirmed = false;
    dialog.addEventListener("close", () => resolve(confirmed), {once:true});
    dialogButton("Allow and send", () => {
      confirmed = true;
      allowModel = true;
      if (web) allowSearch = true;
      dialog.close();
    });
    dialogButton("Cancel", () => dialog.close());
  });
}

const wantsSite = text => /(?:\b(?:build|create|design|generate|make|develop|clone)\b[^.!?]{0,105}\b(?:website|web\s?page|landing\s?page|web\s?site|web\s?app|microsite|portfolio site)\b)|(?:(?:سایت|وبگاه|صفحه[‌ ](?:وب|فرود)).{0,70}(?:بساز|طراحی کن))|(?:(?:بساز|طراحی کن).{0,70}(?:سایت|وبگاه))/iu.test(text);

function projectBrief() {
  const pane = openDialog("Plan your website");
  const form = make("form", null, "brief-form");
  pane.append(form);
  function field(label, options, placeholder) {
    const wrapper = make("label", label);
    const input = make(options ? "select" : "input");
    if (options) {
      for (const option of options) input.append(make("option", option));
    } else {
      input.placeholder = placeholder;
      input.maxLength = 230;
    }
    wrapper.append(input);
    form.append(wrapper);
    return input;
  }
  const audience = field("Who is it for?", null, "e.g. prospective clients");
  const theme = field("Visual style", ["Choose for me", "MalGuard · Dark violet", "Minimal", "Editorial", "Bold and colorful", "Describe below"]);
  const language = field("Site language", ["English", "Persian", "Other (describe below)"]);
  const features = field("Sections, features or theme details", null, "e.g. gallery, filters and a contact section");
  const submit = make("button", "Build website", "dialog-action");
  submit.type = "submit";
  form.append(submit);
  return new Promise(resolve => {
    let brief = null;
    form.onsubmit = event => {
      event.preventDefault();
      brief = JSON.stringify({
        audience:audience.value.trim(), theme:theme.value,
        language:language.value, features:features.value.trim()
      });
      dialog.close();
    };
    dialog.addEventListener("close", () => resolve(brief), {once:true});
  });
}

function codeBlock(source, language) {
  const block = make("details", null, "code-block");
  const title = language ? "View " + language + " code" : "View code";
  const pre = make("pre");
  pre.tabIndex = 0;
  pre.append(make("code", source));
  block.append(make("summary", title), pre);
  return block;
}

function appendMessage(container, text) {
  const code = /`{3}([\w+.#-]*)[ \t]*\r?\n([\s\S]*?)`{3}/g;
  let cursor = 0;
  for (const match of text.matchAll(code)) {
    container.append(document.createTextNode(text.slice(cursor, match.index)));
    container.append(codeBlock(match[2].trimEnd(), match[1]));
    cursor = match.index + match[0].length;
  }
  container.append(document.createTextNode(text.slice(cursor)));
}

const activityLabels = {
  connecting:"Connecting", thinking:"Thinking", searching:"Searching",
  analyzing:"Analyzing", typing:"Typing", complete:"Activity"
};

function activityPanel(steps, stage = "complete") {
  const panel = make("details", null, "message-activity");
  panel.dataset.stage = stage;
  const trigger = make("summary");
  const emblem = make("span", null, "activity-emblem");
  emblem.setAttribute("aria-hidden", "true");
  emblem.append(make("span"));
  const label = make("span", activityLabels[stage], "activity-label");
  label.setAttribute("role", "status");
  const dots = make("span", null, "activity-dots");
  dots.setAttribute("aria-hidden", "true");
  dots.append(make("i"), make("i"), make("i"));
  const chevron = icon("chevron");
  chevron.classList.add("activity-chevron");
  trigger.append(emblem, label, dots, chevron);

  const list = make("ol", null, "activity-log");
  steps.forEach(step => list.append(make("li", step)));
  panel.append(trigger, list);
  return panel;
}

function beginActivity(chat) {
  const userMessage = chat.messages.at(-1);
  const steps = [];
  const panel = activityPanel(steps, "connecting");
  const draft = make("div", null, "message assistant streaming-message");
  draft.hidden = true;
  draft.dir = "auto";
  pendingActivity = {chat, panel, draft};
  render();
  panel.scrollIntoView({block:"nearest"});
  const label = panel.querySelector(".activity-label");
  const log = panel.querySelector(".activity-log");
  const update = (stage, detail) => {
    if (panel.dataset.stage !== stage) {
      panel.dataset.stage = stage;
      label.textContent = activityLabels[stage];
    }
    if (detail && !steps.includes(detail)) {
      steps.push(detail);
      log.append(make("li", detail));
    }
  };
  return {
    update({type, stage, detail, text}) {
      if (type === "delta" && typeof text === "string" && text) {
        if (draft.hidden) {
          update("typing", "Receiving the model response.");
          draft.hidden = false;
        }
        draft.append(document.createTextNode(text));
      } else if (Object.hasOwn(activityLabels, stage) && typeof detail === "string") {
        update(stage, detail);
      }
    },
    finish() {
      pendingActivity = null;
      if (steps.length) userMessage.activity = steps;
    }
  };
}

async function readAgentResponse(response, progress) {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
    return {status:response.status, data:await response.json()};
  }
  const stream = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "", result;
  try {
    while (true) {
      const {value, done} = await stream.read();
      if (done) break;
      buffer += value;
      if (buffer.length > 512000) throw Error("Response is too large.");
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "progress" || event.type === "delta") progress(event);
        if (event.type === "result") result = event;
      }
    }
  } finally {
    await stream.cancel().catch(() => {});
    stream.releaseLock();
  }
  if (!result) throw Error("The response was interrupted.");
  return result;
}

function addSources(chat, sources) {
  if (!Array.isArray(sources)) return;
  const links = sources.flatMap(source => {
    try {
      const url = new URL(source.url);
      return url.protocol === "https:" && !url.username && !url.password
        ? [{title:String(source.title || url.hostname), url:url.href}] : [];
    } catch { return []; }
  });
  if (!links.length) return;
  chat.messages.at(-1).sources = links;
  save();
  render();
}

function showSources(line, sources) {
  if (!Array.isArray(sources) || !sources.length) return;
  const list = make("ul", null, "message-sources");
  for (const source of sources) {
    if (!/^https:\/\//i.test(source.url)) continue;
    const item = make("li");
    const link = make("a", source.title);
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    item.append(link);
    list.append(item);
  }
  line.append(list);
}

async function submit(event) {
  event.preventDefault();
  const prompt = promptBox.value.trim();
  if (!prompt || busy) return;
  setBusy(true);
  showNotice();
  let chat, activity;
  const building = forceBuild || wantsSite(prompt);
  try {
    await accountReady;
    const auth = account?.getToken();
    if (!auth) {
      showNotice("Sign in to send your request. Your draft is still in the composer.");
      account?.open();
      return;
    }
    const brief = building ? await projectBrief() : "";
    if (brief === null || !await consent()) return;
    chat = entry();
    const history = chat.messages.slice(-6).map(({role, content}) => ({role,content:content.slice(0,1000)}));
    push(chat, "user", prompt);
    promptBox.value = "";
    activity = beginActivity(chat);
    const response = await fetch(building ? "/api/build" : "/api/chat", {
      method: "POST",
      headers: {"Content-Type":"application/json", Accept:"application/x-ndjson", Authorization:"Bearer " + auth},
      body: JSON.stringify({prompt, brief, history, webSearch:web, consent:{modelShare:true,remoteLookup:web}})
    });
    const {status, data} = await readAgentResponse(response, activity.update);
    activity.finish();
    if (status >= 400) throw Error(data.message || data.error || "Request failed.");
    if (building) {
      const url = new URL(data.url);
      const localPreview = ["localhost","127.0.0.1"].includes(location.hostname)
        && url.origin === location.origin && url.pathname.startsWith("/preview/");
      if ((url.protocol !== "https:" && !localPreview) || url.username || url.password
          || !data.id || !data.token || !Number.isFinite(Number(data.expiresAt))) throw Error("Invalid preview response.");
      push(chat, "assistant", "Your website is ready to preview.", {
        id:data.id, token:data.token, url:url.href, expiresAt:Number(data.expiresAt), code:data.code
      });
    } else {
      if (typeof data.text !== "string" || !data.text.trim()) throw Error("Empty model response.");
      push(chat, "assistant", data.text);
    }
    addSources(chat, data.sources);
    forceBuild = false;
  } catch (error) {
    activity?.finish();
    if (chat) push(chat, "assistant", "Request failed. " + error.message);
    else showNotice(error.message);
    if (chat === active && !promptBox.value) promptBox.value = prompt;
  } finally {
    setBusy(false);
  }
}
$("#composer").onsubmit=submit;promptBox.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();$("#composer").requestSubmit();}};render();

if (new URLSearchParams(location.search).get("signup") === "1") {
  accountReady.then(() => {
    if (!account) showNotice("Account service unavailable.");
    else if (!account.getToken()) account.open(true);
    else showNotice("You are already signed in.");
  });
}
