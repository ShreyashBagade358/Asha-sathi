export interface UserSummary {
  id: string;
  phone: string;
  full_name: string;
  role: string;
  language: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse {
  tokens: TokenResponse;
  user: UserSummary;
}

export type SyncState = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export type SyncOperation = 'create' | 'update' | 'delete';

export interface QueueItem {
  clientRequestId: string;
  entity: string;
  operation: SyncOperation;
  recordId: string;
  version: number;
  data: Record<string, unknown>;
  state: SyncState;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

export interface SyncPushItemResult {
  client_request_id: string;
  entity: string;
  operation: string;
  status: 'success' | 'conflict' | 'failed';
  server_id: string | null;
  version: number | null;
  record: Record<string, unknown> | null;
  error?: string | null;
  conflict_reason?: string | null;
}

export interface SyncPushResponse {
  results: SyncPushItemResult[];
  server_time: string;
  summary: { pushed: number; conflicts: number; failed: number; total: number };
}

export interface SyncPullResponse {
  records: Record<string, Array<Record<string, unknown>>>;
  server_time: string;
  next_cursor: string | null;
  has_more: boolean;
}

export interface SyncStatusResponse {
  online: boolean;
  last_sync_at: string | null;
  pending_push: number;
  pending_pull: number;
  conflicts: number;
}

export interface Household {
  id: string;
  hhid: string;
  village_id: string;
  asha_id: string;
  address?: string | null;
  consent_given?: boolean;
  updated_at?: string;
  version?: number;
  [key: string]: unknown;
}

export interface Beneficiary {
  id: string;
  beneficiary_id: string;
  household_id: string | null;
  full_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  status?: string;
  updated_at?: string;
  version?: number;
  [key: string]: unknown;
}
