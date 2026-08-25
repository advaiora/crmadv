# [F03] — SECURITY CHECKS
# Skill: crm-permessi-e-sicurezza v1.0 | Internal reference
# Open when: the diff adds a query, follows a user-supplied URL, or touches keys, tokens or logs

---

## PART 0 — THE THREE QUESTIONS  [F03:THREE_QUESTIONS]

Security in this CRM reduces, for your purposes, to three questions with a precise place to look for
each. Ask them in this order — the first is the one that costs most when the answer is wrong.

| # | Question | Where to look |
|---|---|---|
| 1 | Is **every** query filtered by workspace? | the query itself, not the guard → [F03:WORKSPACE_SCOPING] |
| 2 | Does every user-supplied address go through `net-guard`? | `server/core/net-guard.ts` → [F03:USER_SUPPLIED_URLS] |
| 3 | Do keys and secrets stay encrypted and out of the logs? | → [F03:SECRETS_AND_LOGS] and the tool at [F03:VAULT_HYGIENE] |

Anything outside these three that looks like a security concern is either the Reviewer's
→ [F04:BOUNDARY_WITH_REVIEWER] or general web-security theory, which is out of scope
→ [F00:OUT_OF_SCOPE].

---

## PART 1 — WORKSPACE SCOPING  [F03:WORKSPACE_SCOPING]

**This is *the* risk of the product.** The CRM is multi-workspace: one instance holds several agencies'
data. A query that forgets its workspace filter returns another company's clients, quotes or
credentials — and it returns them successfully, with a 200, to a legitimately authenticated user. There
is no error to catch and no test that fails.

### What the guard does, and what it does not do for you

`server/guards/requireWorkspace.ts`:

- reads the header `x-workspace-id` or `x-workspace-slug` (one of the two is mandatory, otherwise 400);
- loads the workspace by id or slug (404 if absent);
- verifies the caller's membership;
- refuses members of a `SUSPENDED` workspace (403), with platform Super Admins exempt — and it checks
  the suspension flag only when the workspace is suspended, to keep the common path light;
- returns the workspace.

⚠️ **It establishes *which* workspace the caller is in. It does not filter anything.** The filtering is
the query's own job, every single time. `ensure<Module>Access` running first proves the caller belongs
somewhere — never that the rows coming back belong there too.

### What to check

- **Every new or modified data read and write carries the workspace in its `where`.** Prisma queries,
  raw SQL, aggregations, counts, `findMany`, `findFirst`, `updateMany`, `deleteMany`. A `findUnique` by
  id is the classic miss: an id is guessable or leakable, and without the workspace condition it crosses
  the boundary.
- **Nested relations too.** Filtering the parent does not filter an `include`d child that has its own
  workspace column.
- **The workspace used is the one from the guard**, not one read again from the request body or query
  string. A workspace id taken from user input is user input.
- **Newly added indexes or unique constraints in `prisma/schema.prisma`** that omit the workspace column
  where the existing ones include it: a uniqueness rule that is global instead of per-workspace lets one
  agency's data collide with another's.

**Consequence to state in the report:** the endpoint returns another workspace's data to an
authenticated user, with a successful response and nothing in the logs.

---

## PART 2 — USER-SUPPLIED ADDRESSES  [F03:USER_SUPPLIED_URLS]

Whenever the server follows an address chosen by a user, it must go through
**`server/core/net-guard.ts`**. The module exists so that this logic lives in exactly one place —
its own header says so — and it is used by the SEO scan, the web-asset healthcheck, and the PDF logo
in `server/core/pdf.ts`.

### The three entry points, and which one is the right one

| Function | What it does | Use it when |
|---|---|---|
| `isBlockedHostname(hostname)` / `isBlockedIpAddress(ip)` | pure predicates: known local names, the suffixes `.local` `.internal` `.localhost`, private IPv4 ranges, IPv6 `::1` / `fe80:` / `fc…` / `fd…` | you already hold a hostname and only need the verdict |
| `assertPublicHttpUrl(rawUrl, { allowHttp })` | **first layer**: scheme plus literal hostname. `https` only in production, `http` tolerated in development. Raises `SsrfBlockedError`. Deliberately skips DNS | validation without a network call |
| `safeFetch(rawUrl, { timeoutMs, maxRedirects, allowHttp, headers })` | **the complete path**: validates, resolves DNS and refuses a host resolving to a private address, then follows redirects **manually, re-validating every hop** (3 by default), with an `AbortController` timeout. Returns the final `Response` and does not raise on 4xx/5xx | **any time the server actually fetches a user-chosen URL** |

Two properties worth knowing, because they are what make the module worth using instead of a hand-rolled
check:

- **It is fail-closed.** A hostname that fails to resolve is blocked, not allowed through.
- **It re-validates after every redirect.** This closes the case the first layer cannot see: a public
  domain that redirects to `127.0.0.1` or to a cloud metadata address.

### What to check

- A new `fetch()`, `axios`, `got` or equivalent call on an address that originates from user input,
  a database field filled by a user, or a webhook payload → it must be `safeFetch`. A bare `fetch` on a
  user-chosen URL is a finding, and a high one.
- A hand-written host check next to the call — a regex on `localhost`, an IP prefix comparison — is a
  finding even if it looks correct: it duplicates logic the project deliberately centralised, and it will
  drift.
- `SsrfBlockedError` is handled distinctly from a network error where the caller reports to the user.
  Collapsing the two turns a blocked internal probe into "the site is unreachable".
- `allowHttp` is not forced true. Its default already tolerates `http` outside production; passing it
  explicitly in a production path removes the transport guarantee.

**Consequence to state in the report:** the server can be made to issue requests to the internal
network from inside the VPS — including to itself and to any service reachable from it.

---

