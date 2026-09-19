
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
  "When the user asks you to build an app or site, use project tools and return real files.",
  "Use project.run_web to test web projects and fix errors before export.",
  "Use project.export_zip when a project is ready.",
  "When Deep Research or web search is enabled and fresh facts are needed, use web search.",
  "For cybersecurity, stay defensive and safe.",
  "Never claim a tool ran unless it actually ran."
].join(" ");

let workspace = new Map();
let history = [];
let artifacts = [];
let attachments = [];
let activeController = null;
let activeMode = "general";
let modelCache = { heavy: null, fast: null, gemini: null };
let localGenerator = null;
let localLoading = false;

let dictationRecorder = null;
let dictationStream = null;
let dictationChunks = [];

let voiceStream = null;
let voiceRecorder = null;
let voiceChunks = [];
let voiceAudio = null;
let voiceRunning = false;
let voiceMuted = false;
let voiceHistory = [];
let voiceAudioContext = null;
let voiceAnalyser = null;
let voiceVadFrame = 0;
let voiceSpeechDetected = false;
let voiceLastSpeechAt = 0;
let voiceNoiseFloor = 0.008;
let voiceTurnStartedAt = 0;
let dictationAudioContext = null;
let dictationAnalyser = null;
let dictationVadFrame = 0;
let dictationSpeechDetected = false;
let dictationLastSpeechAt = 0;
let dictationTurnStartedAt = 0;

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

