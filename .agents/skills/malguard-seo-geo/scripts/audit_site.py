#!/usr/bin/env python3
"""Offline, read-only technical SEO / GEO-readiness audit for a static site.

No HTTP requests, file mutations, third-party packages, or ranking predictions.
"""
from __future__ import annotations

import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from xml.etree import ElementTree as ET


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = []
        self.h1 = []
        self.description = []
        self.canonical = []
        self.og = {}
        self.links = []
        self.jsonld = []
        self.language = ""
        self.robots = []
        self.missing_img_alt = 0
        self._title_depth = 0
        self._h1_depth = 0
        self._jsonld_depth = 0
        self._jsonld_buffer = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.language = a.get("lang") or ""
        if tag == "title":
            self._title_depth += 1
        if tag == "h1":
            self._h1_depth += 1
            self.h1.append("")
        if tag == "meta":
            name = (a.get("name") or "").lower()
            prop = (a.get("property") or "").lower()
            if name == "description":
                self.description.append(a.get("content") or "")
            if name == "robots":
                self.robots.append(a.get("content") or "")
            if prop.startswith("og:"):
                self.og[prop] = a.get("content") or ""
        if tag == "link" and "canonical" in (a.get("rel") or "").lower().split():
            self.canonical.append(a.get("href") or "")
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        if tag == "img" and "alt" not in a:
            self.missing_img_alt += 1
        if tag == "script" and (a.get("type") or "").lower() == "application/ld+json":
            self._jsonld_depth += 1
            self._jsonld_buffer = []

    def handle_data(self, data):
        if self._title_depth:
            self.title.append(data)
        if self._h1_depth and self.h1:
            self.h1[-1] += data
        if self._jsonld_depth:
            self._jsonld_buffer.append(data)

    def handle_endtag(self, tag):
        if tag == "title":
            self._title_depth = max(0, self._title_depth - 1)
        if tag == "h1":
            self._h1_depth = max(0, self._h1_depth - 1)
        if tag == "script" and self._jsonld_depth:
            self._jsonld_depth -= 1
            raw = "".join(self._jsonld_buffer).strip()
            if raw:
                try:
                    self.jsonld.append(json.loads(raw))
                except json.JSONDecodeError:
                    self.jsonld.append({"__invalid_jsonld__": True})
            self._jsonld_buffer = []


def has_schema_type(data, desired):
    if isinstance(data, list):
        return any(has_schema_type(x, desired) for x in data)
    if isinstance(data, dict):
        ty = data.get("@type", [])
        if isinstance(ty, str):
            ty = [ty]
        if isinstance(ty, (list, tuple)) and desired in ty:
            return True
        return any(has_schema_type(v, desired) for k, v in data.items() if k != "@type")
    return False


def local_path(root, site_url, url):
    """Map same-origin paths to local files safely; return None otherwise."""
    base = urlsplit(site_url)
    target = urlsplit(url)
    if target.scheme not in ("https", "http") or target.netloc.lower() != base.netloc.lower():
        return None
    candidate = unquote(target.path)
    if "\\" in candidate or "\x00" in candidate or "//" in candidate:
        return None
    parts = candidate.split("/")
    if any(p in ("..", ".") for p in parts):
        return None
    if candidate.endswith("/"):
        candidate += "index.html"
    p = (root / candidate.lstrip("/")).resolve()
    try:
        p.relative_to(root.resolve())
    except ValueError:
        return None
    return p


def read_pages(root, site_url):
    issues = []
    sitemap = root / "sitemap.xml"
    if not sitemap.is_file():
        return [], ["Missing sitemap.xml"], False
    try:
        doc = ET.parse(sitemap)
    except (ET.ParseError, OSError) as exc:
        return [], [f"Invalid sitemap.xml: {exc}"], False
    locs = [(n.text or "").strip() for n in doc.findall(".//{*}loc")]
    if not locs:
        issues.append("Sitemap contains no <loc> entries")
    if len(locs) != len(set(locs)):
        issues.append("Sitemap contains duplicate URLs")
    pages = []
    for url in dict.fromkeys(locs):
        p = local_path(root, site_url, url)
        if p is None:
            issues.append(f"Sitemap has off-site/unsafe URL: {url}")
        elif not p.is_file():
            issues.append(f"Sitemap references missing file: {url}")
        elif p.suffix.lower() not in (".html", ".htm"):
            issues.append(f"Sitemap URL does not resolve to HTML: {url}")
        else:
            pages.append((url, p))
    homepage = local_path(root, site_url, site_url)
    if homepage and homepage.is_file() and all(p != homepage for _, p in pages):
        issues.append("Homepage missing from sitemap")
        pages.insert(0, (site_url, homepage))
    return pages, issues, True


