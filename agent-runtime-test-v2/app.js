
const $ = id => document.getElementById(id);

const THINKING = {
  off: { steps: 1, effort: "none", tools: false },
  instant: { steps: 2, effort: "minimal", tools: true },
  standard: { steps: 6, effort: "medium", tools: true },
  high: { steps: 10, effort: "high", tools: true },
  deep: { steps: 18, effort: "xhigh", tools: true },
  auto: { steps: 8, effort: "medium", tools: true }
};

const SYSTEM = [
  "You are MalGuard Agent, a helpful general-purpose AI assistant and project builder.",
  "Answer in the user's language.",
  "When the user asks you to BUILD, CREATE, MAKE or CODE an app, site, game, tool or project, do not merely print code.",
  "Use project.write_files to create actual files.",
  "Use project.run_web to execute web projects in an isolated no-network sandbox.",
  "If run_web reports errors, fix the files and run it again.",
  "Use project.export_zip when the project is ready so the user receives a real downloadable ZIP.",
  "When web search is enabled and fresh facts are needed, use web search.",
  "For cybersecurity, stay defensive. Do not build malware, credential theft, persistence, evasion, or offensive tooling.",
  "Never claim a tool ran unless you actually called it."
].join(" ");

let workspace = new Map();
let history = [];
let artifacts = [];
let activeController = null;
let modelCache = { heavy: null, fast: null };
let localGenerator = null;
let localLoading = false;

const TOOL_DEFS = [
  { type: "function", function: { name: "project.write_files", description: "Create or replace multiple project text/code files.", parameters: { type: "object", required: ["files"], properties: { files: { type: "array", items: { type: "object", required: ["path", "content"], properties: { path: { type: "string" }, content: { type: "string" } } } } } } } },
  { type: "function", function: { name: "project.read_file", description: "Read one project file.", parameters: { type: "object", required: ["path"], properties: { path: { type: "string" } } } } },
  { type: "function", function: { name: "project.list_files", description: "List project files.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "project.run_web", description: "Execute the current HTML/CSS/JavaScript project in an isolated no-network browser sandbox and return runtime logs/errors.", parameters: { type: "object", properties: { htmlPath: { type: "string" }, cssPath: { type: "string" }, jsPath: { type: "string" } } } } },
  { type: "function", function: { name: "project.export_zip", description: "Package the current project into a real downloadable ZIP file.", parameters: { type: "object", properties: { filename: { type: "string" } } } } }
];

function bubble(text, type) {
  const d = document.createElement("div");
  d.className = "msg " + type;
  d.textContent = text;
  $("chat").appendChild(d);
  $("chat").scrollTop = $("chat").scrollHeight;
  return d;
}

function setProgress(text) {
  $("progress").textContent = text || "";
  $("progress").classList.toggle("hidden", !text);
}

function setStatus(text, state) {
  $("status").textContent = text;
  $("status").className = "pill " + (state || "");
}

function safePath(path) {
  if (!path || path.startsWith("/") || path.includes("..")) throw new Error("Invalid project path");
  return path;
}

function renderFiles() {
  $("files").innerHTML = "";
  Array.from(workspace.keys()).sort().forEach(name => {
    const d = document.createElement("div");
    d.className = "file";
    d.textContent = "📄 " + name;
    $("files").appendChild(d);
  });
}

function renderArtifacts() {
  $("artifacts").innerHTML = "";
  artifacts.forEach(a => {
    const d = document.createElement("div");
    d.className = "artifact";
    const label = document.createElement("b");
    label.textContent = "📦 " + a.filename;
    const br = document.createElement("br");
    const size = document.createTextNode(Math.ceil(a.blob.size / 1024) + " KB");
    const btn = document.createElement("button");
    btn.textContent = "Download";
    btn.onclick = () => {
      const url = URL.createObjectURL(a.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    };
    d.append(label, br, size, btn);
    $("artifacts").appendChild(d);
  });
}

function buildWebDocument(opts) {
  opts = opts || {};
  const htmlPath = opts.htmlPath || "index.html";
  const cssPath = opts.cssPath || "style.css";
  const jsPath = opts.jsPath || "app.js";
  let html = workspace.get(htmlPath) || "<!doctype html><html><head></head><body><h1>Missing index.html</h1></body></html>";
  const css = workspace.get(cssPath) || "";
  const js = workspace.get(jsPath) || "";
  const csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; connect-src 'none'; img-src data: blob:; media-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';\">";
  const styleTag = "<style>" + css + "</style>";
  const scriptTag = "<script>" + js + "</" + "script>";
  if (html.toLowerCase().includes("</head>")) html = html.replace(/<\/head>/i, csp + styleTag + "</head>");
  else html = csp + styleTag + html;
  if (html.toLowerCase().includes("</body>")) html = html.replace(/<\/body>/i, scriptTag + "</body>");
  else html += scriptTag;
  return html;
}

async function runSandbox(opts, signal) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.style.display = "none";
    const runId = "mg-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    const logs = [];
    const errors = [];
    let done = false;

    let html = buildWebDocument(opts);
    const bridgeCode = [
      "(function(){",
      "const ID=" + JSON.stringify(runId) + ";",
      "const send=(type,payload)=>parent.postMessage(Object.assign({__mg:ID,type:type},payload||{}),'*');",
      "['log','warn','error','info'].forEach(function(level){const old=console[level];console[level]=function(){const args=Array.from(arguments).map(function(x){try{return typeof x==='string'?x:JSON.stringify(x)}catch(e){return String(x)}});send('console',{level:level,args:args});if(old)old.apply(console,arguments)}});",
      "addEventListener('error',function(e){send('error',{message:String(e.message||'Runtime error')})});",
      "addEventListener('unhandledrejection',function(e){send('error',{message:String(e.reason||'Promise rejection')})});",
      "setTimeout(function(){send('done',{})},350);",
      "})();"
    ].join("");
    const bridgeTag = "<script>" + bridgeCode + "</" + "script>";
    html = html.replace(/<body([^>]*)>/i, "<body$1>" + bridgeTag);

    const cleanup = () => {
      removeEventListener("message", onMessage);
      signal.removeEventListener("abort", onAbort);
      frame.remove();
    };
    const finish = result => {
      if (done) return;
      done = true;
      cleanup();
      resolve(result);
    };
    const onAbort = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const onMessage = event => {
      if (event.source !== frame.contentWindow || !event.data || event.data.__mg !== runId) return;
      if (event.data.type === "console") logs.push({ level: event.data.level, args: event.data.args });
      if (event.data.type === "error") errors.push(event.data.message);
      if (event.data.type === "done") finish({ ok: errors.length === 0, logs: logs, errors: errors });
    };

    addEventListener("message", onMessage);
    signal.addEventListener("abort", onAbort, { once: true });
    frame.srcdoc = html;
    document.body.appendChild(frame);
    setTimeout(() => finish({ ok: errors.length === 0, logs: logs, errors: errors, warning: "sandbox timeout" }), 4500);
  });
}

