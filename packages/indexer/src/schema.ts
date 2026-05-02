import { z } from "zod";

export const heliusInstructionSchema = z.object({
  accounts: z.array(z.string()).default([]),
  data: z.string().default(""),
  innerInstructions: z.array(z.unknown()).default([]),
  programId: z.string(),
});

export const heliusWebhookPayloadSchema = z.object({
  accountData: z
    .array(
      z.object({
        account: z.string(),
        nativeBalanceChange: z.number().optional(),
      }),
    )
    .default([]),
  description: z.string().default(""),
  events: z.record(z.unknown()).default({}),
  fee: z.number().optional(),
  feePayer: z.string().default(""),
  instructions: z.array(heliusInstructionSchema).default([]),
  signature: z.string(),
  timestamp: z.number(),
  type: z.string().default("UNKNOWN"),
});