def audit(root, site_url):
    root = root.resolve()
    if not root.is_dir():
        raise ValueError(f"Site directory does not exist: {root}")
    site_url = site_url.rstrip("/") + "/"
    if urlsplit(site_url).scheme != "https" or not urlsplit(site_url).netloc:
        raise ValueError("--site-url must be a fully qualified HTTPS URL")

    pages, issues, sitemap_ok = read_pages(root, site_url)
    checks = []
    parsed = []
    robots_file = root / "robots.txt"
    robots = robots_file.read_text(encoding="utf-8", errors="replace") if robots_file.is_file() else ""

    def check(page, name, passed, detail=""):
        checks.append({"page": page, "check": name, "pass": bool(passed), "detail": detail})

    check("site", "sitemap exists, parses and has valid entries", sitemap_ok and not issues,
          "; ".join(issues))
    check("site", "robots.txt advertises sitemap", bool(robots) and
          any(line.strip().lower() == f"sitemap: {site_url}sitemap.xml".lower()
              for line in robots.splitlines()))

    for url, path in pages:
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
            h = PageParser()
            h.feed(content)
            h.close()
        except (OSError, ValueError) as exc:
            issues.append(f"Cannot parse {url}: {exc}")
            continue
        parsed.append((url, h))
        expected = site_url if path == root / "index.html" else url
        page_name = path.relative_to(root).as_posix()
        check(page_name, "nonempty title", bool("".join(h.title).strip()))
        check(page_name, "unique nonempty meta description", len(h.description) == 1 and bool(h.description[0].strip()))
        check(page_name, "single self-referencing HTTPS canonical", len(h.canonical) == 1 and h.canonical[0] == expected, f"expected {expected}; found {h.canonical}")
        check(page_name, "HTML lang", bool(h.language.strip()))
        check(page_name, "exactly one nonempty H1", len(h.h1) == 1 and bool(h.h1[0].strip()), f"found {len(h.h1)}")
        check(page_name, "Open Graph title/description/image", all(bool(h.og.get(x, "").strip()) for x in ("og:title", "og:description", "og:image")))
        check(page_name, "not marked noindex", all("noindex" not in v.lower() for v in h.robots))
        check(page_name, "image alt attributes", h.missing_img_alt == 0, f"missing alt: {h.missing_img_alt}")
        check(page_name, "valid JSON-LD when present", not any(isinstance(x, dict) and x.get("__invalid_jsonld__") for x in h.jsonld))
        for href in h.links:
            target_url = urljoin(url, href)
            target = urlsplit(target_url)
            if target.scheme not in ("http", "https") or target.netloc.lower() != urlsplit(site_url).netloc.lower():
                continue
            if not (target.path.endswith("/") or target.path.lower().endswith((".html", ".htm"))):
                continue
            p = local_path(root, site_url, target_url)
            if p is None or not p.is_file():
                issues.append(f"Broken internal HTML link on {page_name}: {href}")

    broken_html_links = [x for x in issues if x.startswith("Broken internal HTML link")]
    check("site", "internal HTML links resolve", not broken_html_links,
          f"broken links found: {len(broken_html_links)}")
    score_seo = None if not parsed else round(100 * sum(c["pass"] for c in checks) / len(checks))
    home = next((h for u, h in parsed if local_path(root, site_url, u) == root / "index.html"), None)
    geo_checks = [
        {"check": "homepage has a clear title", "pass": bool(home and "".join(home.title).strip())},
        {"check": "homepage states its language", "pass": bool(home and home.language.strip())},
        {"check": "homepage has a descriptive H1", "pass": bool(home and len(home.h1) == 1 and home.h1[0].strip())},
        {"check": "homepage has valid Organization JSON-LD", "pass": bool(home and any(has_schema_type(x, "Organization") for x in home.jsonld))},
        {"check": "about page in sitemap", "pass": any(p.name == "about.html" for _, p in pages)},
        {"check": "trust page in sitemap", "pass": any(p.name == "trust.html" for _, p in pages)},
        {"check": "sitemap resolves to HTML pages", "pass": sitemap_ok and bool(pages) and not issues},
    ]
    score_geo = None if home is None else round(100 * sum(c["pass"] for c in geo_checks) / len(geo_checks))
    return {
        "site": site_url,
        "mode": "offline-static-read-only",
        "pages_inspected": len(parsed),
        "technical_seo_checklist_score": score_seo,
        "geo_technical_readiness_heuristic": score_geo,
        "disclaimer": "These are local checklist percentages, not Google SEO scores, Lighthouse scores, visibility rankings or measured AI citations.",
        "checks": checks,
        "geo_checks": geo_checks,
        "issues": sorted(set(issues)),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    parser.add_argument("--site-url", default="https://malguard.github.io/")
    parser.add_argument("--format", choices=("markdown", "json"), default="markdown")
    parser.add_argument("--strict", action="store_true", help="Return nonzero on any failed check")
    args = parser.parse_args()
    try:
        report = audit(args.root, args.site_url)
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    if args.format == "json":
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"# Technical SEO and GEO-readiness audit: {report['site']}\n")
        print(f"Pages inspected: {report['pages_inspected']}")
        print(f"SEO checklist: {report['technical_seo_checklist_score'] if report['technical_seo_checklist_score'] is not None else 'N/A'}/100")
        print(f"GEO technical heuristic: {report['geo_technical_readiness_heuristic'] if report['geo_technical_readiness_heuristic'] is not None else 'N/A'}/100\n")
        print(f"**Limitations:** {report['disclaimer']}\n")
        failed = [x for x in report["checks"] if not x["pass"]]
        print(f"Failed checks: {len(failed)}. Additional findings: {len(report['issues'])}.\n")
        for item in failed:
            print(f"- FAIL {item['page']}: {item['check']} {item['detail']}")
        for issue in report["issues"]:
            print(f"- ISSUE {issue}")
        print("\nFor real search performance, check Google Search Console, live HTTP responses, rendered HTML and PageSpeed Insights separately.")
    return int(args.strict and (any(not x["pass"] for x in report["checks"]) or bool(report["issues"])))


if __name__ == "__main__":
    raise SystemExit(main())
