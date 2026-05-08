#!/bin/bash

INDEXER_URL="https://stps-indexer-production.up.railway.app"
SCORING_URL="https://stps-scoring-production.up.railway.app"
DRIFT="dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"

echo "=== 1. Health ==="
curl -s "$INDEXER_URL/health"
echo ""
curl -s "$SCORING_URL/health"
echo ""

echo "=== 2. Enviando evento de teste ==="
curl -s -X POST "$INDEXER_URL/webhook/governance" \
  -H "Content-Type: application/json" \
  -d "[{\"type\":\"GOVERNANCE\",\"description\":\"Squads multisig threshold changed from 3/5 to 2/5\",\"timestamp\":$(date +%s),\"feePayer\":\"FeePayer111111111111111111111111111111111\",\"signature\":\"test-$(date +%s)\",\"nativeTransfers\":[],\"tokenTransfers\":[],\"accountData\":[],\"instructions\":[{\"programId\":\"SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu\",\"accounts\":[\"$DRIFT\"],\"data\":\"\"}],\"events\":{}}]"
echo ""

echo "=== 3. Score atual do Drift ==="
curl -s "$SCORING_URL/api/score/$DRIFT"
echo ""
