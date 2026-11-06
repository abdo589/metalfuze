# Metal Fuze performance audit — 6 November 2026

## Outcome
Safe improvements applied without modifying production rows, roles, payroll rules, files, or database schema. All 211 tests across 49 files pass (baseline: 208 tests across 48 files). Preview build reports OK. No overall page-speed improvement is claimed: the local before/after startup measurements are effectively unchanged.

## Measurements
Published visitor data, 30 October–6 November, excluding bots and collapsing repeated metric emissions to one peak per metric series:

| Page | Metric | Readings | p75 | Good rate |
|---|---|---:|---:|---:|
| / | FCP | 132 | 3,955 ms | 43.94% |
| / | LCP | 119 | 6,218 ms | 30.25% |
| / | INP | 106 | 104 ms | 85.85% |
| / | CLS | 125 | 0.09971 | 75.20% |
| / | TTFB | 167 | 2,751.60 ms | 47.31% |
| /sales | FCP | 15 | 738.5 ms | 86.67% |
| /sales | LCP | 13 | 913 ms | 84.62% |
| /sales | INP | 13 | 56 ms | 100% |

Root FCP and LCP exceed Google's good thresholds (1,800 ms and 2,500 ms); root INP meets 200 ms and CLS narrowly meets 0.1. Other pages have fewer than 30 readings and cannot be reliably ranked. No post-publish visitor baseline exists for these edits.

Local experiment: Chromium, localhost Vite development server, signed out, /, 1280×1800, cold browser/context each run, browser cache disabled, 4× CPU slowdown, 150 ms latency, 1.6 Mbps download, 750 Kbps upload. Three identical runs before/after; medians below. These are development measurements, not production scores: unbundled development modules dominate transfer/time.

| Metric | Before | After |
|---|---:|---:|
| FCP | 1,332 ms | 1,344 ms |
| LCP | 108,972 ms | 108,408 ms |
| Resource transfer | 20,297,964 bytes | 20,227,581 bytes |
| CLS | 0.00000951 | 0.00000951 |

LCP before runs: 108,940 / 108,972 / 109,028 ms. After: 109,344 / 108,372 / 108,408 ms. FCP before: 1,372 / 1,240 / 1,332 ms; after: 2,444 / 1,344 / 1,300 ms. Variation does not establish meaningful startup improvement. A production bundle comparison was not run; manual builds are managed by the preview harness. Physical low-end-device testing was unavailable.