function renderAttachments() {
  $("attachmentBar").innerHTML = "";
  attachments.forEach((a, index) => {
    const d = document.createElement("div");
    d.className = "attachment";
    d.textContent = (a.kind === "image" ? "🖼️ " : a.kind === "video" ? "🎥 " : a.kind === "pdf" ? "📕 " : "📎 ") + a.name;
    const x = document.createElement("button");
    x.textContent = "×";
    x.onclick = () => { attachments.splice(index, 1); renderAttachments(); };
    d.appendChild(x);
    $("attachmentBar").appendChild(d);
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
    const finish = result => { if (done) return; done = true; cleanup(); resolve(result); };
    const onAbort = () => { if (done) return; done = true; cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
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
  const candidates = tier === "gemini"\n    ? ["google/gemini-3.8-flash", "gemini-3.8-flash"]\n    : tier === "heavy"
    ? ["gpt-5.6-luna", "openai/gpt-5.6-luna", "gpt-5.4", "openai/gpt-5.4", "google/gemini-3.8-flash"]
    : ["gpt-5-nano", "openai/gpt-5-nano", "gpt-5-mini", "openai/gpt-5-mini", "google/gemini-3.8-flash"];
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
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, name: m.name, content: m.content };
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
  const requestOptions = { model: model, normalize: true, stream: true, reasoning_effort: THINKING[options.thinking].effort };
  if (tools.length) requestOptions.tools = tools;
  const stream = await raceAbort(puter.ai.chat(toPuterMessages(messages), requestOptions), options.signal);
  let text = "";
  const toolCalls = [];
  for await (const part of stream) {
    if (options.signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (part && part.type === "error") throw new Error(part.message || "AI stream error");
    if (part && part.type === "text" && part.text) { text += part.text; options.onToken(part.text); }
    if (part && part.type === "tool_use") toolCalls.push({ id: part.id, name: part.name, arguments: part.input || {} });
  }
  return { text: text, toolCalls: toolCalls, model: model, tier: options.tier };
}

function normalizeAIResponse(response) {
  if (typeof response === "string") return response;
  if (!response) return "";
  if (typeof response.text === "string") return response.text;
  if (typeof response.message === "string") return response.message;
  if (response.message && typeof response.message.content === "string") return response.message.content;
  if (typeof response.content === "string") return response.content;
  return "";
}

async function ensureLocal() {
  if (localGenerator) return localGenerator;
  if (localLoading) throw new Error("Local model is already loading");
  localLoading = true;
  setProgress("Downloading Local model");
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm");
    const opts = { dtype: "q4", progress_callback: p => { if (p && p.progress != null) setProgress("Downloading Local model " + Math.round(p.progress) + "%"); } };
    if (navigator.gpu) opts.device = "webgpu";
    localGenerator = await mod.pipeline("text-generation", "onnx-community/Qwen2.5-0.5B-Instruct", opts);
    setProgress("Local ready");
    setTimeout(() => setProgress(""), 1000);
    return localGenerator;
  } finally { localLoading = false; }
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

async function uploadMediaAttachment(file, kind) {
  if (!window.puter || !puter.auth.isSignedIn()) {
    bubble("برای ارسال عکس/ویدئو/PDF اول Connect AI را بزن.", "system");
    return;
  }
  setProgress("Uploading " + file.name);
  const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
  const path = "malguard-uploads/" + crypto.randomUUID() + ext;
  await puter.fs.write(path, file, { createMissingParents: true });
  const url = await puter.fs.getReadURL(path, 60 * 60 * 1000);
  attachments.push({ name: file.name, kind: kind, mime: file.type, url: url, path: path });
  renderAttachments();
  setProgress("");
}

async function handleLocalTextFile(file) {
  const textTypes = /text|json|javascript|typescript|xml|yaml|csv|markdown/i;
  if (textTypes.test(file.type) || /.(txt|md|json|csv|js|ts|html|css|py|java|kt|xml|yaml|yml)$/i.test(file.name)) {
    const text = await file.text();
    workspace.set(safePath(file.name), text);
    attachments.push({ name: file.name, kind: "text", text: text.slice(0, 60000) });
    renderFiles();
    renderAttachments();
    return true;
  }
  return false;
}

async function attachFiles(fileList, mode) {
  for (const file of Array.from(fileList || [])) {
    if (await handleLocalTextFile(file)) continue;
    if (mode === "photo" || mode === "camera" || file.type.startsWith("image/")) await uploadMediaAttachment(file, "image");
    else if (mode === "video" || file.type.startsWith("video/")) await uploadMediaAttachment(file, "video");
    else if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) await uploadMediaAttachment(file, "pdf");
    else attachments.push({ name: file.name, kind: "file", file: file });
  }
  renderAttachments();
}

async function runMultimodal(userText, media) {
  const urls = media.map(a => a.url);
  const model = media.some(a => a.kind === "video" || a.kind === "pdf") ? "google/gemini-3.8-flash" : await resolveModel("heavy");
  setProgress("Analyzing attachments");
  const input = urls.length === 1 ? urls[0] : urls;
  const response = await puter.ai.chat(userText || "این فایل را تحلیل کن.", input, { model: model });
  return normalizeAIResponse(response);
}

function buildTextAttachmentContext() {
  const texts = attachments.filter(a => a.kind === "text");
  if (!texts.length) return "";
  return "\n\nAttached text files:\n" + texts.map(a => "--- " + a.name + " ---\n" + a.text).join("\n\n");
}

async function runAgent(userText) {
  if (activeController) { activeController.abort(); return; }
  const thinking = $("thinking").value;
  const engine = $("engine").value;
  const conf = THINKING[thinking];
  const searchEnabled = $("search").checked;
  if (engine !== "local" && (!window.puter || !puter.auth.isSignedIn())) { bubble("اول Connect AI را بزن.", "system"); return; }

  activeController = new AbortController();
  const signal = activeController.signal;
  $("send").textContent = "■";
  $("send").classList.add("stop");
  $("prompt").value = "";

  const shown = userText + (attachments.length ? "\n📎 " + attachments.map(a => a.name).join(", ") : "");
  bubble(shown, "user");
  history.push({ role: "user", content: userText + buildTextAttachmentContext() });

  const assistant = bubble("", "assistant");
  let finalText = "";
  const modeSystem = activeMode === "malware"
    ? SYSTEM + " You are in Malware AI mode. Act as a defensive cybersecurity and malware-analysis assistant. Help interpret MalGuard scanner evidence, suspicious links/apps/mods, infection symptoms, screenshots and code. Never pretend to scan or execute something without scanner evidence. When scanner evidence is provided, summarize it as a clear security card with File, Risk, Reasons and Result."
    : SYSTEM + " You are in General Chat mode. Help with general questions, learning, writing, coding, reasoning and projects.";
  let transcript = [{ role: "system", content: modeSystem }].concat(history.slice(-18));

  try {
    const media = attachments.filter(a => a.url);
    if (media.length) {
      const answer = await runMultimodal(userText + buildTextAttachmentContext(), media);
      assistant.textContent = answer;
      finalText = answer;
    } else {
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
            onToken: token => { assistant.textContent += token; finalText += token; $("chat").scrollTop = $("chat").scrollHeight; }
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
              onToken: token => { assistant.textContent += token; finalText += token; }
            });
          } else throw error;
        }

        if (!response.toolCalls.length || !conf.tools) break;
        transcript.push({ role: "assistant", content: response.text || "", toolCalls: response.toolCalls });
        for (const call of response.toolCalls) {
          const result = await toolExecute(call, signal);
          transcript.push({ role: "tool", name: call.name, toolCallId: call.id, content: JSON.stringify(result) });
        }
      }
    }

    history.push({ role: "assistant", content: finalText || "Done" });
    attachments = [];
    renderAttachments();
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

