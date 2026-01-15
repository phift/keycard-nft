# Repository Guidelines

## Project Structure & Module Organization
- `contracts/`: Hardhat project for `PSK26TapNFT` (`src/`, `scripts/`, `test/`)
- `site/`: Vite + React static site (GitHub Pages)
- `relayer/`: Vercel serverless API (`api/` endpoints)
- `site/public/`: hosted assets (`metadata.json`, `nft.svg`, `config.json`)

## Build, Test, and Development Commands
- `cd contracts && npm run build`: compile contracts
- `cd contracts && npm test`: run contract tests
- `cd contracts && npm run deploy:status`: deploy to Status Network Testnet
- `cd site && npm run dev`: run local UI
- `cd site && npm run build`: build static site for GitHub Pages

## Coding Style & Naming Conventions
- Indentation: 2 spaces for JS/TS/Solidity.
- Naming:
  - Contracts: `PascalCase.sol` (e.g., `PSK26TapNFT.sol`)
  - Scripts: `kebab-case.ts` (e.g., `deploy.ts`, `set-token-uri.ts`)
  - Tests: `*.test.ts` (Hardhat)
- Keep public contract functions documented when adding new ones.

## Testing Guidelines
- Contract tests live in `contracts/test` and cover minting, access control, and paused state.
- Prefer deterministic tests and minimal external dependencies.

## Commit & Pull Request Guidelines
- Git history is empty; use Conventional Commits going forward: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- PRs: include a short summary, how you validated (commands run), and screenshots for UI changes; link an issue/ticket when available.

## Security & Configuration Tips
- Never commit secrets (private keys, TAP_KEY, RPC URLs). Use `.env` locally and keep `.env.example` updated.
- The relayer enforces a TAP_KEY gate and a max mint count per address; keep those limits explicit in code.

## Agent-Specific Instructions (Optional)
- Keep changes small and focused; update/add tests with behavior changes; avoid adding new dependencies without discussion.
