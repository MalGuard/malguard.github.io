import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("auditor", Path(__file__).resolve().parents[1] / "scripts" / "audit_site.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AuditSiteTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.site_url = "https://example.test/"
        (self.root / "robots.txt").write_text("User-agent: *\nSitemap: https://example.test/sitemap.xml\n")
        (self.root / "sitemap.xml").write_text('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.test/</loc></url></urlset>')
        self.put_html()

    def put_html(self, inner=""):
        (self.root / "index.html").write_text('''<!doctype html><html lang="en"><head><title>Example</title><meta name="description" content="Example site"><link rel="canonical" href="https://example.test/"><meta property="og:title" content="Example"><meta property="og:description" content="Text"><meta property="og:image" content="https://example.test/i.png"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Example"}</script></head><body><h1>Example</h1>''' + inner + "</body></html>")

    def test_baseline_is_read_only_and_scores(self):
        before = (self.root / "index.html").read_bytes()
        report = module.audit(self.root, self.site_url)
        self.assertEqual(report["technical_seo_checklist_score"], 100)
        self.assertEqual(report["geo_technical_readiness_heuristic"], 71)
        self.assertEqual((self.root / "index.html").read_bytes(), before)
        self.assertEqual(report["issues"], [])

    def test_invalid_json_ld_and_missing_alt_detected(self):
        self.put_html('<img src="image.png">')
        p = self.root / "index.html"
        p.write_text(p.read_text().replace('{"@context":"https://schema.org","@type":"Organization","name":"Example"}', '{invalid'))
        report = module.audit(self.root, self.site_url)
        failed = [x["check"] for x in report["checks"] if not x["pass"]]
        self.assertIn("valid JSON-LD when present", failed)
        self.assertIn("image alt attributes", failed)

    def test_broken_local_link_detected(self):
        self.put_html('<a href="/missing.html">Missing</a><a href="https://elsewhere.test/a.html">Other</a>')
        report = module.audit(self.root, self.site_url)
        self.assertTrue(any("/missing.html" in x for x in report["issues"]))
        self.assertFalse(any("elsewhere.test" in x for x in report["issues"]))
        self.assertLess(report["technical_seo_checklist_score"], 100)

    def test_sitemap_missing_page_and_malformed(self):
        p = self.root / "sitemap.xml"
        p.write_text('<?xml version="1.0"?><urlset><url><loc>https://example.test/missing.html</loc></url></urlset>')
        r = module.audit(self.root, self.site_url)
        self.assertTrue(any("missing file" in x for x in r["issues"]))
        p.write_text("<bad>")
        r = module.audit(self.root, self.site_url)
        self.assertTrue(any("Invalid sitemap" in x for x in r["issues"]))
        self.assertIsNone(r["technical_seo_checklist_score"])

    def test_path_traversal_and_offsite_rejected(self):
        self.assertIsNone(module.local_path(self.root, self.site_url, "https://example.test/%2e%2e/secret.html"))
        self.assertIsNone(module.local_path(self.root, self.site_url, "https://attacker.test/p.html"))
        self.assertIsNone(module.local_path(self.root, self.site_url, "https://example.test/a%5cb.html"))

    def test_schema_graph_recursion(self):
        self.assertTrue(module.has_schema_type({"@graph": [{"@type": "Organization"}]}, "Organization"))
        self.assertFalse(module.has_schema_type({"@type": "WebSite"}, "Organization"))


if __name__ == "__main__":
    unittest.main()