function pickMime() {
  if (!window.MediaRecorder) return "";
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

async function getMicStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Microphone API is unavailable in this browser.");
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
}

async function transcribeBlob(blob, purpose) {
  const prompt = purpose === "dictation"
    ? "دیکته فارسی دقیق برای نوشتن پیام. علائم نگارشی طبیعی، نام‌های فناوری مثل MalGuard، ChatGPT، GitHub، Vercel و کلمات انگلیسی را درست نگه دار."
    : "مکالمه طبیعی فارسی با MalGuard AI. فارسی محاوره‌ای را دقیق تشخیص بده و نام‌های فناوری و انگلیسی را بدون ترجمه اشتباه حفظ کن.";
  try {
    const result = await puter.ai.speech2txt({
      audio: blob,
      provider: "openai",
      model: "gpt-4o-transcribe",
      response_format: "json",
      language: "fa",
      prompt: prompt,
      temperature: 0
    });
    const text = typeof result === "string" ? result : (result && (result.text || result.transcript)) || "";
    if (text.trim()) return text.trim();
  } catch (error) {
    console.warn("Persian STT retry without language hint", error);
  }
  const fallback = await puter.ai.speech2txt({
    audio: blob,
    provider: "openai",
    model: "gpt-4o-transcribe",
    response_format: "json",
    prompt: prompt,
    temperature: 0
  });
  return (typeof fallback === "string" ? fallback : (fallback && (fallback.text || fallback.transcript)) || "").trim();
}

function rmsFromAnalyser(analyser) {
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

function stopDictationVad() {
  cancelAnimationFrame(dictationVadFrame);
  dictationVadFrame = 0;
  if (dictationAudioContext) {
    dictationAudioContext.close().catch(()=>{});
    dictationAudioContext = null;
    dictationAnalyser = null;
  }
}

function startDictationVad(stream) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  dictationAudioContext = new AudioCtx();
  const source = dictationAudioContext.createMediaStreamSource(stream);
  dictationAnalyser = dictationAudioContext.createAnalyser();
  dictationAnalyser.fftSize = 1024;
  source.connect(dictationAnalyser);
  dictationSpeechDetected = false;
  dictationLastSpeechAt = performance.now();
  dictationTurnStartedAt = performance.now();

  const tick = () => {
    if (!dictationRecorder || dictationRecorder.state !== "recording" || !dictationAnalyser) return;
    const now = performance.now();
    const rms = rmsFromAnalyser(dictationAnalyser);
    const threshold = Math.max(0.018, voiceNoiseFloor * 2.5);
    if (rms > threshold) {
      dictationSpeechDetected = true;
      dictationLastSpeechAt = now;
    }
    if (dictationSpeechDetected && now - dictationLastSpeechAt > 1200 && now - dictationTurnStartedAt > 900) {
      dictationRecorder.stop();
      return;
    }
    if (now - dictationTurnStartedAt > 30000) {
      dictationRecorder.stop();
      return;
    }
    dictationVadFrame = requestAnimationFrame(tick);
  };
  tick();
}