async function toolExecute(call, signal) {
  const name = call.name;
  const args = call.arguments || {};
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");

  if (name === "project.write_files") {
    setProgress("Creating project files");
    if (!Array.isArray(args.files) || !args.files.length) throw new Error("No files supplied");
    args.files.forEach(f => workspace.set(safePath(f.path), String(f.content == null ? "" : f.content)));
    renderFiles();
    return { written: args.files.map(f => f.path), files: Array.from(workspace.keys()) };
  }

  if (name === "project.read_file") {
    setProgress("Reading project file");
    const path = safePath(args.path);
    if (!workspace.has(path)) throw new Error("File not found: " + path);
    return { path: path, content: workspace.get(path) };
  }

  if (name === "project.list_files") {
    setProgress("Checking project files");
    return { files: Array.from(workspace.keys()).sort() };
  }

  if (name === "project.run_web") {
    setProgress("Running project in sandbox");
    return await runSandbox(args, signal);
  }

  if (name === "project.export_zip") {
    setProgress("Packaging project");
    const data = {};
    workspace.forEach((content, path) => { data[path] = fflate.strToU8(content); });
    const bytes = fflate.zipSync(data, { level: 6 });
    const filename = String(args.filename || "malguard-project.zip").replace(/[^a-zA-Z0-9._-]/g, "-");
    const blob = new Blob([bytes], { type: "application/zip" });
    artifacts.push({ filename: filename, blob: blob });
    renderArtifacts();
    return { artifact: { filename: filename, bytes: blob.size }, files: Array.from(workspace.keys()) };
  }

  throw new Error("Unknown tool: " + name);
}

async function connectAI() {
  if (!window.puter) throw new Error("Puter.js failed to load");
  if (puter.auth.isSignedIn()) return true;
  await puter.auth.signIn({ attempt_temp_user_creation: true });
  return puter.auth.isSignedIn();
}

