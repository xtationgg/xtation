import { supabase } from '../supabaseClient';
import type { AttachmentMeta, OwnerType, UserFileRow } from './types';

const TABLE = 'user_files';
const BUCKET = 'thumbs';

const AUTH_REQUIRED = 'AUTH_REQUIRED';

const authRequiredError = () => {
  const error = new Error(AUTH_REQUIRED);
  (error as Error & { code?: string }).code = AUTH_REQUIRED;
  return error;
};

export const isAuthRequiredError = (error: unknown) => {
  if (!error) return false;
  const value = error as Error & { code?: string };
  return value.code === AUTH_REQUIRED || value.message === AUTH_REQUIRED;
};

export const getCurrentAuthedUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw authRequiredError();
  return userId;
};

export const listFiles = async (ownerType: OwnerType, ownerId: string): Promise<UserFileRow[]> => {
  const userId = await getCurrentAuthedUserId();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as UserFileRow[];
};

export const createFileRow = async (params: {
  id?: string;
  owner_type: OwnerType;
  owner_id: string;
  kind: UserFileRow['kind'];
  title?: string | null;
  notes?: string | null;
  mime?: string | null;
  size_bytes?: number | null;
  thumb_path: string;
  local_key?: string | null;
  meta?: AttachmentMeta;
}): Promise<UserFileRow> => {
  const userId = await getCurrentAuthedUserId();
  const now = new Date().toISOString();
  const payload = {
    id: params.id,
    user_id: userId,
    owner_type: params.owner_type,
    owner_id: params.owner_id,
    kind: params.kind,
    title: params.title ?? null,
    notes: params.notes ?? null,
    mime: params.mime ?? null,
    size_bytes: params.size_bytes ?? null,
    thumb_path: params.thumb_path,
    local_key: params.local_key ?? null,
    meta: params.meta ?? {},
    updated_at: now,
  };

  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single();
  if (error) throw error;
  return data as UserFileRow;
};

export const updateFileRow = async (
  id: string,
  patch: Partial<Pick<UserFileRow, 'title' | 'notes' | 'mime' | 'size_bytes' | 'thumb_path' | 'local_key' | 'meta' | 'kind'>>
): Promise<UserFileRow> => {
  await getCurrentAuthedUserId();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as UserFileRow;
};

export const deleteFileRow = async (id: string): Promise<void> => {
  await getCurrentAuthedUserId();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

export const uploadThumb = async (thumbBlob: Blob, thumbPath: string): Promise<void> => {
  await getCurrentAuthedUserId();
  const { error } = await supabase.storage.from(BUCKET).upload(thumbPath, thumbBlob, {
    upsert: true,
    contentType: thumbBlob.type || 'image/webp',
  });
  if (error) throw error;
};

export const deleteThumb = async (thumbPath: string): Promise<void> => {
  await getCurrentAuthedUserId();
  const { error } = await supabase.storage.from(BUCKET).remove([thumbPath]);
  if (error) throw error;
};

export const getThumbUrl = async (thumbPath: string): Promise<string | null> => {
  await getCurrentAuthedUserId();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(thumbPath, 3600);
  if (error) throw error;
  return data?.signedUrl || null;
};

