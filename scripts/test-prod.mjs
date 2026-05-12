#!/usr/bin/env node
/**
 * STPS — Production End-to-End Test Suite
 *
 * Uso:
 *   node scripts/test-prod.mjs [--verbose]
 *
 * Env opcionais:
 *   INDEXER_URL    — default: https://stps-indexer-production.up.railway.app
 *   SCORING_URL    — default: https://stps-scoring-production.up.railway.app
 *   WEBHOOK_SECRET — secret HELIUS_WEBHOOK_SECRET configurado no Railway
 */

const INDEXER_URL    = process.env.INDEXER_URL  ?? "https://stps-indexer-production.up.railway.app";
const SCORING_URL    = process.env.SCORING_URL  ?? "https://stps-scoring-production.up.railway.app";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";
const VERBOSE        = process.argv.includes("--verbose");

const TEST_PROTOCOL  = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"; // drift (já existe em prod)
const FRESH_PROTOCOL = "45wDcq2AXjU8R3mWDxogPToBSxN4a2Yfk17uxGFGuq4u"; // score = 85, sem flags

let passed = 0, failed = 0;
const failures = [];

// ── helpers ──────────────────────────────────────────────────────────────────

function pass(name) { passed++; console.log(`  ✅  ${name}`); }
function fail(name, detail) {
  failed++;
  failures.push({ name, detail });
  console.log(`  ❌  ${name}`);
  if (VERBOSE && detail) console.log(`       ${detail}`);
}

async function GET(url, headers = {}) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, headers: r.headers };
}

async function POST(url, payload, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, headers: r.headers };
}

