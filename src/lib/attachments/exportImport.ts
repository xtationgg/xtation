import { supabase } from '../supabaseClient';
import type { OwnerType, UserFileRow } from './types';

const TABLE = 'user_files';

const randomUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (char) => {
    const rand = Math.random() * 16 | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error('AUTH_REQUIRED');
  return userId;
};

export const exportAttachmentMetadata = async (ownerType?: OwnerType, ownerId?: string): Promise<string> => {
  const userId = await getCurrentUserId();
  let query = supabase.from(TABLE).select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (ownerType) query = query.eq('owner_type', ownerType);
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { data, error } = await query;
  if (error) throw error;

  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      rows: (data || []) as UserFileRow[],
    },
    null,
    2
  );
};

const normalizeImportRows = (rows: any[], userId: string): Partial<UserFileRow>[] =>
  rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const id = typeof row.id === 'string' && row.id.trim() ? row.id : randomUuid();
      const ownerType = row.owner_type === 'player' ? 'player' : 'inventory';
      const ownerId = String(row.owner_id || '');
      const kind = row.kind === 'video' || row.kind === 'file' ? row.kind : 'image';
      const thumbPath =
        typeof row.thumb_path === 'string' && row.thumb_path.trim()
          ? row.thumb_path
          : `${userId}/${ownerType}/${ownerId}/${id}.webp`;
      const incomingMeta = row.meta && typeof row.meta === 'object' ? row.meta : {};

      return {
        id,
        user_id: userId,
        owner_type: ownerType,
        owner_id: ownerId,
        kind,
        title: row.title ?? null,
        notes: row.notes ?? null,
        mime: row.mime ?? null,
        size_bytes: Number.isFinite(Number(row.size_bytes)) ? Number(row.size_bytes) : null,
        thumb_path: thumbPath,
        local_key: row.local_key ?? null,
        meta:
          thumbPath && typeof row.thumb_path === 'string'
            ? incomingMeta
            : {
                ...incomingMeta,
                missingThumb: true,
                importedWithoutThumb: true,
              },
      };
    });

export const importAttachmentMetadata = async (jsonText: string): Promise<{ inserted: number }> => {
  const userId = await getCurrentUserId();
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON for metadata import');
  }

  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : [];
  if (!rows.length) return { inserted: 0 };

  const normalizedRows = normalizeImportRows(rows, userId);

  const { error } = await supabase.from(TABLE).upsert(normalizedRows, { onConflict: 'id' });
  if (error) throw error;
  return { inserted: normalizedRows.length };
};
