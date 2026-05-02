$scripts = @(
  "test-squads-threshold.ps1",
  "test-squads-timelock.ps1",
  "test-squads-signer-added.ps1",
  "test-squads-signer-removed.ps1",
  "test-squads-emergency.ps1",
  "test-spl-governance-timelock.ps1",
  "test-nonce-created.ps1",
  "test-nonce-advanced.ps1"
)

foreach ($script in $scripts) {
  Write-Host "Running $script"
  & "$PSScriptRoot\$script"
}
