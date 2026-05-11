#!/bin/bash

INDEXER_URL="https://stps-indexer-production.up.railway.app"
SCORING_URL="https://stps-scoring-production.up.railway.app"
SQUADS="SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu"

# Protocolos de teste com perfis de risco diferentes
PROTO_LOW="Safe1111111111111111111111111111111111111111"
PROTO_MEDIUM="Medi1111111111111111111111111111111111111111"
PROTO_HIGH="High1111111111111111111111111111111111111111"
PROTO_CRITICAL="Crit1111111111111111111111111111111111111111"

send_event() {
  local protocol=$1
  local description=$2
  local sig="seed-$(date +%s%N)"
  curl -s -X POST "$INDEXER_URL/webhook/governance" \
    -H "Content-Type: application/json" \
    -d "[{\"type\":\"GOVERNANCE\",\"description\":\"$description\",\"timestamp\":$(date +%s),\"feePayer\":\"FeePayer111111111111111111111111111111111\",\"signature\":\"$sig\",\"nativeTransfers\":[],\"tokenTransfers\":[],\"accountData\":[],\"instructions\":[{\"programId\":\"$SQUADS\",\"accounts\":[\"$protocol\"],\"data\":\"\"}],\"events\":{}}]" > /dev/null
  sleep 2
}

register() {
  local protocol=$1
  local label=$2
  echo -n "  Registrando $label... "
  local result=$(curl -s -X POST "$SCORING_URL/api/protocols/register" \
    -H "Content-Type: application/json" \
    -d "{\"protocolAddress\": \"$protocol\"}")
  echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'score={d.get(\"initialScore\", d.get(\"protocol\",{}).get(\"currentScore\",\"?\"))} ✅')" 2>/dev/null || echo "já registrado"
}

show_score() {
  local protocol=$1
  local label=$2
  local result=$(curl -s "$SCORING_URL/api/score/$protocol")
  echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  {\"$label\":<20} score={d[\"currentScore\"]:>3} | {d[\"riskLevel\"]:<8} | flags: {len(d[\"activeFlags\"])}')" 2>/dev/null
}

echo "============================================"
echo " STPS — Seed de Protocolos"
echo "============================================"
echo ""

# ── REGISTRAR ────────────────────────────────
echo "[ 1/5 ] Registrando protocolos..."
register "$PROTO_LOW"      "SafeProtocol"
register "$PROTO_MEDIUM"   "MediumProtocol"
register "$PROTO_HIGH"     "HighProtocol"
register "$PROTO_CRITICAL" "CriticalProtocol"
echo ""

# ── LOW — nenhum evento ───────────────────────
echo "[ 2/5 ] SafeProtocol → Low (sem eventos)"
echo "  Nenhuma ação necessária."
echo ""

# ── MEDIUM — threshold ────────────────────────
echo "[ 3/5 ] MediumProtocol → Medium"
echo -n "  Evento: threshold changed... "
send_event "$PROTO_MEDIUM" "Squads multisig threshold changed from 3/5 to 2/5 reduced lower"
echo "enviado"
echo ""

# ── HIGH — threshold + signer ─────────────────
echo "[ 4/5 ] HighProtocol → High"
echo -n "  Evento: threshold changed... "
send_event "$PROTO_HIGH" "Squads multisig threshold changed from 3/5 to 2/5 reduced lower"
echo "enviado"
echo -n "  Evento: signer added... "
send_event "$PROTO_HIGH" "Squads signer member added unknown"
echo "enviado"
echo ""

# ── CRITICAL — timelock + threshold + signer + emergency ──
echo "[ 5/5 ] CriticalProtocol → Critical"
echo -n "  Evento: timelock removed... "
send_event "$PROTO_CRITICAL" "Squads timelock removed set to zero"
echo "enviado"
echo -n "  Evento: threshold changed... "
send_event "$PROTO_CRITICAL" "Squads multisig threshold changed from 3/5 to 2/5 reduced lower"
echo "enviado"
echo -n "  Evento: signer added... "
send_event "$PROTO_CRITICAL" "Squads signer member added unknown"
echo "enviado"
echo -n "  Evento: emergency key used... "
send_event "$PROTO_CRITICAL" "Squads emergency key used bypass executed"
echo "enviado"
echo ""

# ── RESULTADO ─────────────────────────────────
echo "============================================"
echo " Resultado final"
echo "============================================"
show_score "$PROTO_LOW"      "SafeProtocol"
show_score "$PROTO_MEDIUM"   "MediumProtocol"
show_score "$PROTO_HIGH"     "HighProtocol"
show_score "$PROTO_CRITICAL" "CriticalProtocol"
echo ""