async function toggleDictation() {
  if (dictationRecorder && dictationRecorder.state === "recording") {
    dictationRecorder.stop();
    return;
  }

  if (!window.puter || !puter.auth.isSignedIn()) {
    bubble("برای دیکته صوتی اول Connect AI را بزن.", "system");
    return;
  }

  try {
    dictationStream = await getMicStream();
    dictationChunks = [];
    const mimeType = pickMime();
    dictationRecorder = new MediaRecorder(dictationStream, mimeType ? { mimeType: mimeType } : undefined);
    dictationRecorder.ondataavailable = e => { if (e.data && e.data.size) dictationChunks.push(e.data); };
    dictationRecorder.onstop = async () => {
      stopDictationVad();
      $("dictate").classList.remove("recording");
      const blob = new Blob(dictationChunks, { type: dictationRecorder.mimeType || "audio/webm" });
      if (dictationStream) dictationStream.getTracks().forEach(t => t.stop());
      setProgress("Transcribing dictation");
      try {
        if (blob.size > 500) {
          const text = await transcribeBlob(blob, "dictation");
          $("prompt").value += ($("prompt").value ? " " : "") + text;
        }
      } catch (error) {
        bubble("دیکته صوتی خطا داد: " + ((error && error.message) || error), "system");
      } finally {
        setProgress("");
        dictationRecorder = null;
        dictationStream = null;
      }
    };
    dictationRecorder.start(250);
    $("dictate").classList.add("recording");
    startDictationVad(dictationStream);
  } catch (error) {
    bubble("Microphone error: " + ((error && error.message) || error), "system");
  }
}

function setVoiceState(state, hint) {
  $("voiceState").textContent = state;
  $("voiceHint").textContent = hint || "";
  $("voiceOrb").classList.remove("listening","thinking","speaking");
  if (state === "Listening") $("voiceOrb").classList.add("listening");
  if (state === "Thinking" || state === "Transcribing") $("voiceOrb").classList.add("thinking");
  if (state === "Speaking") $("voiceOrb").classList.add("speaking");
}

function stopVoiceVad() {
  cancelAnimationFrame(voiceVadFrame);
  voiceVadFrame = 0;
  if (voiceAudioContext) {
    voiceAudioContext.close().catch(()=>{});
    voiceAudioContext = null;
    voiceAnalyser = null;
  }
}

function startVoiceVad(stream) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  voiceAudioContext = new AudioCtx();
  const source = voiceAudioContext.createMediaStreamSource(stream);
  voiceAnalyser = voiceAudioContext.createAnalyser();
  voiceAnalyser.fftSize = 1024;
  source.connect(voiceAnalyser);
  voiceSpeechDetected = false;
  voiceLastSpeechAt = performance.now();
  voiceTurnStartedAt = performance.now();
  let calibration = [];

  const tick = () => {
    if (!voiceRecorder || voiceRecorder.state !== "recording" || !voiceAnalyser) return;
    const now = performance.now();
    const rms = rmsFromAnalyser(voiceAnalyser);
    const elapsed = now - voiceTurnStartedAt;

    if (elapsed < 500) {
      calibration.push(rms);
      if (calibration.length > 3) {
        const avg = calibration.reduce((a,b)=>a+b,0) / calibration.length;
        voiceNoiseFloor = Math.max(0.004, Math.min(0.03, avg));
      }
    }

    const threshold = Math.max(0.016, voiceNoiseFloor * 2.8);
    if (rms > threshold) {
      voiceSpeechDetected = true;
      voiceLastSpeechAt = now;
      $("voiceHint").textContent = "دارم گوش می‌دم…";
    }

    if (voiceSpeechDetected && now - voiceLastSpeechAt > 1050 && elapsed > 900) {
      voiceRecorder.stop();
      return;
    }

    if (!voiceSpeechDetected && elapsed > 9000) {
      voiceRecorder.stop();
      return;
    }

    if (elapsed > 26000) {
      voiceRecorder.stop();
      return;
    }

    voiceVadFrame = requestAnimationFrame(tick);
  };
  tick();
}

async function startVoiceRecording() {
  if (!voiceRunning || voiceMuted) return;
  if (voiceAudio) {
    try { voiceAudio.pause(); } catch (e) {}
    voiceAudio = null;
  }
  if (!voiceStream) voiceStream = await getMicStream();
  voiceChunks = [];
  const mimeType = pickMime();
  voiceRecorder = new MediaRecorder(voiceStream, mimeType ? { mimeType: mimeType } : undefined);
  voiceRecorder.ondataavailable = e => { if (e.data && e.data.size) voiceChunks.push(e.data); };
  voiceRecorder.onstop = () => {
    stopVoiceVad();
    processVoiceTurn().catch(error => {
      setVoiceState("Error", "دوباره صحبت کن");
      $("voiceTranscript").textContent = String((error && error.message) || error);
      if (voiceRunning && !voiceMuted) setTimeout(()=>startVoiceRecording().catch(()=>{}), 900);
    });
  };
  voiceRecorder.start(250);
  setVoiceState("Listening", "شروع به صحبت کن");
  startVoiceVad(voiceStream);
}