function heliusPayload(description, protocol = TEST_PROTOCOL, programId = "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu") {
  return {
    signature: `testsig_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Math.floor(Date.now() / 1000),
    type: "GOVERNANCE",
    description,
    feePayer: "FeePayer111111111111111111111111111111111111",
    fee: 5000,
    accountData: [{ account: protocol, nativeBalanceChange: 0 }],
    instructions: [{
      programId,
      accounts: [protocol],
      data: "",
      innerInstructions: [],
    }],
    events: { protocolAddress: protocol },
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── test groups ───────────────────────────────────────────────────────────────

async function t1_health() {
  console.log("\n🔍  [1] Health Checks");
  const i = await GET(`${INDEXER_URL}/health`);
  i.status === 200 && i.body?.status === "ok" ? pass("Indexer /health → 200 ok") : fail("Indexer /health", `${i.status}`);

  const s = await GET(`${SCORING_URL}/health`);
  s.status === 200 && s.body?.status === "ok" ? pass("Scoring /health → 200 ok") : fail("Scoring /health", `${s.status}`);
}

async function t2_protocols_list() {
  console.log("\n🔍  [2] Protocolos Públicos");
  const { status, body } = await GET(`${SCORING_URL}/api/protocols`);
  if (status !== 200) { fail("GET /api/protocols → 200", `${status}`); return null; }
  pass("GET /api/protocols → 200");

  body.count > 0 ? pass(`count > 0 (${body.count} protocolos)`) : fail("count > 0", JSON.stringify(body));

  const drift = body.protocols?.find(p => p.protocolAddress === TEST_PROTOCOL);
  drift ? pass("Drift presente na lista") : fail("Drift presente na lista", "não encontrado");

  if (drift?.currentScore >= 0 && drift?.currentScore <= 100) pass(`Score Drift válido (${drift.currentScore})`);
  else fail("Score Drift válido", JSON.stringify(drift));

  if (["Low","Medium","High","Critical"].includes(drift?.riskLevel)) pass(`riskLevel Drift válido (${drift.riskLevel})`);
  else fail("riskLevel Drift", drift?.riskLevel);

  Array.isArray(drift?.activeFlags) ? pass("activeFlags é array") : fail("activeFlags é array", "");
  return body.protocols ?? [];
}

async function t3_protocol_by_address() {
  console.log("\n🔍  [3] GET /api/protocols/:address");

  const { status, body } = await GET(`${SCORING_URL}/api/protocols/${TEST_PROTOCOL}`);
  if (status === 200 && body?.protocolAddress === TEST_PROTOCOL) {
    pass(`GET /api/protocols/:address → 200`);
    body.currentScore >= 0 && body.currentScore <= 100
      ? pass(`Score individual válido (${body.currentScore})`)
      : fail("Score individual", JSON.stringify(body));
    Array.isArray(body.history) && body.history.length > 0
      ? pass(`history presente (${body.history.length} entradas)`)
      : fail("history presente", JSON.stringify(body.history));
  } else if (status === 404) {
    fail("GET /api/protocols/:address → 404", "Scoring engine precisa de redeploy — rode: railway up (scoring)");
  } else {
    fail("GET /api/protocols/:address", `${status} ${JSON.stringify(body)}`);
  }

  const { status: s404 } = await GET(`${SCORING_URL}/api/protocols/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`);
  s404 === 404 ? pass("Endereço desconhecido → 404") : fail("Endereço desconhecido → 404", `Got ${s404}`);
}

async function t4_webhook_pipeline() {
  console.log("\n🔍  [4] Webhook Pipeline  (Helius → Indexer → Scoring)");

  // Auth check
  const noSecret = await POST(`${INDEXER_URL}/webhook/governance`, [heliusPayload("test")], {});
  const needsSecret = noSecret.status === 401;
  if (needsSecret) {
    pass("Sem secret → 401 (protegido)");
    if (!WEBHOOK_SECRET) {
      fail("WEBHOOK_SECRET ausente — pipeline real não pode ser testado",
           "Rode: WEBHOOK_SECRET=<valor> node scripts/test-prod.mjs");
      return;
    }
  } else {
    pass("Sem secret → 200 (HELIUS_WEBHOOK_SECRET não setado em prod — ok para dev)");
  }

  const wh = WEBHOOK_SECRET ? { "x-helius-webhook-secret": WEBHOOK_SECRET } : {};

  // Payload inválido → 400
  const bad = await POST(`${INDEXER_URL}/webhook/governance`, { garbage: true }, wh);
  bad.status === 400 ? pass("Payload inválido → 400") : fail("Payload inválido → 400", `${bad.status}`);

  // TIMELOCK event → indexer aceita
  const r1 = await POST(`${INDEXER_URL}/webhook/governance`,
    [heliusPayload("timelock removed zero changed")], wh);
  r1.status === 200 && r1.body?.status === "ok"
    ? pass("Webhook TIMELOCK_CHANGED → 200 ok")
    : fail("Webhook TIMELOCK_CHANGED", `${r1.status} ${JSON.stringify(r1.body)}`);

  // SIGNER_ADDED event
  const r2 = await POST(`${INDEXER_URL}/webhook/governance`,
    [heliusPayload("signer added unknown new member")], wh);
  r2.status === 200 ? pass("Webhook SIGNER_ADDED → 200 ok") : fail("Webhook SIGNER_ADDED", `${r2.status}`);

  // Espera propagação indexer → scoring
  console.log("       ⏳  Aguardando propagação indexer → scoring (3s)…");
  await sleep(3000);

  const after = await GET(`${SCORING_URL}/api/protocols`);
  const drift = after.body?.protocols?.find(p => p.protocolAddress === TEST_PROTOCOL);
  if (drift) {
    pass(`Scoring responde após webhook (score=${drift.currentScore}, flags=${drift.activeFlags.length})`);
    if (VERBOSE) console.log(`       flags: ${JSON.stringify(drift.activeFlags)}`);
  } else {
    fail("Scoring responde após webhook", JSON.stringify(after.body));
  }
}

async function t5_internal_event_and_onchain() {
  console.log("\n🔍  [5] /internal/event + On-chain Persistence");

  // Usa FRESH_PROTOCOL (score inicial 85) e envia TIMELOCK_CHANGED → Δ = -15 → persiste on-chain
  const regR = await POST(`${SCORING_URL}/api/protocols/register`, {
    protocolAddress: FRESH_PROTOCOL, initialScore: 85,
  });
  [200, 201, 409].includes(regR.status)
    ? pass(`POST /api/protocols/register → ${regR.status}`)
    : fail("POST /api/protocols/register", `${regR.status} ${JSON.stringify(regR.body)}`);

  // Busca score atual
  const before = await GET(`${SCORING_URL}/api/protocols/${FRESH_PROTOCOL}`);
  const scoreBefore = before.body?.currentScore ?? 85;
  if (VERBOSE) console.log(`       Score antes: ${scoreBefore}`);

  // Envia evento que gera Δ grande (EMERGENCY_KEY_USED = -25 pts)
  const event = {
    type: "EMERGENCY_KEY_USED",
    protocolAddress: FRESH_PROTOCOL,
    sourceProgram: "squads",
    rawSignature: `e2e_onchain_${Date.now()}`,
    timestamp: Date.now(),
    metadata: { emergencyKey: "EmergencyKey111111111111111111111111111111" },
  };

  const { status, body } = await POST(`${SCORING_URL}/internal/event`, event);

  if (status !== 200 || body?.status !== "ok") {
    fail("/internal/event → 200", `${status} ${JSON.stringify(body)}`);
    return;
  }
  pass(`/internal/event → 200 (score: ${body.newScore}, Δ: ${body.delta})`);

  typeof body.newScore === "number" ? pass(`newScore = ${body.newScore}`) : fail("newScore ausente", JSON.stringify(body));
  typeof body.delta   === "number" ? pass(`delta = ${body.delta}`)    : fail("delta ausente",    JSON.stringify(body));

  if (body.persistedOnChain === true) {
    pass(`🔗 On-chain CONFIRMADO! tx: ${body.txSignature?.slice(0,20)}…`);
  } else if (body.persistedOnChain === false) {
    const absDelta = Math.abs(body.delta ?? 0);
    if (absDelta < 5) {
      pass(`On-chain skip legítimo (|Δ|=${absDelta} < threshold 5)`);
    } else {
      fail(
        `On-chain NÃO persistido mas |Δ|=${absDelta} ≥ 5`,
        `DISABLE_ON_CHAIN=true em prod? Configure DISABLE_ON_CHAIN=false no Railway → stps-scoring`
      );
    }
  } else {
    fail("persistedOnChain ausente na resposta", JSON.stringify(body));
  }

  // Verifica histórico atualizado
  await sleep(500);
  const after = await GET(`${SCORING_URL}/api/protocols/${FRESH_PROTOCOL}`);
  if (after.status === 200 && Array.isArray(after.body?.history)) {
    const lastEntry = after.body.history[after.body.history.length - 1];
    lastEntry?.score === body.newScore
      ? pass(`Histórico atualizado (última entrada score=${lastEntry.score})`)
      : fail("Histórico atualizado", `last=${JSON.stringify(lastEntry)} expected score=${body.newScore}`);
  } else if (after.status === 404) {
    fail("GET /api/protocols/:address pós-evento (→ redeploy necessário)", "404");
  }
}

async function t6_auth_routes() {
  console.log("\n🔍  [6] Auth / Rotas Protegidas");

  const me = await GET(`${SCORING_URL}/api/me`);
  me.status === 401 ? pass("GET /api/me sem token → 401") : fail("GET /api/me sem token → 401", `Got ${me.status}`);

  const tokens = await GET(`${SCORING_URL}/api/me/tokens`);
  tokens.status === 401 ? pass("GET /api/me/tokens sem token → 401") : fail("GET /api/me/tokens → 401", `Got ${tokens.status}`);

  const protos = await GET(`${SCORING_URL}/api/me/protocols`);
  protos.status === 401 ? pass("GET /api/me/protocols sem token → 401") : fail("GET /api/me/protocols → 401", `Got ${protos.status}`);

  const challenge = await POST(`${SCORING_URL}/api/auth/challenge`, {
    walletAddress: TEST_PROTOCOL,
  });
  if (challenge.status === 200 && challenge.body?.challengeId) {
    pass(`POST /api/auth/challenge → 200 (id: ${challenge.body.challengeId.slice(0,8)}…)`);
  } else if (challenge.status === 503) {
    fail("POST /api/auth/challenge → 503 (Supabase schema.sql não executado!)",
         "Execute packages/scoring/supabase/schema.sql no Supabase SQL Editor");
  } else if (challenge.status === 500) {
    fail("POST /api/auth/challenge → 500",
         "Scoring engine desatualizado OU Supabase não migrado — redeploy + schema.sql");
  } else {
    fail("POST /api/auth/challenge", `${challenge.status} ${JSON.stringify(challenge.body)}`);
  }
}

async function t7_score_integrity(protocols) {
  console.log("\n🔍  [7] Score Integrity");
  if (!protocols?.length) { fail("Sem protocolos para checar", ""); return; }

  let ok = true;
  for (const p of protocols) {
    const s = p.currentScore;
    const r = p.riskLevel;
    const exp = s === null ? null : s > 80 ? "Low" : s > 60 ? "Medium" : s > 40 ? "High" : "Critical";
    if (s !== null && r !== exp) {
      fail(`Mismatch ${p.protocolAddress.slice(0,8)}: score=${s} riskLevel=${r} (esperado ${exp})`, "");
      ok = false;
    }
  }
  if (ok) pass(`Todos ${protocols.length} protocolos: riskLevel coerente com score`);
}

async function t8_cors() {
  console.log("\n🔍  [8] CORS");
  const { headers } = await GET(`${SCORING_URL}/api/protocols`, { Origin: "https://app.stps.xyz" });
  const acao = headers.get("access-control-allow-origin");
  acao ? pass(`Access-Control-Allow-Origin: ${acao}`) : fail("CORS header ausente", "");
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  STPS — Production Test Suite  (devnet)");
  console.log(`  Indexer : ${INDEXER_URL}`);
  console.log(`  Scoring : ${SCORING_URL}`);
  console.log(`  Webhook : ${WEBHOOK_SECRET ? "✅ secret definido" : "⚠️  sem secret (set WEBHOOK_SECRET=...)"}`);
  console.log("═══════════════════════════════════════════════════════");

  await t1_health();
  const protocols = await t2_protocols_list();
  await t3_protocol_by_address();
  await t4_webhook_pipeline();
  await t5_internal_event_and_onchain();
  await t6_auth_routes();
  await t7_score_integrity(protocols);
  await t8_cors();

  const total = passed + failed;
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  Resultado: ${passed}/${total} passaram  ${failed === 0 ? "🎉" : ""}`);
  if (failures.length) {
    console.log("\n  Falhas:");
    failures.forEach(f => console.log(`    ❌  ${f.name}\n       ${f.detail}`));
  }
  console.log("═══════════════════════════════════════════════════════\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