## Twelve audit areas, in requested order
1. **Database indexing/query optimization:** inspected production slow-query statistics, existing indexes, table sizes, and read-only EXPLAIN ANALYZE. No migration warranted for this bounded pass. Cloud memory 59%, disk 4%, connections 7/60, no recent exhaustion; no instance upgrade recommended. Shared-project reads average 10.00 ms (2,911 calls), attendance 9.06 ms (2,975), leave balances 65.33 ms (202), sales 7.70 ms (1,555), HR records 22.42 ms (483). These are accumulated historical query statistics, not request latency. Attendance already has punched_at index; October ordered sample returns 500 rows using index scan + incremental sort, execution 11.011 ms, planning 22.866 ms. November empty sample executes in 0.080 ms, not a representative workload. Plans use the diagnostic caller, not user RLS; no claim about authenticated query speed. Largest application table estimate is only 587 rows. Leave-balances optimization deferred: changing entitlement calculations requires targeted correctness/workload evidence. No risky migration or production deployment performed; none submitted for approval.
2. **N+1:** no confirmed high-impact N+1 read eliminated. Existing role/session/read coalescing preserved. SalesReports opening and live refresh are different triggers, not evidence of a duplicate loop; not removed speculatively.
3. **Selective fetching:** monthly attendance already projects its nine consumed fields; kept them all. New ordering uses id without transferring it. Broad selects on editable sales/settlement records were not narrowed without exhaustive edit/export consumer evidence.
4. **Pagination:** replaced monthly attendance's 20,000-row cap with 500-row inclusive ranges ordered by punched_at then unique id. Combine every page before updating totals; keep previous complete results on errors; serialize refreshes. This prevents treating a truncated result as a full month. Tradeoff: an October-size 549-row result needs two requests rather than one; consistency/completeness, not raw latency, motivates this change. Offset pagination has no transaction snapshot: concurrent backdated inserts can shift pages; live refresh converges, but snapshot isolation is not guaranteed. Other small lists retained to avoid incomplete aggregates/exports.
5. **Image format/sizing:** added lossless transparent WebP logo variants at 320 and 768 pixels, responsive source selection, original PNG fallback. Original light-mode PNG 190,317 bytes versus 11,052 / 37,140 bytes; dark PNG 103,912 versus 9,924 / 25,582 bytes. 768px variants reduce individual payloads by 80.49% / 75.38%. Print/export originals untouched; no source images deleted.
6. **Resource loading:** visible logos remain eager; no LCP image lazy loading. Assistant and maps already load on demand; export dependencies already defer. Broader chart splitting deferred without a production chunk baseline and signed-in verification. Screen logos retain explicit intrinsic dimensions.
7. **CDN/cache:** original published logo response verified HTTP/2 200 and Cache-Control public,max-age=31536000,immutable. New immutable asset IDs provide invalidation without deleting originals. Existing per-session short-lived read cache and write/live invalidation retained. No shared caching added to personalized data. PWA navigation privacy/staleness remains a review concern, not changed speculatively; preview registration is already disabled.
8. **Parallel execution:** independent audit/diagnostic operations ran concurrently; existing runtime coalescing retained. Attendance pages intentionally sequential; unknown final page and full-result error semantics make speculative parallel reads unsuitable.
9. **Loading states:** no new global skeleton/flash added. Existing pending interfaces retained. Prolonged authenticated operations could not be observed as a real signed-in user; no artificial delays or speed simulation added.
10. **Optimistic updates:** no new optimistic financial/permissions action. Existing save behavior retained; no speculative low-risk flow changed.
11. **AI streaming:** assistant already uses streamText/toUIMessageStreamResponse and cancellation signal; retained. Translation intentionally returns complete JSON. Real authenticated token streaming/production buffering not tested; no provider usage triggered.
12. **Benchmark/verification:** exact local before/after experiment above, real-visitor baseline, all tests, build log, mobile light/dark rendering, responsive logo loads, no horizontal overflow, and invalid-login error handling without browser errors verified. Successful login and signed-in payroll/sales/attendance readback are unverified: managed self-session mint reports no matching account. No other user's account selected automatically. Physical mobile and published post-change measurements remain unavailable until publish/device testing.

## Changed files
- src/components/BrandLogo.tsx — responsive PNG/WebP light/dark logo wrapper.
- src/components/AuthGate.tsx, src/components/AppSidebar.tsx, src/routes/index.tsx — use screen-sized logo sources.
- src/assets/metal-fuze-logo-{320,768}.webp.asset.json and src/assets/metal-fuze-logo-light-{320,768}.webp.asset.json — four CDN pointers.
- src/lib/read-all-pages.ts, src/lib/read-all-pages.test.ts — complete paged reads and three regression cases (all rows, late-page failure, exact multiple).
- src/lib/attendance-data.ts — complete, deterministic ordered pages and serialized refreshes.
- roadmap.md, performance-audit.md — task status/report.

All actual content routes already have unique titles/descriptions and social metadata; no unrelated metadata edits. Root architecture-note save was skipped because AGENTS.md is at its size limit and existing user rules must not be shortened. Database migrations: none.

## Remaining operational risks / next validation
- Root production slowness remains measured, not solved by image payload savings alone. Capture a published post-change baseline and production chunk breakdown before broader refactoring.
- Successful signed-in navigation/data/export verification requires an authorized session; physical push/device checks are separate existing blockers, unaffected by this audit.
- CDN assets are added only; original logos and all business files/data retained. Extra logo variants increase asset count, not application data volume.
- Attendance range pagination preserves all observed pages but does not provide snapshot isolation during simultaneous historical inserts.