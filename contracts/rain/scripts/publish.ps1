# Publish Rain package to Sui (testnet or mainnet).
# Saves package ID and shared object IDs to scripts/config/published.json.
# Default is testnet (no mainnet funds needed). Testnet uses --skip-dependency-verification so publish succeeds even if Pyth/Wormhole are not deployed on testnet.
# Usage:
#   .\publish.ps1                    # testnet (default)
#   .\publish.ps1 -Env mainnet        # mainnet (when you have mainnet funds)
#   .\publish.ps1 -GasBudget 1000000000
#
# Prerequisites:
#   - sui CLI installed and configured (sui client active-env, active-address)
#   - For path deps: deepbook + token at ../../deepbookv3/packages (see Move.toml)
#   - If Pyth/Wormhole git deps are dirty: use --allow-dirty (script does this)
#
# If you see "Failed to fetch package Pyth" (dependency not on target chain), try:
#   .\publish.ps1 -SkipDependencyVerification
# or publish to the network where Pyth is deployed (see config/README.md).
#
# After publish: set frontend .env with NEXT_PUBLIC_RAIN_PACKAGE_ID=<packageId from published.json>

param(
    [ValidateSet("testnet", "mainnet")]
    [string] $Env = "testnet",
    [string] $GasBudget = "800000000",
    [switch] $DryRun,
    [switch] $SkipDependencyVerification
)

$ErrorActionPreference = "Stop"
$PkgDir = $PSScriptRoot + "\.."   # contracts/rain
$ConfigDir = $PSScriptRoot + "\config"
$PublishedPath = Join-Path $ConfigDir "published.json"

Push-Location $PkgDir
try {
    # When publishing to testnet, force re-resolution and strip published-at so --with-unpublished-dependencies bundles Pyth/Wormhole.
    if ($Env -eq "testnet") {
        $lockPath = Join-Path $PkgDir "Move.lock"
        if (Test-Path $lockPath) {
            Remove-Item $lockPath -Force
            Write-Host "Removed Move.lock for testnet (force re-resolution)."
        }
        # Resolve deps so cache is populated (may create new cache dirs for Pyth/Wormhole).
        try { sui move build --allow-dirty --environment testnet 2>&1 | Out-Host } catch { }
        # Strip published-at in all Pyth/Wormhole cache dirs so CLI treats them as unpublished and bundles them.
        $fixScript = Join-Path $PSScriptRoot "fix_pyth_manifest.ps1"
        if (Test-Path $fixScript) {
            & $fixScript -Testnet 2>&1 | Out-Host
        }
    }

    $args = @(
        "client", "publish",
        ".",
        "--gas-budget", $GasBudget,
        "--allow-dirty",
        "--json",
        "-e", $Env
    )
    if ($DryRun) {
        $args += "--dry-run"
        Write-Host "Dry run: sui $($args -join ' ')"
    }
    # Testnet: bundle and publish Pyth/Wormhole in same tx (fixes PublishUpgradeMissingDependency).
    if ($Env -eq "testnet") {
        $args += "--with-unpublished-dependencies"
        # Use default gas (800M) so wallets with limited testnet SUI can publish; increase via -GasBudget if you hit out-of-gas.
        Write-Host "Using --with-unpublished-dependencies (publish Pyth/Wormhole in same tx)."
    }
    if ($SkipDependencyVerification -or $Env -eq "testnet") {
        $args += "--skip-dependency-verification"
        Write-Host "Using --skip-dependency-verification (deps not verified on-chain)."
    }

    Write-Host "Publishing Rain package to $Env ..."
    # Sui CLI writes version mismatch etc. to stderr; avoid PowerShell treating it as a terminating error
    $prevErrPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $raw = & sui $args 2>&1
    } finally {
        $ErrorActionPreference = $prevErrPref
    }
    $stdout = $raw -join "`n"

    # Sui may write warnings to stderr; JSON is usually last line or full stdout
    $jsonStr = $null
    if ($stdout -match '(?s)\{.*\}') {
        $jsonStr = $Matches[0]
    }
    if (-not $jsonStr) {
        Write-Host "Command output (no JSON found):"
        Write-Host $stdout
        $hint = "Run manually: sui client publish . --gas-budget $GasBudget --allow-dirty -e $Env"
        if ($stdout -match "Failed to fetch package Pyth|does not exist") {
            $hint = "Pyth package not on this network. Try: .\publish.ps1 -SkipDependencyVerification"
        }
        if ($stdout -match "PublishUpgradeMissingDependency") {
            $hint = "A dependency (Pyth/Wormhole) is not on-chain on $Env. Try: (1) install latest Sui CLI from https://github.com/MystenLabs/sui/releases to match server (Windows has no sui upgrade), (2) run .\publish.ps1 again, (3) use mainnet when you have funds: .\publish.ps1 -Env mainnet"
        }
        throw $hint
    }

    $json = $jsonStr | ConvertFrom-Json

    # Extract package ID and created objects (structure varies by Sui CLI version)
    $packageId = $null
    if ($json.packageId) { $packageId = $json.packageId }
    elseif ($json.PackageID) { $packageId = $json.PackageID }
    elseif ($json.effects -and $json.effects.packageId) { $packageId = $json.effects.packageId }
    elseif ($json.result -and $json.result.packageId) { $packageId = $json.result.packageId }

    $txDigest = $null
    if ($json.digest) { $txDigest = $json.digest }
    elseif ($json.txDigest) { $txDigest = $json.txDigest }
    elseif ($json.effects -and $json.effects.transactionDigest) { $txDigest = $json.effects.transactionDigest }

    $created = @()
    if ($json.created) { $created = @($json.created) }
    elseif ($json.objectChanges) {
        $created = @($json.objectChanges | Where-Object { $_.type -eq "created" -or $_.objectType })
    }
    elseif ($json.effects -and $json.effects.created) { $created = @($json.effects.created) }
    elseif ($json.effects -and $json.effects.objectChanges) {
        $created = @($json.effects.objectChanges | Where-Object { $_.type -eq "created" })
    }

    $lendingMarketplaceId = $null
    foreach ($c in $created) {
        $objId = $c.objectId
        if (-not $objId -and $c.reference) { $objId = $c.reference.objectId }
        if (-not $objId -and $c.objectRef) { $objId = $c.objectRef.objectId }
        $objType = $c.objectType
        if (-not $objType) { $objType = $c.type }
        if (-not $objType) { $objType = "" }
        if ($objType -match "LendingMarketplace" -or $objType -match "marketplace::LendingMarketplace") {
            $lendingMarketplaceId = $objId
            break
        }
    }

    $published = @{
        network         = $Env
        packageId        = if ($packageId) { $packageId } else { "0x0" }
        lendingMarketplaceId = $lendingMarketplaceId
        txDigest         = $txDigest
        publishedAt      = (Get-Date -Format "o")
    }

    $published | ConvertTo-Json -Depth 5 | Set-Content -Path $PublishedPath -Encoding UTF8
    Write-Host "Wrote $PublishedPath"
    Write-Host "  packageId: $($published.packageId)"
    Write-Host "  lendingMarketplaceId: $($published.lendingMarketplaceId)"
    Write-Host "  txDigest: $($published.txDigest)"
    Write-Host ""
    Write-Host "Set frontend .env: NEXT_PUBLIC_RAIN_PACKAGE_ID=$($published.packageId)"
}
finally {
    Pop-Location
}
