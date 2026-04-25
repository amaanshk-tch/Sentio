# Sentio — Stellar Risk Intelligence Platform

[![CI/CD Pipeline](https://github.com/amaanshk-tch/Sentio/actions/workflows/ci.yml/badge.svg)](https://github.com/amaanshk-tch/Sentio/actions)

Sentio is a real-time risk intelligence tool built on top of the Stellar network. You paste in any Stellar account address, asset, or Soroban smart contract ID, and Sentio tells you whether it's safe or not.

---

## What It Does

- **Account scan** — Analyzes any Stellar account (G...) on testnet and mainnet for age, transaction velocity, bot patterns, domain verification, counterparty trust, trustline quality, token concentration, DEX exposure, claimable balances, and Soroban invocation history.

- **Asset scan** — Analyzes any asset (e.g. `USDC:GXXXXXX`) on testnet and mainnet for supply characteristics, issuer domain verification, and trustline quality signals.

- **Contract scan** — Analyzes any Soroban smart contract (C...) on testnet and mainnet for deployment age, invocation count, deployer trust.

- **On-chain verdicts** — Every scan result can be written to a Soroban smart contract on the Stellar network, creating an auditable, immutable history of risk scores per address.
  This can be done with admin rights which are currently centralized for testing(happy to share to test).

- **Live monitoring** — After an account scan, a WebSocket connection subscribes to Horizon's SSE stream(for 5 minutes).

- **Search history** — Connected Freighter wallets get persistent search history stored in MySQL and surfaced in the UI.

---

## Tech Stack

| Layer          | Technology                                               |
| -------------- | -------------------------------------------------------- |
| Frontend       | React, TypeScript, Vite, Tailwind CSS, Framer Motion     |
| UI Primitives  | Radix UI, Lucide React                                   |
| Backend        | Node.js (ESM), Express 4                                 |
| WebSockets     | `ws` library, Horizon SSE stream                         |
| Database       | MySQL via `mysql2`                                       |
| Blockchain     | Stellar Horizon REST API, Soroban RPC                    |
| Wallet         | Freighter browser extension via `@stellar/freighter-api` |
| Smart Contract | Rust, Soroban SDK                                        |
| Security       | Helmet, CORS, express-rate-limit, Bearer token auth      |
| Build / Dev    | Vite, concurrently, ESLint, Vitest                       |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        Browser                           │
│                                                          │
│  React App (Vite/TypeScript)                             │
│  ├── Landing page  ──── REST /api/scan ──────────────┐   │
│  ├── Admin page     ──── REST /api/registry ────────┐|   │
│  └── Explorer page                                  ||   │
│                          WebSocket /ws ──────────┐  │|   │
└──────────────────────────────────────────────────│──│|───┘
                                                   │  │|
┌──────────────────────────────────────────────────│──│|───┐
│                    Express Server (Node.js)         ││   │
│                                                     ││   │
│  ┌─────────────┐   ┌──────────────┐   ┌────────┐ │  ││   │
│  │  scan.js    │   │ registryApi  │   │ users  │ │  ││   │
│  │  contract.js│   │    .js       │   │  .js   │ │  ││   │
│  └──────┬──────┘   └──────┬───────┘   └───┬────┘ │  ││   │
│         │                 │               │      │  ││   │
│  ┌──────▼──────┐   ┌──────▼───────┐   ┌───▼────┐ │  ││   │
│  │ riskEngine  │   │  soroban/    │   │ MySQL  │ │  ││   │
│  │    .js      │   │ registry.js  │   │   DB   │◄┘  ││   │
│  └──────┬──────┘   └──────┬───────┘   └────────┘    ││   │
│         │                 │                         ││   │
│  ┌──────▼──────┐   ┌──────▼───────┐                 ││   │
│  │ ws/stream.js│◄──│ Horizon SSE  │                 ││   │
│  └─────────────┘   └──────────────┘◄────────────────┘│   │
│                                                      │   │
└──────────────────────────────────────────────────────|───│
                                                       |   │
┌──────────────────────────────────────────────────────|───│─┐
│                  External Services                       │ │
│                                                          ▼ │
│  Stellar Horizon REST API                                  │
│  Soroban RPC               ←──── contract events, ledger   │
│  Stellar Expert API        ←──── contract metadata         │
│  stellar.toml / home_domain ←── domain verification        │
│  Soroban Smart Contract    ←──── Risk Registry (on-chain)  │
└────────────────────────────────────────────────────────────┘
```

### How a scan flow works end-to-end

1. User pastes an address into the Explorer and hits search.
2. The React app sends `POST /api/scan/()` to the Express server.
3. The server checks its in-memory LRU cache. If a fresh result exists, it returns immediately.
4. Otherwise it fires a batch of parallel requests to Horizon: account metadata, recent transactions (30-day window), operations, DEX offers, claimable balances, and counterparty stellar.toml lookups.
5. The risk engine processes all signals and produces a 0–100 score with a full breakdown.
6. The server optionally writes the verdict to the Soroban Risk Registry contract (rate-limited to once per 10 minutes per address to avoid XLM drain).
7. The result — score, breakdown, confidence, on-chain history — is returned to the browser (scoring rules are mentioned in account and asset scoring section in detail).
8. The browser opens a WebSocket. The server subscribes to Horizon's SSE stream for that account and re-runs the full scan whenever a new transaction arrives, pushing the updated score back over the socket in real time.

---

## Getting Started

### Prerequisites

- **Node.js** v20 or higher
- **npm** v10 or higher
- **Freighter** browser extension (for wallet-connected features)
- **Rust + Stellar CLI** (only if you want to compile or redeploy the smart contract)

### Installation

- **Note**: Search History wont work locally, you can check it out on the demo link.

```bash
git clone https://github.com/your-org/sentio.git
cd sentio
npm install
```

---

### Account & Asset Scoring

| **Account Age** | 15 pts | < 7 days: 15 pts. < 30 days: 8 pts. New accounts are the primary phishing vector. |
| **Transaction Velocity** | 20 pts | > 10 tx/hour in any rolling window triggers burst flag. |
| **Bot / Spam Detection** | 20 pts | Repeated identical memos across multiple transactions. Combined with burst activity → bot_spam classification. Each flagged tx adds 2 pts, capped at 20.
| **Domain Verification** | 15 pts | Fetches /.well-known/stellar.toml from the account's `home_domain`. Unverified = penalty. Listed in TOML = trust bonus.  
| **Counterparty Network** | 20 pts | Last 50 operations mapped to unique counterparties. Up to 5 cross-checked for their own stellar.toml. Unverified counterparties: 4 pts each, capped at 20.
| **Trustline Quality** | 20 pts | Lookalike detection (e.g. USDCX mimicking USDC). Low-quality trustlines stack with token concentration for an interaction penalty.  
| **Token Concentration** | 10 pts | One token > 70% of non-native balance. Stacks with low trustline quality for an additional 8 pts.  
| **DEX Exposure** | 8 pts | > 10 open DEX offers.  
| **Claimable Balances** | 10 pts | ≥ 8 claims suggests airdrop farming.  
| **Soroban Invocations** | 12 pts | > 10 contract invocations in recent history.

### Contract Scoring

Contract scoring starts at 100 and applies deductions and bonuses based on on-chain evidence gathered from both Soroban RPC and the Stellar Expert API.

| Signal                                | Impact   |
| ------------------------------------- | -------- |
| Deployed today                        | −30      |
| Deployed < 7 days ago                 | −22      |
| Deployed < 30 days ago                | −10      |
| Zero invocations                      | −20      |
| < 5 invocations                       | −12      |
| > 100 invocations                     | +8 bonus |
| Deployer has no verified stellar.toml | −15      |
| Deployer account < 30 days old        | −10      |
| Zero unique callers                   | −8       |
| < 3 unique callers                    | −12      |
| > 20 unique callers                   | +5 bonus |
| Single account > 80% of all calls     | −8       |
| Burst of 10+ events in 100 ledgers    | −10      |
| Admin / upgrade events detected       | −15      |
| Unknown contract type                 | −5       |
| Classified contract type              | +3       |

### Score Bands

| Range    | Classification  | Meaning                                                                                              |
| -------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| 0 – 29   | **Low Risk**    | Healthy signals. No significant red flags. Proceed normally, but continue to monitor.                |
| 30 – 69  | **Medium Risk** | Mixed signals. Verify the issuer domain and stellar.toml before sending funds or opening trustlines. |
| 70 – 100 | **High Risk**   | Multiple elevated risk indicators. Do not interact without independent verification.                 |

---

## On-Chain Registry

### Smart Contract Overview

The Risk Registry is a Soroban smart contract written in Rust. It stores risk data on blockchain.

**Admin functions (require admin auth and registred defined account address):**

- The Admin page (`/admin`) is a protected interface for managing the on-chain Risk Registry. It requires two things to unlock:

1. **Admin token**
2. **Admin wallet**

- `set_risk(addr, score, confidence, category)` — Write or update a risk verdict.
- `flag(addr, reason, severity)` — Append a manual flag to an address.
- `clear_flags(addr)` — Remove all flags for an address.
- `remove_risk(addr)` — Remove risk data and history for an address.
- `propose_admin(new_admin)` — Begin a two-step admin transfer(not available in Ui).
- `accept_admin()` — New admin accepts the transfer(not available in Ui).

All write operations produce a transaction that must be signed by the connected Freighter wallet.

---

#### WebSocket

The normal way browsers get data is by asking for it — you make a request, the server responds, the connection closes. That works fine for a one-time scan result. But Stellar accounts receive new transactions at unpredictable times, and showing a stale risk score after something changes defeats the purpose of the tool.

#### Connection Timeout — 5 Minutes

```
STREAM_TTL_MS = 5 * 60 * 1000  // 5 minutes
```

If no new transactions arrive on the watched account for **5 minutes**, the server automatically closes the Horizon SSE stream and sends a `stream_stopped` message to the browser:
The browser receives this, sets the stream status to `stopped`, and the UI switches from the pulsing green **Live Monitoring** dot to **Stream Offline**. The scan results remain fully visible — nothing disappears. Live monitoring simply pauses until the user searches again, which reopens the stream from scratch.
This timeout exists to prevent idle connections from holding open Horizon SSE streams indefinitely and consuming server resources for accounts that have gone quiet.

---

### Caching Strategy

The server uses a custom in-memory LRU cache (`server/utils/cache.js`) with a hard byte budget (50MB). Cache entries expire after a fixed TTL. When the byte budget is exceeded, the oldest entries are evicted first.
The cache intentionally lives in process memory — there is no Redis dependency for the cache layer. This keeps the deployment simple, with the tradeoff that cache is lost on process restart and is not shared across multiple server instances.

### Security Model

- **CORS** — For prod.
- **Rate limiting** — Per-bucket limits (scan: 30/min, registry reads: 60/min, admin writes: 5/min) enforced by `express-rate-limit`.
- **Admin token** — All admin routes require a `Bearer` token that must match `SENTIO_ADMIN_TOKEN`. The token is never exposed to the frontend.
- **Wallet verification** — Admin writes additionally require the connected Freighter wallet to match `SENTIO_ADMIN_ADDRESS`, enforced by the Soroban contract's `require_auth()`.
- **WebSocket** — Origin-checked at connection time. Per-IP connection limits (5). Per-client message rate limits (4/second). Streams auto-close after 5-minute idle TTL.
- \*\*Input vali

---

## Known Limitations

- **Testnet only for contract writes** — On-chain registry writes currently default to testnet. Mainnet contract writes require `RISK_REGISTRY_MAINNET_CONTRACT_ID` to be set and the admin wallet to hold mainnet XLM for fees.
- **Freighter required** — The Explorer requires a connected Freighter wallet. The landing page and scan results are not accessable without one, but searching is gated. This is intentional to associate searches with wallets for history and this is only a temperory feature for testing which will later be removed.

---

Risk scores are probabilistic signals, not guarantees. Always verify independently before sending funds to an unknown address.

