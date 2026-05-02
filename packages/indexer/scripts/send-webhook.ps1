param(
  [Parameter(Mandatory = $true)]
  [string] $Description,

  [Parameter(Mandatory = $true)]
  [string] $ProgramId,

  [Parameter(Mandatory = $true)]
  [string] $Data,

  [Parameter(Mandatory = $true)]
  [string] $Signature,

  [string] $Type = "GOVERNANCE",
  [string] $ProtocolAddress = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
  [int] $Timestamp = 1711540000
)

$body = @{
  accountData = @(
    @{
      account = $ProtocolAddress
      nativeBalanceChange = 0
    }
  )
  description = $Description
  events = @{}
  fee = 5000
  feePayer = "FeePayer111111111111111111111111111111111"
  instructions = @(
    @{
      accounts = @($ProtocolAddress)
      data = $Data
      innerInstructions = @()
      programId = $ProgramId
    }
  )
  signature = $Signature
  timestamp = $Timestamp
  type = $Type
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Uri "http://localhost:3000/webhook/governance" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body

