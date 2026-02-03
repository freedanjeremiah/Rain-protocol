# Fix Move.toml in git deps: Pyth and Wormhole repos use Move.mainnet.toml; Sui Move expects Move.toml.
# Run this if "sui move build" fails with: Error parsing "...Move.toml": expected `.`, `=`
# Then run "sui move build --allow-dirty" from contracts/rain.

$moveDir = Join-Path (Join-Path $env:USERPROFILE ".move") "git"
if (-not (Test-Path $moveDir)) {
    Write-Host "No .move/git cache found at $moveDir"
    exit 1
}

$fixed = 0

# Pyth: target_chains/sui/contracts
Get-ChildItem -Path $moveDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*pyth*crosschain*" } | ForEach-Object {
    $contracts = Join-Path $_.FullName "target_chains\sui\contracts"
    $mainnet = Join-Path $contracts "Move.mainnet.toml"
    $toml = Join-Path $contracts "Move.toml"
    if (Test-Path $mainnet) {
        Copy-Item -Path $mainnet -Destination $toml -Force
        Write-Host "Copied Move.mainnet.toml -> Move.toml in $contracts"
        $fixed++
    }
}

# Wormhole: sui/wormhole
Get-ChildItem -Path $moveDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*wormhole*" } | ForEach-Object {
    $wormhole = Join-Path $_.FullName "sui\wormhole"
    $mainnet = Join-Path $wormhole "Move.mainnet.toml"
    $toml = Join-Path $wormhole "Move.toml"
    if (Test-Path $mainnet) {
        Copy-Item -Path $mainnet -Destination $toml -Force
        Write-Host "Copied Move.mainnet.toml -> Move.toml in $wormhole"
        $fixed++
    }
}

if ($fixed -gt 0) {
    Write-Host "Run: sui move build --allow-dirty"
    exit 0
}
Write-Host "No Move.mainnet.toml found. Run 'sui move build' once to fetch deps, then run this script again."
exit 1