async function stopVoiceRecording() {
  if (voiceRecorder && voiceRecorder.state === "recording") voiceRecorder.stop();
}

async function createVoiceReply(userText) {
  const model = await resolveModel("fast");
  voiceHistory.push({ role: "user", content: userText });
  const messages = [
    { role: "system", content: "You are MalGuard Voice. Speak naturally, briefly and clearly in the user's language. Default to Persian when the user speaks Persian. Keep conversational context. Avoid markdown-heavy spoken responses." },
    ...voiceHistory.slice(-12)
  ];
  const response = await puter.ai.chat(messages, { model: model });
  const answer = normalizeAIResponse(response).trim();
  voiceHistory.push({ role: "assistant", content: answer });
  return answer;
}

async function speakVoiceAnswer(answer) {
  setVoiceState("Speaking", "MalGuard داره صحبت می‌کنه");
  try {
    voiceAudio = await puter.ai.txt2speech(answer.slice(0, 2800), {
      provider: "openai",
      model: "gpt-4o-mini-tts",
      voice: "coral",
      response_format: "mp3",
      instructions: "Speak Persian naturally and warmly. Keep English technical names clear. Medium pace, conversational, not announcer-like."
    });
  } catch (e) {
    voiceAudio = await puter.ai.txt2speech(answer.slice(0, 2800), {
      provider: "xai",
      voice: "ara",
      language: "auto",
      output_format: "mp3"
    });
  }

  if (!voiceRunning || !voiceAudio) return;

  await new Promise(resolve => {
    let finished = false;
    const done = () => { if (finished) return; finished = true; resolve(); };
    if (voiceAudio.addEventListener) {
      voiceAudio.addEventListener("ended", done, { once: true });
      voiceAudio.addEventListener("error", done, { once: true });
    }
    try {
      const p = voiceAudio.play();
      if (p && p.catch) p.catch(done);
    } catch (e) { done(); }
    setTimeout(done, 45000);
  });
  voiceAudio = null;
}

async function processVoiceTurn() {
  if (!voiceRunning) return;
  const mime = (voiceRecorder && voiceRecorder.mimeType) || "audio/webm";
  const blob = new Blob(voiceChunks, { type: mime });

  if (blob.size < 700 || !voiceSpeechDetected) {
    if (voiceRunning && !voiceMuted) await startVoiceRecording();
    return;
  }

  setVoiceState("Transcribing", "دارم حرفت رو می‌فهمم");
  const userText = await transcribeBlob(blob, "voice");
  if (!userText.trim()) {
    setVoiceState("Listening", "دوباره بگو");
    if (voiceRunning && !voiceMuted) await startVoiceRecording();
    return;
  }

  $("voiceTranscript").textContent = "شما: " + userText;
  setVoiceState("Thinking", "دارم جواب می‌دم");
  const answer = await createVoiceReply(userText);
  $("voiceTranscript").textContent = "شما: " + userText + "\n\nMalGuard: " + answer;

  await speakVoiceAnswer(answer);
  if (voiceRunning && !voiceMuted) await startVoiceRecording();
}

async function openVoiceMode() {
  if (!window.puter || !puter.auth.isSignedIn()) {
    try { await connectAI(); }
    catch (error) { bubble("Voice اتصال AI می‌خواهد.", "system"); return; }
  }
  if (!window.MediaRecorder) {
    bubble("Voice Mode در این مرورگر MediaRecorder ندارد.", "system");
    return;
  }
  voiceRunning = true;
  voiceMuted = false;
  voiceHistory = [];
  $("voiceModal").classList.remove("hidden");
  $("voiceTranscript").textContent = "";
  $("voiceMicToggle").textContent = "🎙";
  setVoiceState("Starting", "اجازه میکروفون را بده");
  try {
    await startVoiceRecording();
  } catch (error) {
    setVoiceState("Error", "میکروفون در دسترس نیست");
    $("voiceTranscript").textContent = String((error && error.message) || error);
  }
}

function interruptVoiceAndListen() {
  if (!voiceRunning) return;
  if (voiceAudio) {
    try { voiceAudio.pause(); } catch (e) {}
    voiceAudio = null;
    if (!voiceMuted) startVoiceRecording().catch(()=>{});
    return;
  }
  if (voiceRecorder && voiceRecorder.state === "recording") {
    voiceRecorder.stop();
  } else if (!voiceMuted) {
    startVoiceRecording().catch(()=>{});
  }
}

