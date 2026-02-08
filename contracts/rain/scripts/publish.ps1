# Publish Rain package to Sui (testnet or mainnet).
# Saves package ID and shared object IDs to scripts/config/published.json.
# Testnet: Pyth/DeepBook/token revs match on-chain testnet packages. No bundling.
# Usage:
#   .\publish.ps1                    # testnet (default)
#   .\publish.ps1 -Env mainnet         # mainnet (when you have mainnet funds)
#   .\publish.ps1 -GasBudget 1000000000
#
# Prerequisites: sui CLI, path deps deepbook + token at ../../deepbookv3/packages.
# After publish: set frontend .env NEXT_PUBLIC_RAIN_PACKAGE_ID=<packageId from published.json>

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
    # Testnet: Pyth/Wormhole Move.toml are symlinks on Windows -> parse error. Fix cache dirs and retry.
    if ($Env -eq "testnet") {
        $fixScript = Join-Path $PSScriptRoot "fix_pyth_manifest.ps1"
        $maxBuildRetries = 4
        $buildOk = $false
        for ($r = 1; $r -le $maxBuildRetries; $r++) {
            $buildOut = cmd /c "sui move build --allow-dirty --environment testnet 2>&1"
            Write-Host $buildOut
            if ($LASTEXITCODE -eq 0) { $buildOk = $true; break }
            if (-not (Test-Path $fixScript)) { throw "Build failed (exit $LASTEXITCODE)." }
            Write-Host "Fixing Pyth/Wormhole Move.toml in cache (symlink -> real file), retry $r/$maxBuildRetries..."
            & $fixScript -Testnet -KeepPublishedAt 2>&1 | Out-Null
        }
        if (-not $buildOk) { throw "Build failed after $maxBuildRetries retries." }
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
    if ($Env -eq "testnet") {
        $args += "--with-unpublished-dependencies"
        Write-Host "Using --with-unpublished-dependencies (bundle Pyth/Wormhole if not on-chain)."
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
            $hint = "A dependency (Pyth/Wormhole) is not on-chain on $Env. Script bundles them with --with-unpublished-dependencies. If it still fails, try: (1) install latest Sui CLI from https://github.com/MystenLabs/sui/releases, (2) run .\publish.ps1 again, (3) get more testnet SUI from faucet if out of gas, (4) mainnet: .\publish.ps1 -Env mainnet"
        } elseif ($stdout -match "insufficient gas|out of gas|InsufficientFunds") {
            $hint = "Not enough SUI for gas. Get more testnet SUI from faucet, or try: .\publish.ps1 -GasBudget 400000000"
        }
        throw $hint
    }

    $json = $jsonStr | ConvertFrom-Json

    # Extract package ID and created objects (structure varies by Sui CLI version)
    $packageId = $null
    $txDigest = $null
    $lendingMarketplaceId = $null

    # V2 effects format (Sui CLI >= 1.65)
    if ($json.effects -and $json.effects.V2) {
        $v2 = $json.effects.V2
        $txDigest = $v2.transaction_digest
        # Find package and marketplace from changed_objects
        foreach ($c in $json.changed_objects) {
            if ($c.objectType -eq "package") {
                $packageId = $c.objectId
            }
            if ($c.objectType -match "LendingMarketplace") {
                $lendingMarketplaceId = $c.objectId
            }
        }
    }
    # Legacy formats
    else {
        if ($json.packageId) { $packageId = $json.packageId }
        elseif ($json.PackageID) { $packageId = $json.PackageID }
        elseif ($json.effects -and $json.effects.packageId) { $packageId = $json.effects.packageId }
        elseif ($json.result -and $json.result.packageId) { $packageId = $json.result.packageId }

        if ($json.digest) { $txDigest = $json.digest }
        elseif ($json.txDigest) { $txDigest = $json.txDigest }
        elseif ($json.effects -and $json.effects.transactionDigest) { $txDigest = $json.effects.transactionDigest }

        $created = @()
        if ($json.created) { $created = @($json.created) }
        elseif ($json.objectChanges) {
            $created = @($json.objectChanges | Where-Object { $_.type -eq "created" -or $_.objectType })
        }
        elseif ($json.effects -and $json.effects.created) { $created = @($json.effects.created) }

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
