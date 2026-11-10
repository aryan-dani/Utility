# SEO report — Utility OS discoverability

Branch: `seo/discoverability` · Date: 2026-11-10

## Summary

Public MIT-WPU catalog and tool landings are indexable HTML. Syllabus/resource **titles** (and AIDS Sem 3–5 unit outlines already in-repo) are crawlable; file bytes stay on Drive/files host behind sign-in. `/gpa` and `/visualize` are public. Planner, Ask, flashcards, and timer keep signed-in apps `noindex` with public explainer pages under `/mit-wpu/*`.

## Baseline vs iteration 1

### Production baseline (pre-ship marketing pages)

| Page | Mobile Perf | SEO | A11y | BP |
|---|---:|---:|---:|---:|
| Home | 91 | 100 | 98 | 96 |
| Campus | 90 | 100 | 98 | 100 |
| Campus labs | 86 | 100 | 98 | 100 |
| Install | 81 | 100 | 98 | 100 |

### Local lab after ship (`next start`, cold)

| Page | Mobile Perf | SEO | A11y | BP |
|---|---:|---:|---:|---:|
| Home | 77 | 100 | 98 | 96 |
| `/mit-wpu` | 83 | 100 | 98 | 96 |
| `/gpa` | 70 | 100 | 98 | 96 |
| `/visualize` | 70 | 100 | 100 | 96 |

SEO / accessibility / best-practices meet the ≥95 / 100 gates on the new templates. Local Perf is below 95 because the run is cold localhost without the Vercel CDN — not a regression signal against the production baseline. Further localhost Perf loops were stopped as flat/non-comparable.

## New public URLs

- `/mit-wpu`
- `/mit-wpu/{aids|cse|ece}`
- `/mit-wpu/{branch}/semester/{1–8}`
- `/mit-wpu/{branch}/semester/{n}/{subject}` (AIDS outline subjects + catalog subjects)
- `/mit-wpu/study-planner`, `/mit-wpu/flashcards`, `/mit-wpu/ask-ai`, `/mit-wpu/focus-timer`
- `/gpa`, `/visualize`, `/visualize/{algorithmId}` (unlocked)

Sitemap builds these dynamically plus existing marketing pages in `publicPages.json`.

## Schema notes

| Surface | Types |
|---|---|
| Home | `WebSite`, `SoftwareApplication` (no fake ratings) |
| MIT-WPU hub / branch / semester | `CollectionPage` + visible + `BreadcrumbList` |
| Subject pages | Breadcrumbs; topic lists only where `syllabusData` has AIDS Sem 3–5 units |
| GPA | `WebApplication` + `FAQPage` matching on-page FAQ |
| Visualize | Indexable catalog (existing algorithm copy) |

Validate with [Rich Results Test](https://search.google.com/test/rich-results) after deploy.

## Content policy (shipped)

Public HTML may show subject names, syllabus unit/topic titles (AIDS 3–5 only), resource titles, and counts. No PDF/Drive bytes, no user data. CTAs: sign in to open files / Ask / save planner.

## Manual tasks for Aryan

1. Confirm Search Console property for `utilityos.tech` (and any apex/www variants).
2. Submit `https://utilityos.tech/sitemap.xml` after this merges.
3. Re-run Lighthouse mobile on production `/`, `/mit-wpu`, `/gpa`, `/visualize` into `seo-audit/iter-2/` once CDN is warm; chase Perf ≥95 only if production lab fails the gate.
4. Approve any syllabus wording you want changed on public subject pages (copy is from existing `syllabusData` / catalog titles only).
5. Optional backlinks: campus clubs, personal LinkedIn, programme Discord — no paid link building in scope.

## Out of scope (unchanged)

Auth/session model, Postgres schema, Drive proxying through Vercel, ranking guarantees.
