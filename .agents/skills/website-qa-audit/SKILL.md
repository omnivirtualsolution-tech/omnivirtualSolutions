---
name: website-qa-audit
description: >-
  Use this skill to find bugs, weaknesses, and risks in a website or web app
  before users do — across the frontend, backend, database, security, performance,
  accessibility, emails, and deployment. Defines audit method passes, coverage checklists,
  severity triage, and reporting formats. Trigger on: "check the system / website
  for bugs", "audit this", "QA this before launch", "is this secure / fast /
  accessible / broken anywhere?", or pre-deployment inspections.
---

# Website QA & Deep System Audit Skill

## Purpose
Use this skill to find bugs, weaknesses, and risks in a website or web app **before
users do** — across the frontend, backend, database, security, performance,
accessibility, emails, and deployment. It defines how to audit (method), what to
check (coverage), how to rate findings (triage), and how to report them (evidence).

The auditor's job is to produce **verified findings with evidence**, not a generic
checklist dump. A finding you didn't reproduce is a suspicion, and must be labeled as one.

## When to trigger
- "check the system / website for bugs", "audit this", "QA this before launch"
- "is this secure / fast / accessible / broken anywhere?"
- After a large change (new backend, admin panel, redesign) and before deploying
- When something "feels off" but nobody knows where

---

## 1. Ground rules for the auditor (read first)

1. **Verify, don't assume.** Run the thing. Hit the endpoint. Open the page at the
   width. Label every finding **CONFIRMED** (reproduced, with steps/evidence) or
   **SUSPECTED** (looks wrong from reading code, not yet reproduced).
2. **Never fabricate results.** If a tool can't be run in the current environment,
   say so and list it under "Not tested" rather than implying it passed.
3. **Read before you change.** An audit reports; it doesn't silently fix. Propose
   fixes separately, and fix only what the user approves (or what is trivially safe
   and clearly requested).
4. **Never run destructive or load tests against production** without explicit
   permission. Use local/staging. Scanners like OWASP ZAP: passive baseline scans
   only unless authorized for active scanning.
5. **Don't leak secrets in the report.** If you find a key/token, report the file
   and line, redact the value.
6. **Prioritize by user impact**, not by how interesting the bug is.

---

## 2. Audit method: work in passes

Pass 0 — **Recon (10% of effort).** Map the system before testing it: pages/routes,
API endpoints, DB tables, third-party services, env vars, build/deploy path, who
the users are, and the 3–5 critical user journeys (e.g. visit → read service →
submit contact form → confirmation email; admin login → edit content → live update).
Test critical journeys first, always.

Pass 1 — **Static review (read the code/config).** Dependencies, secrets, route
auth, input validation, SQL construction, CORS, static-file exposure, error handling.

Pass 2 — **Automated scans.** Lint, type-check, dependency audit, secret scan,
Lighthouse, axe, link checker, header check, ZAP baseline.

Pass 3 — **Dynamic/manual testing.** Walk the journeys in a real browser at multiple
widths; try to break forms and endpoints; test failure paths (DB down, bad input,
slow network).

Pass 4 — **Regression & edge cases.** Re-test after fixes; empty states, huge input,
unicode/emoji, back/forward buttons, double-clicks, expired sessions.

Pass 5 — **Report** (section 11).

---

## 3. Functional & UI testing
- Every nav link, CTA, footer link, and anchor goes to the right place; no 404s,
  no redirect loops; HTTP→HTTPS and www/non-www redirects behave.
- Direct URL access (deep links) and refresh work on every route; custom 404 page exists.
- Back/forward buttons behave; state isn't lost unexpectedly.
- **Forms**: required/optional validation, bad formats, very long input, special
  characters, double-submit, success state, error state, loading state, and
  what the user sees when the server is down.
