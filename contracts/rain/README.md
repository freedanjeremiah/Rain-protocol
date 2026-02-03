# Rain Move Package

Non-custodial P2P orderbook lending protocol on Sui. See repo root [readme.md](../../readme.md).

## Layout

- `Move.toml` – deps: local `deepbookv3`, `token`; git `Pyth`, `Wormhole`, `Sui` (override) for oracle.
- `sources/rain.move` – placeholder.
- `sources/oracle_adapter.move` – Phase 1.1: wraps Pyth (same API as [deepbook-amm vault](https://github.com/...)); returns (price, expo) for a price feed; no custody.

## Build & test

```bash
cd contracts/rain
sui move build
sui move test
```

If build fails with **"Error parsing ... Move.toml: expected `.`, `=`"** (Pyth and Wormhole use `Move.mainnet.toml`), run the fix script then build again:

```powershell
./scripts/fix_pyth_manifest.ps1
sui move build --allow-dirty
```

Use `--skip-fetch-latest-git-deps` if dependencies haven’t changed.