function closeVoiceMode() {
  voiceRunning = false;
  stopVoiceVad();
  if (voiceRecorder && voiceRecorder.state === "recording") {
    voiceRecorder.onstop = null;
    voiceRecorder.stop();
  }
  if (voiceStream) voiceStream.getTracks().forEach(t => t.stop());
  if (voiceAudio) {
    try { voiceAudio.pause(); } catch (e) {}
  }
  voiceRecorder = null;
  voiceStream = null;
  voiceAudio = null;
  voiceHistory = [];
  $("voiceModal").classList.add("hidden");
}

async function activateDeepResearch() {
  $("thinking").value = "deep";
  $("engine").value = "heavy";
  $("search").checked = true;
  $("toolSheet").classList.add("hidden");
  bubble("🔬 Deep Research فعال شد: Thinking=Deep و Web Search روشن است.", "system");
}

function openPlugins() {
  $("toolSheet").classList.add("hidden");
  $("pluginSheet").classList.remove("hidden");
}

function activateVisualSession() {
  $("toolSheet").classList.add("hidden");
  $("cameraInput").click();
  bubble("Visual Session فعلاً Beta است؛ یک عکس زنده از دوربین می‌گیرد و برای Vision ضمیمه می‌کند.", "system");
}

function setAppMode(mode) {
  activeMode = mode === "malware" ? "malware" : "general";
  $("tabGeneral").classList.toggle("active", activeMode === "general");
  $("tabMalware").classList.toggle("active", activeMode === "malware");
  $("malwareIntro").classList.toggle("hidden", activeMode !== "malware");
  $("prompt").placeholder = activeMode === "malware" ? "لینک، برنامه، مود، علائم یا نتیجه اسکن را بفرست…" : "پیام بده...";
}
$("tabGeneral").onclick = () => setAppMode("general");
$("tabMalware").onclick = () => setAppMode("malware");
setAppMode("general");

$("connect").onclick = async () => {
  $("connect").disabled = true;
  setStatus("Connecting", "");
  try {
    const ok = await connectAI();
    if (ok) {
      $("connectBox").classList.add("hidden");
      setStatus("Connected", "ok");
      bubble("AI متصل شد.", "system");
    }
  } catch (error) {
    setStatus("Not connected", "bad");
    bubble("اتصال انجام نشد: " + ((error && error.message) || error), "system");
  } finally { $("connect").disabled = false; }
};

$("send").onclick = () => {
  if (activeController) { activeController.abort(); return; }
  const text = $("prompt").value.trim();
  if (text || attachments.length) runAgent(text || "این فایل را بررسی کن.");
};

$("prompt").onkeydown = event => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("send").click(); }
};

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.onclick = () => { $("prompt").value = button.dataset.prompt; $("send").click(); };
});
document.querySelectorAll("[data-deep]").forEach(button => { button.onclick = activateDeepResearch; });

$("plus").onclick = () => $("toolSheet").classList.remove("hidden");
$("closeTools").onclick = () => $("toolSheet").classList.add("hidden");
$("closePlugins").onclick = () => $("pluginSheet").classList.add("hidden");

document.querySelectorAll("[data-tool]").forEach(button => {
  button.onclick = () => {
    const tool = button.dataset.tool;
    if (tool === "camera") { $("toolSheet").classList.add("hidden"); $("cameraInput").click(); }
    if (tool === "photo") { $("toolSheet").classList.add("hidden"); $("photoInput").click(); }
    if (tool === "document") { $("toolSheet").classList.add("hidden"); $("docInput").click(); }
    if (tool === "file") { $("toolSheet").classList.add("hidden"); $("fileInput").click(); }
    if (tool === "video") { $("toolSheet").classList.add("hidden"); $("videoInput").click(); }
    if (tool === "deep") activateDeepResearch();
    if (tool === "plugins") openPlugins();
    if (tool === "visual") activateVisualSession();
  };
});

$("cameraInput").onchange = e => attachFiles(e.target.files, "camera");
$("photoInput").onchange = e => attachFiles(e.target.files, "photo");
$("videoInput").onchange = e => attachFiles(e.target.files, "video");
$("docInput").onchange = e => attachFiles(e.target.files, "document");
$("fileInput").onchange = e => attachFiles(e.target.files, "file");