- Search/filter/pagination return correct, non-duplicated results; empty states are handled.
- Images load, aren't stretched, have alt text; no layout shift when they load.
- Console is clean: no JS errors, no failed network requests, no mixed-content warnings.
- Content: placeholder text ("lorem", "TODO", "example.com"), typos, wrong prices,
  stale dates left in templates.

## 4. Responsive & cross-browser
- Test at ~375, 768, 1024, 1440px, both orientations on mobile/tablet.
- No horizontal scroll, clipped text, overlapping elements, or unreachable buttons.
- Real browsers: Chrome, Safari (WebKit), Firefox, Edge. Emulation is an
  approximation — real-device/real-browser checks catch what emulation misses.
- Touch: tap targets ≥44px, no hover-only functionality.
- Zoom to 200–400% and with large system fonts: content must stay usable (WCAG reflow).
- Dark mode (if present): contrast, images/logos on dark backgrounds, no flash of wrong theme.

## 5. Accessibility (WCAG 2.2 AA baseline)
- Full keyboard pass: Tab order logical, visible focus, no keyboard traps, skip link, Esc closes modals.
- Screen-reader spot check (VoiceOver/NVDA; TalkBack on Android): headings, landmarks,
  labels on every input, announced errors/status messages.
- Contrast ≥4.5:1 body, ≥3:1 large text/UI components — measured, not eyeballed.
- Alt text meaningful vs decorative (`alt=""`); form labels programmatic, not placeholder-only.
- Automated: axe / Lighthouse a11y (catches only a portion of issues — manual pass required).
- Validate HTML (W3C validator) — invalid markup causes subtle assistive-tech bugs.

## 6. Performance (Core Web Vitals)
- Targets: LCP < 2.5s, CLS < 0.1, INP < 200ms; under ~3s load is a sane general goal.
- Lighthouse in mobile mode with throttling; check the **network waterfall**: oversized
  images, unminified/unused JS and CSS, render-blocking resources, too many third-party scripts.
- Caching: static assets cacheable with long max-age + hashed filenames; HTML not cached stale.
- Compression (gzip/brotli) enabled; images WebP/AVIF, lazy-loaded below the fold, LCP image not lazy.
- API: slow endpoints (measure p95), N+1 queries, missing indexes, unbounded list endpoints.
- Memory/connection leaks: long-lived connections (e.g. SSE clients) cleaned up on close.

## 7. Security audit (OWASP-aligned)
**Static / config**
- Dependencies: `npm audit` (use `--audit-level=high` in CI); check for abandoned packages.
- Secrets: scan repo and git history (e.g. Gitleaks); `.env` is gitignored and **not
  served**; no keys in client bundles.
- **Static file exposure**: if Express serves a folder, confirm it is a dedicated
  `public/` directory — never the project root (which would expose `backend/`,
  `.env`, `*.db`, `package.json`, `schema.sql`, source). Try requesting
  `/.env`, `/backend/db.js`, `/data/<file>.db`, `/package.json`, `/.git/config`.
- CORS: not `*` for credentialed/sensitive routes; allowed origins explicit.
- Security headers present: CSP, HSTS, X-Content-Type-Options, frame protection
  (frame-ancestors/X-Frame-Options), Referrer-Policy, Permissions-Policy. Remove
  `X-Powered-By`.
- Cookies: `Secure`, `HttpOnly`, `SameSite`.
- Error handling: no stack traces, SQL errors, or file paths in responses.

**Dynamic**
- **Access control (the most common real bug):** list every endpoint and mark
  public vs authenticated vs admin; then call each **without** credentials.
  Any endpoint returning personal data or accepting writes without auth is a
  finding. Pay special attention to "convenience" endpoints (e.g. a route that
  lists form submissions/leads, exports, debug/health routes with internals).
- Injection: all DB queries parameterized (test with `' OR 1=1--`, quotes, unicode).
- XSS: submit `<script>`/`<img onerror>` payloads through every input, then view where
  that data is rendered (admin views, emails, live-update DOM writes — prefer
  `textContent` over `innerHTML`).
