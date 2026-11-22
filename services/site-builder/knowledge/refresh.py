"""Refresh the assistant's offline search index from MalGuard's public sitemap."""
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit


def download(url):
    address = urlsplit(url)
    if address.scheme != "https" or address.netloc != "malguard.site" or address.query:
        raise ValueError(f"Unexpected sitemap address {url}")
    return subprocess.check_output(["curl", "--fail", "--silent", "--show-error",
                                    "--retry", "2", "--max-time", "20", "--max-filesize", "4000000",
                                    url]).decode("utf-8", "replace")


class Article(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.body = []
        self.main = []
        self.title = []
        self.description = ""

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "meta" and attributes.get("name") == "description":
            self.description = attributes.get("content", "")
        if tag not in "area base br col embed hr img input link meta param source track wbr".split():
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            del self.stack[len(self.stack) - 1 - self.stack[::-1].index(tag):]

    def handle_data(self, data):
        if any(t in self.stack for t in ("script", "style", "svg", "nav", "footer", "noscript", "template")):
            return
        text = re.sub(r"\s+", " ", data).strip()
        if text:
            if "title" in self.stack:
                self.title.append(text)
            if "body" in self.stack:
                self.body.append(text)
            if "main" in self.stack or "article" in self.stack:
                self.main.append(text)


def index(url):
    article = Article()
    article.feed(download(url))
    article.close()
    return dict(url=url, title=" ".join(article.title), text=" ".join([
        article.description, *(article.main or article.body)]).strip())


if __name__ == "__main__":
    sitemap = ET.fromstring(download("https://malguard.site/sitemap.xml"))
    urls = [el.text for el in sitemap.findall(".//{*}loc") if el.text]
    with ThreadPoolExecutor(max_workers=5) as pool:
        pages = list(pool.map(index, urls))
    if not pages or any(not item["text"] for item in pages):
        raise ValueError("Incomplete site index")
    output = Path(__file__).with_name("pages.json")
    tmp = output.with_suffix(".tmp")
    tmp.write_text(json.dumps(pages, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(output)
    print(f"Indexed {len(pages)} pages")
