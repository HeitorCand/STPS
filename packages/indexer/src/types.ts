export type GovernanceEventType =
  | "MULTISIG_THRESHOLD_CHANGED"
  | "TIMELOCK_CHANGED"
  | "SIGNER_ADDED"
  | "SIGNER_REMOVED"
  | "EMERGENCY_KEY_USED"
  | "NONCE_ACCOUNT_CREATED"
  | "NONCE_ADVANCED";

export type GovernanceSourceProgram = "squads" | "spl-governance" | "system-nonce";

export interface GovernanceEvent {
  type: GovernanceEventType;
  protocolAddress: string;
  sourceProgram: GovernanceSourceProgram;
  rawSignature: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface HeliusInstruction {
  accounts: string[];
  data: string;
  innerInstructions: unknown[];
  programId: string;
}

export interface HeliusWebhookPayload {
  accountData: Array<{ account: string; nativeBalanceChange?: number }>;
  description: string;
  events: Record<string, unknown>;
  fee?: number;
  feePayer: string;
  instructions: HeliusInstruction[];
  signature: string;
  timestamp: number;
  type: string;
}