async function resolveModel(tier) {
  if (modelCache[tier]) return modelCache[tier];
  let models = [];
  try { models = await puter.ai.listModels(); } catch (e) {}
  const ids = new Set(models.map(m => m.id));
  const candidates = tier === "heavy"
    ? ["gpt-5.6-luna", "openai/gpt-5.6-luna", "gpt-5.4", "openai/gpt-5.4", "gpt-5.2"]
    : ["gpt-5-nano", "openai/gpt-5-nano", "gpt-5-mini", "openai/gpt-5-mini"];
  modelCache[tier] = candidates.find(x => ids.has(x)) || candidates[0];
  return modelCache[tier];
}

function chooseTier(thinking, engine) {
  if (engine !== "auto") return engine;
  return (thinking === "off" || thinking === "instant") ? "fast" : "heavy";
}

function toPuterMessages(messages) {
  return messages.map(m => {
    if (m.role === "assistant" && m.toolCalls) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map(c => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.arguments || {}) }
        }))
      };
    }
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.toolCallId, name: m.name, content: m.content };
    }
    return { role: m.role, content: m.content };
  });
}

function raceAbort(promise, signal) {
  if (signal.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(promise).then(
      value => { signal.removeEventListener("abort", onAbort); resolve(value); },
      error => { signal.removeEventListener("abort", onAbort); reject(error); }
    );
  });
}

async function callPuter(messages, options) {
  const model = await resolveModel(options.tier);
  const tools = [];
  if (options.searchEnabled && options.tier === "heavy") tools.push({ type: "web_search" });
  if (options.toolsEnabled) tools.push.apply(tools, TOOL_DEFS);

  const requestOptions = {
    model: model,
    normalize: true,
    stream: true,
    reasoning_effort: THINKING[options.thinking].effort
  };
  if (tools.length) requestOptions.tools = tools;

  const stream = await raceAbort(puter.ai.chat(toPuterMessages(messages), requestOptions), options.signal);
  let text = "";
  const toolCalls = [];

  for await (const part of stream) {
    if (options.signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (part && part.type === "error") throw new Error(part.message || "AI stream error");
    if (part && part.type === "text" && part.text) {
      text += part.text;
      options.onToken(part.text);
    }
    if (part && part.type === "tool_use") {
      toolCalls.push({ id: part.id, name: part.name, arguments: part.input || {} });
    }
  }
  return { text: text, toolCalls: toolCalls, model: model, tier: options.tier };
}

async function ensureLocal() {
  if (localGenerator) return localGenerator;
  if (localLoading) throw new Error("Local model is already loading");
  localLoading = true;
  setProgress("Downloading Local model");
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm");
    const opts = {
      dtype: "q4",
      progress_callback: p => {
        if (p && p.progress != null) setProgress("Downloading Local model " + Math.round(p.progress) + "%");
      }
    };
    if (navigator.gpu) opts.device = "webgpu";
    localGenerator = await mod.pipeline("text-generation", "onnx-community/Qwen2.5-0.5B-Instruct", opts);
    setProgress("Local ready");
    setTimeout(() => setProgress(""), 1000);
    return localGenerator;
  } finally {
    localLoading = false;
  }
}

async function callLocal(messages, signal) {
  const gen = await ensureLocal();
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const out = await gen(messages, { max_new_tokens: 320, do_sample: false });
  const generated = out && out[0] ? out[0].generated_text : "";
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1];
    return (last && last.content) || "";
  }
  return typeof generated === "string" ? generated : "";
}

