# Rain Move Package

Non-custodial P2P orderbook lending protocol on Sui. See repo root [readme.md](../../readme.md).

## Layout

- `Move.toml` – package manifest; deps on local `deepbookv3` and `token`. Pyth is commented out (add when implementing `oracle_adapter`).
- `sources/rain.move` – placeholder module; add `oracle_adapter`, `adjudicator`, `custody`, `vault`, etc. per the implementation guide.

## Build & test

```bash
cd contracts/rain
sui move build
sui move test
```

Use `--skip-fetch-latest-git-deps` if dependencies haven’t changed.

## Adding Pyth

When implementing the oracle adapter, uncomment and fix the Pyth dependency in `Move.toml`. The Pyth Sui contracts repo may use a different manifest name; you may need the correct `subdir` or a published Pyth package ID for mainnet.