- CSRF on cookie-authenticated state changes; open redirects; SSRF on any
  "fetch this URL" feature; path traversal on file/image endpoints.
- File uploads: type/size allowlist, server-side validation, not executable, not
  served from a path that runs code.
- Rate limiting on contact forms, login, password reset, and any write endpoint;
  spam/bot protection on public forms (honeypot/CAPTCHA/rate limit).
- Auth: see `login-security-mastery` skill — hashing, session rotation, enumeration, MFA.
- Tools: OWASP ZAP baseline (passive) for headers/cookies/disclosure; Burp for manual testing.

## 8. Backend, API & data
- Every endpoint: correct status codes, consistent error shape, validates input,
  handles missing/extra/wrong-typed fields, handles huge bodies (body size limit).
- Idempotency/double-submit on create endpoints (contact form, orders).
- DB: migrations re-runnable and ordered (e.g. indexes created after tables);
  constraints/foreign keys exist; **seed/import scripts are idempotent** (running
  twice must not duplicate rows) and handle skipped/empty source files visibly.
- Data correctness: spot-check imported/seeded records against the source of truth
  (counts, prices, features, image paths, slugs unique). Check for rows that point
  at images/files that don't exist.
- Timeouts, retries, and graceful failure when the DB or a third party is down.
- Environment parity: works with both local DB and hosted DB (e.g. Turso) config;
  missing env vars fail loudly at startup, not mysteriously later.
- Logs: useful, structured, no secrets/PII; unhandled promise rejections caught.

## 9. Specific integrations (check if present)
- **Admin/CMS live editing**: unauthenticated write attempts rejected; edit → DB →
  public page updates without reload; SSE reconnect works; two editors don't corrupt
  data; revision history captures prior value; uploads validated.
- **Email**: renders in Gmail/Outlook/Apple Mail in light and dark; links correct
  (no `example.com`), images hosted, plain-text part present, SPF/DKIM/DMARC set up
  for the sending domain, unsubscribe works where required, no header injection via
  form fields (strip newlines in subject/name/email).
- **Payments/third-party**: webhook signature verification, idempotent handling, test mode vs live keys.
- **Analytics/cookies/legal**: consent banner behavior, privacy policy and terms present and linked.

## 10. SEO, deployment & operations
- Unique `<title>`/meta description per page, one `h1`, canonical tags, sitemap.xml,
  robots.txt (not accidentally blocking everything or exposing admin paths), OG tags, favicon.
- Staging not indexed; production not `noindex`.
- HTTPS valid and auto-renewing; no mixed content.
- Build: production build succeeds from a clean clone (`npm ci && npm run build`);
  no dev-only dependencies or debug flags in production; source maps policy decided.
- Backups for the database and uploads; restore actually tested.
- Monitoring: uptime check, error tracking, alert on 5xx spikes; health endpoint doesn't leak internals.
- Dependency & secret scanning wired into CI so regressions are caught automatically.

---

## 11. Severity triage & reporting

| Severity | Definition | Examples |
|---|---|---|
| **Critical** | Data exposure, auth bypass, site down, data loss — fix before anything else | Unauthenticated endpoint returning customer PII; `.env`/DB file downloadable; SQL injection |
| **High** | Core journey broken or serious risk, no reasonable workaround | Contact form silently fails; admin writes without auth check; checkout error |
| **Medium** | Feature degraded, workaround exists | Layout broken on tablet; slow endpoint; missing validation |
| **Low** | Cosmetic/minor | Typos, small misalignment, console warnings |
| **Info** | Improvement/hardening suggestion | Add a CSP; add an index |

**Report format** (one entry per finding):
```
ID: QA-001
Title: <short, specific>
Severity: Critical | High | Medium | Low | Info
Status: CONFIRMED | SUSPECTED
Area: Security / Backend / UI / A11y / Perf / SEO / ...
Where: <URL / file:line / endpoint>
Steps to reproduce: 1... 2... 3...
Expected vs Actual: ...
Evidence: <response snippet, screenshot note, command output (secrets redacted)>
Impact: <who is affected and how>
Suggested fix: <concrete, minimal>
```

