import type { GovernanceEvent } from "./types.js";
import { logError, logInfo } from "./logger.js";

export async function emitGovernanceEvent(event: GovernanceEvent): Promise<void> {
  const baseUrl = process.env.SCORING_ENGINE_URL;

  if (!baseUrl) {
    logError("emitter_not_configured", "SCORING_ENGINE_URL is not set", {
      event_type: event.type,
      protocol_address: event.protocolAddress,
      signature: event.rawSignature,
    });
    return;
  }

  const url = `${baseUrl.replace(/\/$/, "")}/internal/event`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      logError("emitter_failed", `Scoring Engine returned ${response.status}`, {
        event_type: event.type,
        protocol_address: event.protocolAddress,
        signature: event.rawSignature,
      });
      return;
    }

    logInfo("emitter_succeeded", {
      event_type: event.type,
      protocol_address: event.protocolAddress,
      signature: event.rawSignature,
    });
  } catch (error) {
    logError("emitter_failed", error, {
      event_type: event.type,
      protocol_address: event.protocolAddress,
      signature: event.rawSignature,
    });
  }
}

