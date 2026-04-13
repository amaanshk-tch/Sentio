
const HORIZON = "https://horizon.stellar.org";

export interface HorizonAccount {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  home_domain?: string;
  last_modified_ledger: number;
  num_sponsoring: number;
  num_sponsored: number;
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
    auth_clawback_enabled: boolean;
  };
  balances: HorizonBalance[];
  signers: HorizonSigner[];
  data: Record<string, string>;
}

export interface HorizonBalance {
  balance: string;
  limit?: string;
  buying_liabilities: string;
  selling_liabilities: string;
  asset_type: "native" | "credit_alphanum4" | "credit_alphanum12" | "liquidity_pool_shares";
  asset_code?: string;
  asset_issuer?: string;
  is_authorized?: boolean;
  last_modified_ledger?: number;
}

export interface HorizonSigner {
  weight: number;
  key: string;
  type: string;
}

export interface HorizonAsset {
  asset_type: string;
  asset_code: string;
  asset_issuer: string;
  accounts: {
    authorized: number;
    authorized_to_maintain_liabilities: number;
    unauthorized: number;
  };
  num_claimable_balances: number;
  num_contracts?: number;
  num_liquidity_pools?: number;
  balances: {
    authorized: string;
    authorized_to_maintain_liabilities: string;
    unauthorized: string;
  };
  claimable_balances_amount: string;
  contracts_amount?: string;
  liquidity_pools_amount?: string;
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
  };
  _links?: { toml?: { href: string } };
}

export interface HorizonTransaction {
  id: string;
  created_at: string;
  operation_count: number;
  successful: boolean;
  fee_charged: string;
  source_account: string;
  memo_type: string;
}

export interface HorizonOperation {
  id: string;
  created_at: string;
  type: string;
  source_account: string;
}

export interface LedgerStats {
  sequence: number;
  closed_at: string;
  transaction_count: number;
  successful_transaction_count: number;
  failed_transaction_count: number;
  operation_count: number;
  base_fee_in_stroops: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAccountId(input: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(input.trim());
}

function parseAssetInput(input: string): { code: string; issuer?: string } | null {
  const trimmed = input.trim();
  if (trimmed.includes(":")) {
    const [code, issuer] = trimmed.split(":");
    return { code: code.toUpperCase(), issuer };
  }
  if (/^[A-Z0-9]{1,12}$/.test(trimmed.toUpperCase()) && !isAccountId(trimmed)) {
    return { code: trimmed.toUpperCase() };
  }
  return null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchAccount(address: string): Promise<HorizonAccount> {
  const res = await fetch(`${HORIZON}/accounts/${address.trim()}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Account not found on the Stellar network.");
    throw new Error(`Horizon error ${res.status}`);
  }
  return res.json();
}

export async function fetchAccountTransactions(address: string, limit = 10): Promise<HorizonTransaction[]> {
  const res = await fetch(
    `${HORIZON}/accounts/${address.trim()}/transactions?limit=${limit}&order=desc`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data._embedded?.records ?? [];
}

export async function fetchAccountOperations(address: string, limit = 10): Promise<HorizonOperation[]> {
  const res = await fetch(
    `${HORIZON}/accounts/${address.trim()}/operations?limit=${limit}&order=desc`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data._embedded?.records ?? [];
}

export async function fetchAsset(code: string, issuer?: string): Promise<HorizonAsset | null> {
  let url = `${HORIZON}/assets?asset_code=${code}&limit=1`;
  if (issuer) url += `&asset_issuer=${issuer}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Horizon error ${res.status}`);
  const data = await res.json();
  const records: HorizonAsset[] = data._embedded?.records ?? [];
  if (records.length === 0) throw new Error(`Asset ${code} not found on the Stellar network.`);
  return records[0];
}

export async function fetchLatestLedger(): Promise<LedgerStats | null> {
  try {
    const res = await fetch(`${HORIZON}/ledgers?order=desc&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    return data._embedded?.records?.[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Smart detect: account vs asset ──────────────────────────────────────────

export type SearchMode = "account" | "asset";

export function detectInputType(input: string): SearchMode {
  return isAccountId(input.trim()) ? "account" : "asset";
}

export async function searchStellar(
  input: string
): Promise<{ mode: SearchMode; account?: HorizonAccount; asset?: HorizonAsset }> {
  const mode = detectInputType(input);
  if (mode === "account") {
    const account = await fetchAccount(input);
    return { mode, account };
  } else {
    const parsed = parseAssetInput(input);
    if (!parsed) throw new Error("Could not parse input. Use a Stellar address (GXXX...) or asset code (e.g. USDC or USDC:GXXX...)");
    const asset = await fetchAsset(parsed.code, parsed.issuer);
    if (!asset) throw new Error("Asset not found.");
    return { mode, asset };
  }
}
