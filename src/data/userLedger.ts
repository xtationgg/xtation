import { supabase } from '../lib/supabaseClient';
import type { UserLedger, UserLedgerRecord } from '../types/ledger';

const TABLE = 'user_ledgers';
const DEFAULT_CLIENT_ID = 'web';

const buildDefaultLedger = (nowIso: string): UserLedger => ({
  xp: 0,
  days: {},
  meta: {
    lastSync: nowIso,
  },
});

const normalizeLedger = (value: unknown, nowIso: string): UserLedger => {
  if (!value || typeof value !== 'object') return buildDefaultLedger(nowIso);
  const candidate = value as Partial<UserLedger>;
  const xp = Number.isFinite(candidate.xp) ? Math.max(0, Math.floor(candidate.xp as number)) : 0;
  const days = candidate.days && typeof candidate.days === 'object' ? candidate.days : {};
  const lastSync = typeof candidate.meta?.lastSync === 'string' ? candidate.meta.lastSync : nowIso;
  return {
    xp,
    days,
    meta: {
      lastSync,
    },
  };
};

const normalizeRecord = (
  row: { ledger?: unknown; client_updated_at?: string | null; updated_at?: string | null } | null | undefined,
  nowIso: string,
  isNew: boolean
): UserLedgerRecord => ({
  ledger: normalizeLedger(row?.ledger, nowIso),
  clientUpdatedAt: row?.client_updated_at ?? null,
  updatedAt: row?.updated_at ?? null,
  isNew,
});

const requireUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) {
    throw new Error('No authenticated user. Please sign in first.');
  }
  return userId;
};

export const getOrCreateLedger = async (): Promise<UserLedgerRecord> => {
  const userId = await requireUserId();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from(TABLE)
    .select('ledger, client_updated_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data?.ledger) return normalizeRecord(data, nowIso, false);

  const defaultLedger = buildDefaultLedger(nowIso);
  const { data: created, error: insertError } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      ledger: defaultLedger,
      client_id: DEFAULT_CLIENT_ID,
      client_updated_at: nowIso,
    })
    .select('ledger, client_updated_at, updated_at')
    .maybeSingle();

  if (insertError) throw insertError;
  return normalizeRecord(created ?? { ledger: defaultLedger, client_updated_at: nowIso, updated_at: nowIso }, nowIso, true);
};

export const saveLedger = async (ledger: UserLedger): Promise<UserLedgerRecord> => {
  const userId = await requireUserId();
  const nowIso = new Date().toISOString();
  const nextLedger = normalizeLedger(ledger, nowIso);
  nextLedger.meta = {
    ...(nextLedger.meta || {}),
    lastSync: nowIso,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ledger: nextLedger,
      updated_at: nowIso,
      client_updated_at: nowIso,
    })
    .eq('user_id', userId)
    .select('ledger, client_updated_at, updated_at')
    .maybeSingle();

  if (error) throw error;
  if (data?.ledger) return normalizeRecord(data, nowIso, false);

  const { data: created, error: insertError } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      ledger: nextLedger,
      client_id: DEFAULT_CLIENT_ID,
      client_updated_at: nowIso,
      updated_at: nowIso,
    })
    .select('ledger, client_updated_at, updated_at')
    .maybeSingle();

  if (insertError) throw insertError;
  return normalizeRecord(created ?? { ledger: nextLedger, client_updated_at: nowIso, updated_at: nowIso }, nowIso, !data);
};

export const resetCloudLedgerForCurrentUser = async (): Promise<void> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) {
    throw new Error('Not signed in');
  }
  const nowIso = new Date().toISOString();
  const defaultLedger = buildDefaultLedger(nowIso);

  const { error: deleteError } = await supabase.from(TABLE).delete().eq('user_id', userId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from(TABLE).insert({
    user_id: userId,
    ledger: defaultLedger,
    client_id: DEFAULT_CLIENT_ID,
    client_updated_at: nowIso,
    updated_at: nowIso,
  });
  if (insertError) throw insertError;
};
