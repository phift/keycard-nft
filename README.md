# PSK26 Tap Mint

Tap-to-mint ERC-721 giveaway for Parallel Society x Keycard 2026.

## Structure
- `contracts/` Hardhat project for `PSK26TapNFT` (Status Network Testnet)
- `relayer/` Vercel serverless API (mints on behalf of users)
- `site/` Static Vite site for GitHub Pages

## Contracts (Status Network Testnet)
Requires Node.js 20 LTS (Hardhat does not support Node 25).
1) Install deps:
```
cd contracts
npm install
```
2) Create `contracts/.env`:
```
STATUS_RPC_URL=https://public.sepolia.rpc.status.network
DEPLOYER_PRIVATE_KEY=<private-key>
TOKEN_URI=https://phift.github.io/keycard-nft/metadata.json
```
3) Deploy:
```
npm run deploy:status
```
4) (Optional) Update token URI:
```
CONTRACT_ADDRESS=<deployed-address>
TOKEN_URI=https://phift.github.io/keycard-nft/metadata.json
npm run set-uri:status
```

## Relayer (Vercel)
1) Create a Vercel project rooted at `relayer/`.
2) Configure env vars (see `relayer/.env.example`). Required:
- `STATUS_RPC_URL`, `STATUS_CHAIN_ID`, `CONTRACT_ADDRESS`, `RELAYER_PRIVATE_KEY`, `TAP_KEY`
- `MAINNET_RPC_URL` (for ENS resolution)
3) Deploy. Note the Vercel URL, e.g. `https://your-relayer.vercel.app`.

Optional: attach a KV store (Vercel KV / Upstash) so rate limits and requestId caching persist across serverless instances.

The relayer enforces a TAP_KEY gate and rate limits by IP. The contract enforces **max 3 mints per recipient address** (lifetime).

## Site (GitHub Pages)
1) Update `site/public/config.json` with:
- `apiBaseUrl`: your Vercel relayer URL
- `contractAddress`: deployed contract address
2) Install + build:
```
cd site
npm install
npm run build
```
3) Deploy to GitHub Pages (workflow in `.github/workflows/pages.yml`).

## NFC Tag
Program the tag with:
```
https://phift.github.io/keycard-nft/?k=<TAP_KEY>
```

## Local mint memory
The site stores a local "already minted" record per device/browser in localStorage. Use the subtle "Reset (advanced)" link to clear it.
