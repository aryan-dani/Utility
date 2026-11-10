# SEO log — Utility OS

## Baseline (2026-11-10)

### Keyword research
See `seo-audit/keywords.json`. Primary MIT-WPU syllabus/notes/GPA queries confirmed against official ILIP, mitwpu.edu.in programme pages, and third-party CGPA tools. Avoid positioning Utility as an ERP replacement.

### Crawl checklist (production)
| Check | Result |
|---|---|
| robots.txt | Allow `/`; disallow `/admin`, `/api/`, `/login`, `/signup`, `/profile` |
| sitemap.xml | Only marketing/campus/legal before this branch |
| Canonicals | Present on public pages via `indexableMeta` |
| Home JSON-LD | WebSite + SoftwareApplication (no fake ratings) |
| OG/Twitter | Static `opengraph-image.png` / `twitter-image.png` |
| lang | Was `en` (updated to `en-IN` in this branch) |
| AuthGate gap | **Top finding:** `/syllabus`, `/resources`, `/gpa`, `/ask`, `/planner`, `/srs`, `/timer`, `/visualize` were signed-in + `noindex` despite public catalog APIs |
| JS-off HTML | Home/campus return full SSR marketing HTML; `/gpa` and `/syllabus` returned shells without indexable academic copy |

### Lighthouse lab (production, before public catalog ship)

| Page | Form | Perf | SEO | A11y | BP | LCP (ms) | CLS |
|---|---|---:|---:|---:|---:|---:|---:|
| Home | mobile | 91 | 100 | 98 | 96 | 1992 | 0.020 |
| Home | desktop | 94 | 100 | 98 | 96 | 1575 | 0.014 |
| Campus | mobile | 90 | 100 | 98 | 100 | 2038 | 0.004 |
| Campus | desktop | 88 | 100 | 98 | 100 | 1019 | 0.009 |
| Campus labs | mobile | 86 | 100 | 98 | 100 | 2404 | 0.004 |
| Campus labs | desktop | 94 | 100 | 98 | 100 | 814 | 0.005 |
| Install | mobile | 81 | 100 | 98 | 100 | 3315 | 0.004 |
| Install | desktop | 97 | 100 | 98 | 100 | 882 | 0.005 |

Raw JSON/HTML: `seo-audit/baseline/`.

### Next planned fix
Ship public `/mit-wpu` ISR catalog, unlock `/gpa` + `/visualize`, add tool explainers, expand sitemap, server-rendered home links.

---

## Iteration 1 — Catalog + tools unlock (this branch)

### What changed
- Public ISR routes under `/mit-wpu` (hub, branch, semester, subject)
- AIDS Sem 3–5 unit outlines from `syllabusData.ts`; other pages list catalog titles only
- `/gpa` and `/visualize` public + indexable; FAQ visible on GPA
- Tool explainers: study-planner, flashcards, ask-ai, focus-timer
- `lang="en-IN"`, dynamic sitemap, richer 404, home crawlable nav
- Auth allowlist updated; no DB schema changes; no file-byte proxying

### Metrics
Re-measure after deploy in `seo-audit/iter-1/` (production URLs). Local gates tracked via lint/typecheck/test + Lighthouse on preview when available.