**Report structure:** (1) Executive summary — counts by severity, top 3 risks, go/no-go
recommendation. (2) Findings, ordered by severity. (3) What passed. (4) **Not tested /
limitations** (what you couldn't verify and why). (5) Recommended fix order.

---

## 12. Tooling cheat sheet
| Need | Tool |
|---|---|
| Perf, a11y, SEO, best practices | Lighthouse / PageSpeed Insights |
| Accessibility rules | axe DevTools / axe-core, WAVE, W3C validators |
| E2E / regression automation | Playwright (or Cypress) |
| Cross-browser / real devices | BrowserStack, real devices |
| Dependency vulnerabilities | `npm audit`, Dependabot, Snyk |
| Secret scanning | Gitleaks, GitHub secret scanning |
| Dynamic security scan | OWASP ZAP baseline, Burp Suite |
| Security headers | securityheaders.com, Mozilla Observatory |
| Broken links | Screaming Frog, `linkinator`, W3C link checker |
| Email rendering | Litmus, Email on Acid, caniemail.com |
| API testing | Postman/Newman, curl, supertest |
| Visual regression | Playwright screenshots, Percy |

## 13. Starter automation (suggested for any Node project)
- `npm audit --audit-level=high` and a Gitleaks scan in CI on every push.
- A small Playwright suite covering the critical journeys (load home, open a service,
  submit contact form, admin login → edit → public page updates).
- Lighthouse CI with budgets for LCP/CLS and a11y score so regressions fail the build.
- A smoke script that requests a list of "must be 403/404" URLs (`/.env`, `/backend/*`,
  `/data/*`, `/.git/*`) and "must require auth" API routes, failing if any returns 200.

## 14. Stack-specific watchlist (Vite + Tailwind + Express + libsql/Turso + SSE)
Common bugs seen in this kind of build — check these explicitly:
- `express.static` pointed at the project root (exposes backend files, `.env`, local DB).
- Public "list all submissions/leads" endpoint with no auth (PII leak).
- Contact route missing validation, rate limit, spam protection, or header-injection
  stripping before it feeds an email.
- Seeder not idempotent; silently skipping files; image paths in DB that 404.
- Migration ordering bugs (index before table) resurfacing on a fresh database.
- `cors()` left at default allow-all in production.
- Tailwind `content` globs missing new file paths → classes purged in production build only.
- Vite env vars: only `VITE_`-prefixed vars reach the client; secrets must never use that prefix.
- Dev proxy works but production serves the API on a different origin (CORS/cookie issues).
- SSE: per-process client set breaks with multiple instances; proxies buffering the
  stream; no heartbeat so idle connections get dropped.
- Local SQLite file on an ephemeral host filesystem → data loss on redeploy.
- Windows/OneDrive paths with spaces and sync locking SQLite/`node_modules` — keep the
  project out of OneDrive-synced folders.

## 15. References
- OWASP Top 10 — https://owasp.org/www-project-top-ten/
- OWASP API Security Top 10 — https://owasp.org/API-Security/
- OWASP Web Security Testing Guide — https://owasp.org/www-project-web-security-testing-guide/
- OWASP ZAP — https://www.zaproxy.org/
- WCAG 2.2 quick reference — https://www.w3.org/WAI/WCAG22/quickref/
- web.dev Core Web Vitals — https://web.dev/articles/vitals
- Lighthouse — https://developer.chrome.com/docs/lighthouse/
- Playwright — https://playwright.dev/
- MDN cross-browser testing guide — https://developer.mozilla.org/en-US/docs/Learn/Tools_and_testing/Cross_browser_testing
- Security headers check — https://securityheaders.com/
