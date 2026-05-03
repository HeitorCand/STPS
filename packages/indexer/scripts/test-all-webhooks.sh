#!/usr/bin/env bash
#
# Equivalente bash de test-all-webhooks.ps1 para macOS / Linux.
# Envia todos os eventos manuais para o Indexer rodando em http://localhost:3000.
#
# Pré-requisito: Indexer rodando em :3000 e Scoring Engine em :3001.

set -euo pipefail

INDEXER_URL="${INDEXER_URL:-http://localhost:3000}"
PROTOCOL_ADDRESS="${PROTOCOL_ADDRESS:-dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH}"
SQUADS_PROGRAM_ID="SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu"
SPL_GOV_PROGRAM_ID="GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
SYSTEM_PROGRAM_ID="11111111111111111111111111111111"

send_webhook() {
  local description="$1"
  local program_id="$2"
  local data="$3"
  local signature="$4"

  printf -v body '{
    "accountData":[{"account":"%s","nativeBalanceChange":0}],
    "description":"%s",
    "events":{},
    "fee":5000,
    "feePayer":"FeePayer111111111111111111111111111111111",
    "instructions":[{"accounts":["%s"],"data":"%s","innerInstructions":[],"programId":"%s"}],
    "signature":"%s",
    "timestamp":1711540000,
    "type":"GOVERNANCE"
  }' "$PROTOCOL_ADDRESS" "$description" "$PROTOCOL_ADDRESS" "$data" "$program_id" "$signature"

  echo "→ $signature"
  curl -s -X POST "$INDEXER_URL/webhook/governance" \
    -H "Content-Type: application/json" \
    -d "$body"
  echo ""
}

send_webhook "Squads multisig threshold changed from 3/5 to 2/5" "$SQUADS_PROGRAM_ID" "threshold-change" "manual-squads-threshold"
send_webhook "Squads timelock changed to 0" "$SQUADS_PROGRAM_ID" "timelock-removed" "manual-squads-timelock"
send_webhook "Squads signer added" "$SQUADS_PROGRAM_ID" "signer-add" "manual-squads-signer-added"
send_webhook "Squads signer removed" "$SQUADS_PROGRAM_ID" "signer-remove" "manual-squads-signer-removed"
send_webhook "Squads emergency key used to bypass timelock" "$SQUADS_PROGRAM_ID" "emergency" "manual-squads-emergency"
send_webhook "SPL Governance timelock changed to 0" "$SPL_GOV_PROGRAM_ID" "timelock-zero" "manual-spl-governance-timelock"
send_webhook "Initialize nonce account" "$SYSTEM_PROGRAM_ID" "nonceInitialize" "manual-nonce-created"
send_webhook "Advance nonce account" "$SYSTEM_PROGRAM_ID" "nonceAdvance" "manual-nonce-advanced"

echo "=== done ==="
