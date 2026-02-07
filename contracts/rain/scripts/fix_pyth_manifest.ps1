# Fix Move.toml in git deps: Pyth and Wormhole use Move.mainnet.toml or Move.testnet.toml; Sui Move expects Move.toml.
# Run this if "sui move build" fails with: Error parsing "...Move.toml": expected `.`, `=`
# Use -Testnet when publishing to testnet. Also strips published-at so --with-unpublished-dependencies bundles Pyth/Wormhole in the same tx (fixes PublishUpgradeMissingDependency).
# Then run "sui move build --allow-dirty" from contracts/rain.

param([switch] $Testnet)

$moveDir = Join-Path (Join-Path $env:USERPROFILE ".move") "git"
if (-not (Test-Path $moveDir)) {
    Write-Host "No .move/git cache found at $moveDir"
    exit 1
}

$fixed = 0

# Pyth: target_chains/sui/contracts
# Known-good Wormhole testnet rev (from Rain Move.lock); Pyth's Move.testnet.toml sometimes references "sui-upgrade-testnet" which doesn't exist.
$wormholeTestnetRev = "b71be5cbb9537c4aac8e23e74371affa3825efcd"
Get-ChildItem -Path $moveDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*pyth*crosschain*" } | ForEach-Object {
    $contracts = Join-Path $_.FullName "target_chains\sui\contracts"
    $toml = Join-Path $contracts "Move.toml"
    if ($Testnet) {
        $src = Join-Path $contracts "Move.testnet.toml"
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $toml -Force
            $content = Get-Content $toml -Raw
            # Patch Wormhole rev so resolver can find it (sui-upgrade-testnet often missing).
            $content = $content -replace 'rev\s*=\s*"sui-upgrade-testnet"', "rev = `"$wormholeTestnetRev`""
            # Remove published-at so CLI treats Pyth as unpublished and bundles it with --with-unpublished-dependencies.
            $content = $content -replace '(?m)^published-at\s*=\s*"[^"]+"\s*\r?\n', ''
            Set-Content $toml $content -NoNewline
            Write-Host "Copied Move.testnet.toml -> Move.toml in $contracts (testnet, published-at removed for bundle)"
            $fixed++
        }
    } else {
        $mainnet = Join-Path $contracts "Move.mainnet.toml"
        if (Test-Path $mainnet) {
            Copy-Item -Path $mainnet -Destination $toml -Force
            Write-Host "Copied Move.mainnet.toml -> Move.toml in $contracts"
            $fixed++
        }
    }
}

# Wormhole: sui/wormhole
Get-ChildItem -Path $moveDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*wormhole*" } | ForEach-Object {
    $wormhole = Join-Path $_.FullName "sui\wormhole"
    $toml = Join-Path $wormhole "Move.toml"
    if ($Testnet) {
        $src = Join-Path $wormhole "Move.testnet.toml"
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $toml -Force
            # Remove published-at so CLI bundles Wormhole with --with-unpublished-dependencies.
            (Get-Content $toml -Raw) -replace '(?m)^published-at\s*=\s*"[^"]+"\s*\r?\n', '' | Set-Content $toml -NoNewline
            Write-Host "Copied Move.testnet.toml -> Move.toml in $wormhole (testnet, published-at removed for bundle)"
            $fixed++
        }
    } else {
        $mainnet = Join-Path $wormhole "Move.mainnet.toml"
        if (Test-Path $mainnet) {
            Copy-Item -Path $mainnet -Destination $toml -Force
            Write-Host "Copied Move.mainnet.toml -> Move.toml in $wormhole"
            $fixed++
        }
    }
}

if ($fixed -gt 0) {
    Write-Host "Run: sui move build --allow-dirty"
    exit 0
}
if ($Testnet) {
    Write-Host "No Move.testnet.toml found in Pyth/Wormhole cache. Run 'sui move build' once (with testnet), then try again. Or run: sui move update-deps --environment testnet --allow-dirty"
} else {
    Write-Host "No Move.mainnet.toml found. Run 'sui move build' once to fetch deps, then run this script again."
}
exit 1