$("dictate").onclick = toggleDictation;
$("voiceLive").onclick = openVoiceMode;
$("voiceOrb").onclick = interruptVoiceAndListen;
$("voiceMicToggle").onclick = () => {
  voiceMuted = !voiceMuted;
  $("voiceMicToggle").textContent = voiceMuted ? "🔇" : "🎙";
  if (voiceMuted) {
    stopVoiceVad();
    if (voiceRecorder && voiceRecorder.state === "recording") {
      voiceRecorder.onstop = null;
      voiceRecorder.stop();
    }
  } else if (voiceRunning) {
    startVoiceRecording().catch(() => {});
  }
};
$("voiceEnd").onclick = closeVoiceMode;
$("voicePhoto").onclick = () => $("photoInput").click();
$("closeVoice").onclick = closeVoiceMode;

$("closePreview").onclick = () => $("previewModal").classList.add("hidden");

if (window.puter && puter.auth && puter.auth.isSignedIn && puter.auth.isSignedIn()) {
  $("connectBox").classList.add("hidden");
  setStatus("Connected", "ok");
}

bubble("v4 آماده است: 🎙 دیکته فقط صدا را به متن تبدیل می‌کند؛ Voice مکالمه‌ی زنده و خودکار با MalGuard است.", "system");


function switchMainMode(mode) {
  const malware = mode === "malware";
  $("chatMode").classList.toggle("hidden", malware);
  $("malwareMode").classList.toggle("hidden", !malware);
  document.querySelectorAll(".modeTab").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
}
document.querySelectorAll(".modeTab").forEach(b => b.addEventListener("click", () => switchMainMode(b.dataset.mode)));

function parseScanReport(text) {
  const lower = String(text || "").toLowerCase();
  const explicit = lower.match(/(?:risk\s*score|score|ریسک)\s*[:=]?\s*(\d{1,3})/i);
  let score = explicit ? Math.min(100, Number(explicit[1])) : 0;
  const signals = [
    ["malicious",35],["malware",30],["trojan",35],["ransom",45],["suspicious",24],
    ["unknown signature",18],["signature: unknown",18],["reputation: suspicious",22],
    ["unsigned",15],["phishing",35],["clean",-20],["trusted",-20]
  ];
  if (!explicit) signals.forEach(([k,v]) => { if (lower.includes(k)) score += v; });
  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 75 ? "خطر بالا" : score >= 40 ? "نیازمند بررسی" : "ریسک پایین";
  const reason = score >= 75 ? "گزارش چند نشانه پرخطر دارد. فایل را اجرا نکن و برای بررسی بیشتر از اسکنر معتبر استفاده کن." : score >= 40 ? "گزارش نشانه‌های مشکوک دارد اما برای نتیجه قطعی شواهد بیشتری لازم است." : "در متن گزارش نشانه پرخطر واضحی دیده نشد؛ این به معنی تضمین سالم بودن فایل نیست.";
  return {score, verdict, reason};
}
$("analyzeScan").onclick = () => {
  const report = $("scanReport").value.trim();
  if (!report) return;
  const r = parseScanReport(report);
  $("scanVerdict").textContent = r.verdict;
  $("scanScore").textContent = r.score + "/100";
  $("scanReason").textContent = r.reason;
  $("scanCard").classList.remove("hidden");
};
$("copyScanCard").onclick = async () => {
  const text = $("scanVerdict").textContent + " · " + $("scanScore").textContent + "\n" + $("scanReason").textContent;
  try { await navigator.clipboard.writeText(text); } catch(e) {}
};
$("downloadScanCard").onclick = () => {
  const text = "MalGuard Security Card\n" + $("scanVerdict").textContent + " · " + $("scanScore").textContent + "\n" + $("scanReason").textContent;
  const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href=url; link.download="malguard-security-card.txt"; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};

// Do not make a broken cloud sign-in block the whole test app.
// Local mode remains usable without any account; cloud modes still require a real provider session.
$("engine").addEventListener("change", () => {
  const local = $("engine").value === "local";
  $("connectBox").classList.toggle("hidden", local || (window.puter && puter.auth && puter.auth.isSignedIn && puter.auth.isSignedIn()));
  if (local) setStatus("Local · no account needed", "ok");
});