async function runAgent(userText) {
  if (activeController) {
    activeController.abort();
    return;
  }

  const thinking = $("thinking").value;
  const engine = $("engine").value;
  const conf = THINKING[thinking];
  const searchEnabled = $("search").checked;

  if (engine !== "local" && (!window.puter || !puter.auth.isSignedIn())) {
    bubble("اول Connect AI را بزن.", "system");
    return;
  }

  activeController = new AbortController();
  const signal = activeController.signal;
  $("send").textContent = "■";
  $("send").classList.add("stop");
  $("prompt").value = "";

  bubble(userText, "user");
  history.push({ role: "user", content: userText });

  const assistant = bubble("", "assistant");
  let finalText = "";
  let transcript = [{ role: "system", content: SYSTEM }].concat(history.slice(-18));

  try {
    for (let step = 0; step < conf.steps; step++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const tier = chooseTier(thinking, engine);

      if (tier === "local") {
        setProgress("Running Local model");
        const text = await callLocal(transcript, signal);
        assistant.textContent += text;
        finalText += text;
        break;
      }

      setProgress(searchEnabled && tier === "heavy" ? "Thinking · Web search enabled" : "Thinking");

      let response;
      try {
        response = await callPuter(transcript, {
          tier: tier,
          thinking: thinking,
          toolsEnabled: conf.tools,
          searchEnabled: searchEnabled,
          signal: signal,
          onToken: token => {
            assistant.textContent += token;
            finalText += token;
            $("chat").scrollTop = $("chat").scrollHeight;
          }
        });
      } catch (error) {
        if (tier === "heavy" && engine === "auto") {
          setProgress("Heavy failed · Trying Fast");
          response = await callPuter(transcript, {
            tier: "fast",
            thinking: thinking,
            toolsEnabled: conf.tools,
            searchEnabled: false,
            signal: signal,
            onToken: token => {
              assistant.textContent += token;
              finalText += token;
            }
          });
        } else {
          throw error;
        }
      }

      if (!response.toolCalls.length || !conf.tools) break;

      transcript.push({ role: "assistant", content: response.text || "", toolCalls: response.toolCalls });

      for (const call of response.toolCalls) {
        const result = await toolExecute(call, signal);
        transcript.push({
          role: "tool",
          name: call.name,
          toolCallId: call.id,
          content: JSON.stringify(result)
        });
      }
    }

    history.push({ role: "assistant", content: finalText || "Done" });
    setProgress("Done");
    setTimeout(() => setProgress(""), 900);
    setStatus("Ready", "ok");
  } catch (error) {
    if (error && error.name === "AbortError") {
      setProgress("Stopped");
      bubble("متوقف شد.", "system");
      setStatus("Stopped", "");
    } else {
      setProgress("");
      bubble("خطا: " + ((error && error.message) || error), "system");
      setStatus("Error", "bad");
    }
  } finally {
    activeController = null;
    $("send").textContent = "➤";
    $("send").classList.remove("stop");
  }
}

$("connect").onclick = async () => {
  $("connect").disabled = true;
  setStatus("Connecting", "");
  try {
    const ok = await connectAI();
    if (ok) {
      $("connectBox").classList.add("hidden");
      setStatus("Connected", "ok");
      bubble("AI متصل شد. حالا Build Calculator را تست کن.", "system");
    }
  } catch (error) {
    setStatus("Not connected", "bad");
    bubble("اتصال انجام نشد: " + ((error && error.message) || error), "system");
  } finally {
    $("connect").disabled = false;
  }
};

$("send").onclick = () => {
  if (activeController) {
    activeController.abort();
    return;
  }
  const text = $("prompt").value.trim();
  if (text) runAgent(text);
};

$("prompt").onkeydown = event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("send").click();
  }
};

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.onclick = () => {
    $("prompt").value = button.dataset.prompt;
    $("send").click();
  };
});

$("uploadBtn").onclick = () => $("fileInput").click();

$("fileInput").onchange = async event => {
  for (const file of Array.from(event.target.files)) {
    try {
      workspace.set(safePath(file.name), await file.text());
    } catch (error) {}
  }
  renderFiles();
};

$("mic").onclick = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    bubble("Voice dictation در این مرورگر موجود نیست.", "system");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "fa-IR";
  recognition.onresult = event => {
    $("prompt").value += ($("prompt").value ? " " : "") + event.results[0][0].transcript;
  };
  recognition.start();
};

$("localInstall").onclick = async () => {
  try {
    await ensureLocal();
    $("engine").value = "local";
    bubble("Local آماده شد. Local فقط چت متنی است و ابزار Project/Search ندارد.", "system");
  } catch (error) {
    bubble("Local load error: " + ((error && error.message) || error), "system");
  }
};

$("preview").onclick = () => {
  if (!workspace.has("index.html")) {
    bubble("هنوز index.html ساخته نشده.", "system");
    return;
  }
  $("previewFrame").srcdoc = buildWebDocument({});
  $("previewModal").classList.remove("hidden");
};

$("closePreview").onclick = () => $("previewModal").classList.add("hidden");

if (window.puter && puter.auth && puter.auth.isSignedIn && puter.auth.isSignedIn()) {
  $("connectBox").classList.add("hidden");
  setStatus("Connected", "ok");
}

bubble("نسخه تست موتور آماده است. Connect AI را بزن و Build Calculator را امتحان کن.", "system");
