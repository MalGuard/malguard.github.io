"use strict";
/**
 * GTA VI Security Center: local URL structure review only.
 * This module makes ZERO network requests, never opens the inspected URL
 * and never calls a remote malware or reputation service. No safe verdicts.
 */
(() => {
  const form = document.getElementById("gta6-url-form");
  const field = document.getElementById("gta6-url-input");
  const output = document.getElementById("gta6-url-result");
  if (!form || !field || !output) return;

  const officialPublisherHost = host =>
    host === "rockstargames.com" || host.endsWith(".rockstargames.com");
  const containsPublisherClaim = host =>
    /rockstar|grandtheftauto|gta.?vi|gta.?6/i.test(host);
  const commonShorteners = new Set([
    "bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rb.gy",
    "shorturl.at", "tiny.cc", "ow.ly"
  ]);

  function display(title, description, host, signals) {
    output.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = title;
    const intro = document.createElement("p");
    intro.textContent = description;
    output.append(heading, intro);
    if (host) {
      const hostLine = document.createElement("p");
      hostLine.className = "gta6-result-host";
      hostLine.textContent = "Parsed hostname: " + host;
      output.append(hostLine);
    }
    if (signals.length) {
      const list = document.createElement("ul");
      for (const signal of signals) {
        const item = document.createElement("li");
        item.textContent = signal;
        list.append(item);
      }
      output.append(list);
    }
    const limit = document.createElement("p");
    limit.textContent = "LIMITATION: This is a URL-format and claim check only. The website, file contents, reputation, permissions, and user accounts have NOT been scanned. No result here certifies a site as safe or malicious.";
    output.append(limit);
    output.hidden = false;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const raw = field.value.trim();
    if (!raw) {
      display("Enter a URL to review", "Paste a complete https:// or http:// address. No connection to the destination will be made.", "", []);
      return;
    }
    if (raw.length > 2048 || /[\r\n\u0000-\u001F]/.test(raw)) {
      display("Cannot evaluate this input", "The input includes invalid characters or exceeds the supported length.", "", []);
      return;
    }
    // Explicit scheme avoids the URL constructor silently treating another
    // spelling as a relative URL. Host identity, not label text, is assessed.
    if (!/^https?:\/\//i.test(raw)) {
      display("Unsupported or incomplete address", "Use an absolute HTTP or HTTPS URL. Other schemes and text-only names are not inspected.", "", []);
      return;
    }
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_) {
      display("Unable to parse URL", "The address is malformed. No reputation or safety conclusion is possible.", "", []);
      return;
    }
    if (!["https:", "http:"].includes(parsed.protocol) || !parsed.hostname || /\s/.test(parsed.hostname)) {
      display("Unsupported URL", "Only conventional HTTP and HTTPS URLs with a readable hostname can be inspected.", "", []);
      return;
    }
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    const signals = [];

    if (parsed.protocol === "http:") {
      signals.push("The address uses HTTP rather than HTTPS. Transport encryption is absent; HTTPS itself would not prove the site's legitimacy.");
    }
    if (parsed.username || parsed.password) {
      signals.push("The URL embeds user information before an @ sign. This can obscure which hostname the browser will contact.");
    }
    if (host.includes("xn--")) {
      signals.push("The hostname contains punycode (xn--). Internationalized names can be legitimate but may need extra identity verification.");
    }
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || host.startsWith("[") || host === "localhost") {
      signals.push("The destination is an IP address or local hostname, not a verified publisher domain.");
    }
    if (commonShorteners.has(host)) {
      signals.push("This is a recognized URL-shortening service. The visible address hides the eventual destination.");
    }
    if (containsPublisherClaim(host) && !officialPublisherHost(host)) {
      signals.push("The hostname suggests Rockstar/GTA branding but is NOT under rockstargames.com. Branding in a domain is not publisher authorization.");
    }
    if (/\b(gta[-_ ]?(?:6|vi)|grand[-_]?theft[-_]?auto)[-_\s]?(?:demo|beta|crack|unlock|early|leak|installer|setup)\b/i.test(decodeURIComponentSafe(parsed.pathname))) {
      signals.push("The URL path advertises a potentially misleading GTA VI demo, early-access, installer or unlock claim. Verify against current publisher statements.");
    }
    if (/(?:wallet[-_]?connect|claim[-_]?reward|free[-_]?activation|crypto[-_]?payment)/i.test(parsed.pathname + parsed.search)) {
      signals.push("The URL includes a payment, wallet, reward or activation term. Treat unexpected authorization requests cautiously.");
    }
    if (parsed.port && !["80", "443"].includes(parsed.port)) {
      signals.push("The URL specifies a nonstandard port. This is not malicious by itself but changes the destination endpoint.");
    }
    if (officialPublisherHost(host)) {
      signals.push("The hostname falls under the known rockstargames.com domain. This is a domain-identity hint only: verify the exact page and do not infer that a linked download is safe.");
    }

    const title = signals.length
      ? "Review these URL signals"
      : "No obvious structural warning found";
    const description = signals.length
      ? "These are clues to investigate, not a malware verdict. An ordinary-looking URL can still be unsafe."
      : "This review found no warning in its limited rules. It did NOT verify ownership, inspect the page, follow redirects, or check the destination against threat feeds.";
    display(title, description, host, signals);
  });

  function decodeURIComponentSafe(input) {
    try { return decodeURIComponent(input); } catch (_) { return input; }
  }
})();
