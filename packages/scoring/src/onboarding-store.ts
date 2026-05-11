import crypto from "node:crypto";
import { getSupabase } from "./db.js";

export type ChallengePurpose = "login" | "verify_protocol_control";
export type ClaimStatus = "claimed" | "verified" | "manual_review";
export type VerificationMethod = "upgrade_authority" | "known_admin_signer" | null;

export interface UserRecord {
  id: string;
  primaryWalletAddress: string;
  displayName: string | null;
  createdAt: string;
}

export interface ChallengeRecord {
  id: string;
  walletAddress: string;
  purpose: ChallengePurpose;
  protocolAddress: string | null;
  challengeMessage: string;
  nonce: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
  walletAddress: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface ApiTokenRecord {
  id: string;
  userId: string;
  label: string | null;
  tokenHash: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ProtocolClaimRecord {
  id: string;
  userId: string;
  protocolAddress: string;
  label: string | null;
  claimedByWallet: string;
  status: ClaimStatus;
  verificationMethod: VerificationMethod;
  verificationTarget: string | null;
  verificationNotes: string | null;
  registrationTxSignature: string | null;
  createdAt: string;
  updatedAt: string;
}

type DbUser = {
  id: string;
  primary_wallet_address: string;
  display_name: string | null;
  created_at: string;
};

type DbChallenge = {
  id: string;
  wallet_address: string;
  purpose: ChallengePurpose;
  protocol_address: string | null;
  challenge_message: string;
  nonce: string;
  expires_at: string;
  consumed_at: string | null;
};

type DbSession = {
  id: string;
  user_id: string;
  wallet_address: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};

type DbApiToken = {
  id: string;
  user_id: string;
  label: string | null;
  token_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type DbClaim = {
  id: string;
  user_id: string;
  protocol_address: string;
  label: string | null;
  claimed_by_wallet: string;
  status: ClaimStatus;
  verification_method: VerificationMethod;
  verification_target: string | null;
  verification_notes: string | null;
  registration_tx_signature: string | null;
  created_at: string;
  updated_at: string;
};

function mapUser(row: DbUser): UserRecord {
  return {
    id: row.id,
    primaryWalletAddress: row.primary_wallet_address,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

function mapChallenge(row: DbChallenge): ChallengeRecord {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    purpose: row.purpose,
    protocolAddress: row.protocol_address,
    challengeMessage: row.challenge_message,
    nonce: row.nonce,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

function mapSession(row: DbSession): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    walletAddress: row.wallet_address,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

function mapApiToken(row: DbApiToken): ApiTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

function mapClaim(row: DbClaim): ProtocolClaimRecord {
  return {
    id: row.id,
    userId: row.user_id,
    protocolAddress: row.protocol_address,
    label: row.label,
    claimedByWallet: row.claimed_by_wallet,
    status: row.status,
    verificationMethod: row.verification_method,
    verificationTarget: row.verification_target,
    verificationNotes: row.verification_notes,
    registrationTxSignature: row.registration_tx_signature,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createOpaqueSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function createApiAccessTokenValue(): string {
  return `stps_${crypto.randomBytes(32).toString("base64url")}`;
}

export async function createAuthChallenge(args: {
  walletAddress: string;
  purpose: ChallengePurpose;
  challengeMessage: string;
  protocolAddress?: string | null;
  expiresAt: string;
}): Promise<ChallengeRecord> {
  const supabase = getSupabase();
  const row = {
    wallet_address: args.walletAddress,
    purpose: args.purpose,
    protocol_address: args.protocolAddress ?? null,
    challenge_message: args.challengeMessage,
    nonce: crypto.randomUUID(),
    expires_at: args.expiresAt,
  };

  const { data, error } = await supabase
    .from("auth_challenges")
    .insert(row)
    .select("*")
    .single<DbChallenge>();

  if (error) throw error;
  return mapChallenge(data);
}

export async function getActiveChallenge(args: {
  challengeId: string;
  walletAddress: string;
  purpose: ChallengePurpose;
  protocolAddress?: string | null;
}): Promise<ChallengeRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("auth_challenges")
    .select("*")
    .eq("id", args.challengeId)
    .eq("wallet_address", args.walletAddress)
    .eq("purpose", args.purpose)
    .maybeSingle<DbChallenge>();

  if (error) throw error;
  if (!data) return null;

  if (args.protocolAddress !== undefined && data.protocol_address !== (args.protocolAddress ?? null)) {
    return null;
  }

  if (data.consumed_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return mapChallenge(data);
}

export async function consumeChallenge(challengeId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("auth_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challengeId);

  if (error) throw error;
}

export async function findOrCreateUserByWallet(walletAddress: string): Promise<UserRecord> {
  const supabase = getSupabase();

  const { data: existingWallet, error: walletError } = await supabase
    .from("wallet_identities")
    .select("user_id")
    .eq("wallet_address", walletAddress)
    .maybeSingle<{ user_id: string }>();

  if (walletError) throw walletError;

  if (existingWallet?.user_id) {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", existingWallet.user_id)
      .single<DbUser>();

    if (userError) throw userError;
    return mapUser(user);
  }

  const { data: user, error: createUserError } = await supabase
    .from("users")
    .insert({ primary_wallet_address: walletAddress, display_name: null })
    .select("*")
    .single<DbUser>();

  if (createUserError) throw createUserError;

  const { error: walletInsertError } = await supabase.from("wallet_identities").insert({
    user_id: user.id,
    wallet_address: walletAddress,
  });

  if (walletInsertError) throw walletInsertError;
  return mapUser(user);
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle<DbUser>();

  if (error) throw error;
  return data ? mapUser(data) : null;
}

export async function updateUserDisplayName(args: {
  userId: string;
  displayName: string;
}): Promise<UserRecord> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .update({ display_name: args.displayName })
    .eq("id", args.userId)
    .select("*")
    .single<DbUser>();

  if (error) throw error;
  return mapUser(data);
}

export async function createSession(args: {
  userId: string;
  walletAddress: string;
  expiresAt: string;
}): Promise<{ token: string; session: SessionRecord }> {
  const supabase = getSupabase();
  const token = createOpaqueSessionToken();
  const tokenHash = hashSessionToken(token);

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: args.userId,
      wallet_address: args.walletAddress,
      token_hash: tokenHash,
      expires_at: args.expiresAt,
    })
    .select("*")
    .single<DbSession>();

  if (error) throw error;
  return { token, session: mapSession(data) };
}

export async function getSessionByToken(token: string): Promise<SessionRecord | null> {
  const supabase = getSupabase();
  const tokenHash = hashSessionToken(token);

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle<DbSession>();

  if (error) throw error;
  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return mapSession(data);
}

export async function revokeSession(token: string): Promise<void> {
  const supabase = getSupabase();
  const tokenHash = hashSessionToken(token);
  const { error } = await supabase
    .from("sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  if (error) throw error;
}

export async function createApiToken(args: {
  userId: string;
  label?: string | null;
}): Promise<{ token: string; apiToken: ApiTokenRecord }> {
  const supabase = getSupabase();
  const token = createApiAccessTokenValue();
  const tokenHash = hashSessionToken(token);

  const { data, error } = await supabase
    .from("api_tokens")
    .insert({
      user_id: args.userId,
      label: args.label ?? null,
      token_hash: tokenHash,
    })
    .select("*")
    .single<DbApiToken>();

  if (error) throw error;
  return { token, apiToken: mapApiToken(data) };
}

export async function getApiTokenByToken(token: string): Promise<ApiTokenRecord | null> {
  const supabase = getSupabase();
  const tokenHash = hashSessionToken(token);

  const { data, error } = await supabase
    .from("api_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle<DbApiToken>();

  if (error) throw error;
  if (!data) return null;
  if (data.revoked_at) return null;

  const { error: touchError } = await supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  if (touchError) throw touchError;
  return mapApiToken({ ...data, last_used_at: new Date().toISOString() });
}

export async function listApiTokensForUser(userId: string): Promise<ApiTokenRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("api_tokens")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: true })
    .returns<DbApiToken[]>();

  if (error) throw error;
  return (data ?? []).map(mapApiToken);
}

export async function revokeApiTokenForUser(args: {
  userId: string;
  apiTokenId: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", args.apiTokenId)
    .eq("user_id", args.userId);

  if (error) throw error;
}

export async function createProtocolClaim(args: {
  userId: string;
  protocolAddress: string;
  label?: string | null;
  claimedByWallet: string;
  registrationTxSignature?: string | null;
}): Promise<ProtocolClaimRecord> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("protocol_claims")
    .insert({
      user_id: args.userId,
      protocol_address: args.protocolAddress,
      label: args.label ?? null,
      claimed_by_wallet: args.claimedByWallet,
      registration_tx_signature: args.registrationTxSignature ?? null,
    })
    .select("*")
    .single<DbClaim>();

  if (error) throw error;
  return mapClaim(data);
}

export async function getUserClaims(userId: string): Promise<ProtocolClaimRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("protocol_claims")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<DbClaim[]>();

  if (error) throw error;
  return (data ?? []).map(mapClaim);
}

export async function getClaimByIdForUser(
  claimId: string,
  userId: string,
): Promise<ProtocolClaimRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("protocol_claims")
    .select("*")
    .eq("id", claimId)
    .eq("user_id", userId)
    .maybeSingle<DbClaim>();

  if (error) throw error;
  return data ? mapClaim(data) : null;
}

export async function findClaimByProtocolAddressForUser(
  protocolAddress: string,
  userId: string,
): Promise<ProtocolClaimRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("protocol_claims")
    .select("*")
    .eq("protocol_address", protocolAddress)
    .eq("user_id", userId)
    .maybeSingle<DbClaim>();

  if (error) throw error;
  return data ? mapClaim(data) : null;
}

export async function updateClaimVerification(args: {
  claimId: string;
  status: ClaimStatus;
  verificationMethod: VerificationMethod;
  verificationTarget?: string | null;
  verificationNotes?: string | null;
}): Promise<ProtocolClaimRecord> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("protocol_claims")
    .update({
      status: args.status,
      verification_method: args.verificationMethod,
      verification_target: args.verificationTarget ?? null,
      verification_notes: args.verificationNotes ?? null,
    })
    .eq("id", args.claimId)
    .select("*")
    .single<DbClaim>();

  if (error) throw error;
  return mapClaim(data);
}