## PART 3 — SECRETS AND LOGS  [F03:SECRETS_AND_LOGS]

The project's crypto vocabulary is fixed, and it is the vocabulary to search for: **`ciphertext`,
`authTag`, `wrappedKey`, `ENCRYPTION_KEY`**. Where those appear, three rules hold.

### What to check

- **A secret is never logged.** Not the plaintext, not the ciphertext, not the authentication tag, not
  the wrapped key, not the encryption key — and not "just in the error path", which is the path that
  runs when something is already going wrong.
- **A secret never leaves in a response.** A credential returned to the frontend "so the UI can show
  it" bypasses the reveal permission: `vault.reveal` exists precisely so that reading a credential is a
  separate, auditable act from listing one → [F02:TRAP_BORROWED_PERMISSION].
- **A secret never lands in a fixture, a seed, a test file, or a comment.** The project has already had
  a password inside a session transcript once; treat that as evidence the failure mode is real, not
  theoretical.
- **Keys come from the environment, never from the repository.** A literal key, token, or connection
  string in the diff is a **red gate**: stop and report it immediately rather than folding it into the
  task's findings → [F04:WHEN_THE_GUARDIAN_STOPS].
- **`console.*` has no place in the sensitive modules.** In `server/modules/vault` and
  `server/modules/security/stepup` the console is banned outright, and the automated check enforces it
  → [F03:VAULT_HYGIENE].

---

## PART 4 — THE ONE TOOL YOU MAY RUN  [F03:VAULT_HYGIENE]

```
npm run security:vault-hygiene
```

Runs `scripts/security/vault-hygiene-check.mjs`. It is the only command in your toolbox beyond reading:
everything else you do is read-only.

**What it inspects.** Two directories — `server/modules/vault` and `server/modules/security/stepup` —
across `.ts .tsx .js .jsx .mjs .cjs`, looking for two things:

1. **any use of `console.log / info / debug / warn / error`** in those modules;
2. **structured log calls that mention a secret**: `log.info|warn|error|debug` on a line also containing
   `ciphertext`, `authTag`, `wrappedKey` or `ENCRYPTION_KEY`.

**How to use it.** Run it whenever the diff touches either directory, and quote its output in the report
rather than re-listing by hand what it already found.

⚠️ **Two limits to state honestly when you cite it**, so that a green result is not read as more than it
is:

- **It covers those two directories.** A secret logged from a module outside them is invisible to it —
  which is why PART 3 stays a manual read.
- **It matches patterns, not meaning.** A secret logged under a variable named differently passes it.

If the command is unavailable or blocked in your environment, apply the third brake of the company
plan: note it, work around it by reading, and if neither is possible park that piece rather than
retrying variants → [F00:OUTPUT_FORMAT].

---

## SOURCE_NOTES  [F03:SOURCE_NOTES]

**Traceability.** Compiled 24 August 2026 by direct reading of the `crmadv` sources at commit `3e3cb50`.
Tier 1 = the code or a written project rule · Tier 2 = generated artefact · Tier 3 = inference.

| Claim | Source | Tier | Confidence |
|---|---|---|---|
| Workspace filtering is *the* risk in multi-company | `archivio-documenti/piano-paperclip-2026-08-19.md` §2.2, Guardian's card | 1 | HIGH |
| `requireWorkspace` behaviour: headers, membership, `SUSPENDED`, platform-admin exemption | `server/guards/requireWorkspace.ts` read directly | 1 | HIGH |
| The guard establishes the workspace but does not filter queries | read from the guard's own code: it returns the workspace and performs no data filtering | 1 | HIGH |
| `net-guard.ts` centralises anti-SSRF and is reused by the PDF logo | header comment of `server/core/net-guard.ts` | 1 | HIGH |
| Blocked hostnames, suffixes and IP ranges | `LOCAL_HOSTNAMES`, `BLOCKED_HOSTNAME_SUFFIXES`, `isPrivateIpv4Address`, `isPrivateIpv6Address` | 1 | HIGH |
| `assertPublicHttpUrl` skips DNS; `safeFetch` resolves it and re-validates each redirect; default 3 redirects; fail-closed on unresolvable hosts | `server/core/net-guard.ts` read in full | 1 | HIGH |
| `safeFetch` returns 4xx/5xx to the caller instead of raising | its own contract comment and code | 1 | HIGH |
| Users of `safeFetch`: SEO scan, web-asset healthcheck | header comment of `net-guard.ts` | 1 | MEDIUM — asserted by the comment; the call sites were not opened |
| The crypto vocabulary `ciphertext` / `authTag` / `wrappedKey` / `ENCRYPTION_KEY` | `SENSITIVE_LOG_PATTERN` in `scripts/security/vault-hygiene-check.mjs` | 1 | HIGH |
| What `vault-hygiene` scans, and its two target directories | `scripts/security/vault-hygiene-check.mjs` read directly | 1 | HIGH |
| `npm run security:vault-hygiene` is the Guardian's only non-read tool | `package.json` + plan §2.2 | 1 | HIGH |
| A password once ended up in a session transcript | `piano-paperclip-2026-08-19.md` §12.5 | 1 | HIGH |

**VERIFY-ON-FIELD**

- The two directories scanned by `vault-hygiene` are hard-coded in the script. If sensitive code appears
  elsewhere, the script keeps passing: read the script's `TARGET_DIRECTORIES` before relying on a green
  result.
- Which call sites use `safeFetch` today was taken from a comment, not enumerated on the code. Confirm by
  searching for `safeFetch` before asserting that a given feature does route through it.
- Whether an equivalent guard exists for outbound calls made by the AI providers was not investigated
  here — **[NOT-FOUND]**. Do not derive a finding, a comparison, or a recommendation from this line.

---

End of document — [F03] · crm-permessi-e-sicurezza v1.0
