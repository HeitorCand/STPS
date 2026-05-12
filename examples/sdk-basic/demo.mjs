import "dotenv/config";
import { StpsApiError, StpsClient } from "stps-sdk";

const token = process.env.STPS_API_TOKEN;
const preferredProtocol = process.env.STPS_PROTOCOL_ADDRESS?.trim();
const shouldWatch = process.argv.includes("--watch");

if (!token || token === "stps_your_dashboard_token_here") {
  console.error("Missing STPS_API_TOKEN.");
  console.error("Create a dashboard SDK token, then run:");
  console.error("  cp .env.example .env");
  console.error("  # edit .env with STPS_API_TOKEN");
  console.error("  npm start");
  process.exit(1);
}

const client = new StpsClient({
  token,
  timeoutMs: 10_000,
});

function line() {
  console.log("------------------------------------------------------------");
}

function formatScore(score) {
  if (score.currentScore === null || score.currentScore === undefined) {
    return "not calculated";
  }

  return `${score.currentScore}/100 (${score.riskLevel})`;
}

function formatFlags(flags) {
  return flags.length > 0 ? flags.join(", ") : "none";
}

async function main() {
  console.log("STPS SDK basic demo");
  line();

  const profile = await client.getProfile();
  console.log("Authenticated account");
  console.log(`Wallet: ${profile.user.primaryWalletAddress}`);
  console.log(`Auth: ${profile.apiToken ? `SDK token ${profile.apiToken.label ?? profile.apiToken.id}` : "wallet session"}`);
  line();

  const list = await client.getProtocols();
  console.log(`Workspace protocols: ${list.count}`);

  if (list.protocols.length === 0) {
    console.log("No protocol is attached to this account yet.");
    console.log("Open the dashboard, add a protocol in /dashboard/protocols, then run this demo again.");
    return;
  }

  for (const item of list.protocols) {
    console.log(`- ${item.label ?? item.protocolAddress}`);
    console.log(`  address: ${item.protocolAddress}`);
    console.log(`  score:   ${formatScore(item.protocol)}`);
    console.log(`  flags:   ${formatFlags(item.protocol.activeFlags)}`);
  }

  line();

  const targetAddress = preferredProtocol || list.protocols[0].protocolAddress;
  const monitored = await client.getProtocol(targetAddress);
  const score = await client.getScore(targetAddress);
  const history = await client.getHistory(targetAddress);

  console.log("Selected protocol");
  console.log(`Label:   ${monitored.label ?? "unlabeled"}`);
  console.log(`Address: ${targetAddress}`);
  console.log(`Score:   ${formatScore(score)}`);
  console.log(`Flags:   ${formatFlags(score.activeFlags)}`);
  console.log(`Updated: ${score.lastUpdate ? new Date(score.lastUpdate).toISOString() : "not available"}`);

  if (history.length > 0) {
    console.log("Recent history");
    for (const entry of history.slice(-5)) {
      console.log(`- ${new Date(entry.timestamp).toISOString()} | ${entry.score}/100 | ${entry.reason}`);
    }
  } else {
    console.log("Recent history: none yet");
  }

  if (!shouldWatch) return;

  line();
  console.log("Watching for score or flag changes. Press Ctrl+C to stop.");
  client.subscribeToAlerts(targetAddress, (protocol) => {
    const current = protocol.protocol;
    console.log(`[update] ${new Date().toISOString()} | ${formatScore(current)} | ${formatFlags(current.activeFlags)}`);
  });
}

main().catch((error) => {
  line();
  if (error instanceof StpsApiError) {
    console.error(`STPS API error: HTTP ${error.status}`);
    console.error(JSON.stringify(error.body, null, 2));
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
});
