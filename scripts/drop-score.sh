#!/bin/bash

INDEXER_URL="https://stps-indexer-production.up.railway.app"
SCORING_URL="https://stps-scoring-production.up.railway.app"
PROTOCOL="${1:-AhoAahJtkA5W1ECb51h7BbyP2p5YrmkAcH57fSWVGnGS}"

echo "=== Score inicial ==="
curl -s "$SCORING_URL/api/score/$PROTOCOL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Score: {d[\"currentScore\"]} | {d[\"riskLevel\"]} | flags: {d[\"activeFlags\"]}')"
echo ""

echo "=== Evento 1: TIMELOCK_CHANGED (-30 pts) ==="
curl -s -X POST "$INDEXER_URL/webhook/governance" \
  -H "Content-Type: application/json" \
  -d "[{\"type\":\"GOVERNANCE\",\"description\":\"Squads timelock removed set to zero\",\"timestamp\":$(date +%s),\"feePayer\":\"FeePayer111111111111111111111111111111111\",\"signature\":\"drop-timelock-$(date +%s)\",\"nativeTransfers\":[],\"tokenTransfers\":[],\"accountData\":[],\"instructions\":[{\"programId\":\"SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu\",\"accounts\":[\"$PROTOCOL\"],\"data\":\"\"}],\"events\":{}}]"
sleep 2

echo ""
echo "=== Evento 2: MULTISIG_THRESHOLD_CHANGED (-20 pts) ==="
curl -s -X POST "$INDEXER_URL/webhook/governance" \
  -H "Content-Type: application/json" \
  -d "[{\"type\":\"GOVERNANCE\",\"description\":\"Squads multisig threshold changed from 3/5 to 2/5 reduced lower\",\"timestamp\":$(date +%s),\"feePayer\":\"FeePayer111111111111111111111111111111111\",\"signature\":\"drop-threshold-$(date +%s)\",\"nativeTransfers\":[],\"tokenTransfers\":[],\"accountData\":[],\"instructions\":[{\"programId\":\"SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu\",\"accounts\":[\"$PROTOCOL\"],\"data\":\"\"}],\"events\":{}}]"
sleep 2

echo ""
echo "=== Evento 3: SIGNER_ADDED (-15 pts) ==="
curl -s -X POST "$INDEXER_URL/webhook/governance" \
  -H "Content-Type: application/json" \
  -d "[{\"type\":\"GOVERNANCE\",\"description\":\"Squads signer member added unknown\",\"timestamp\":$(date +%s),\"feePayer\":\"FeePayer111111111111111111111111111111111\",\"signature\":\"drop-signer-$(date +%s)\",\"nativeTransfers\":[],\"tokenTransfers\":[],\"accountData\":[],\"instructions\":[{\"programId\":\"SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu\",\"accounts\":[\"$PROTOCOL\"],\"data\":\"\"}],\"events\":{}}]"
sleep 3

echo ""
echo "=== Score final ==="
curl -s "$SCORING_URL/api/score/$PROTOCOL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Score: {d[\"currentScore\"]} | {d[\"riskLevel\"]} | flags: {d[\"activeFlags\"]}')"
echo ""
