import { supabase } from '../supabaseClient';
import {
  createFileRow,
  deleteFileRow,
  deleteThumb,
  getThumbUrl,
  isAuthRequiredError,
  listFiles,
  updateFileRow,
  uploadThumb,
} from './cloud';
import {
  createLocalAttachmentRow,
  deleteHeavyFile,
  getHeavyFile,
  listLocalAttachmentRows,
  removeLocalAttachmentRow,
  saveHeavyFile,
  upsertLocalAttachmentRow,
} from './localStore';
import { makePlaceholderThumbnail, makeThumbnail } from './thumb';
import type { AttachmentItem, FileKind, LocalAttachmentRow, OwnerType, UserFileRow } from './types';

const nowIso = () => new Date().toISOString();

const randomId = () => {
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

const getUserIdOrNull = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn('[attachments] Failed to resolve auth user', error);
    return null;
  }
  return data.user?.id ?? null;
};

const dataUrlFromBlob = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const userScopeFor = (userId: string | null) => userId || 'anon';

const mapCloudRow = (row: UserFileRow, thumbUrl: string | null): AttachmentItem => ({
  ...row,
  localOnly: false,
  thumbUrl,
  syncPending: false,
});

const mapLocalRow = (row: LocalAttachmentRow): AttachmentItem => ({
  id: row.id,
  user_id: row.user_scope,
  owner_type: row.owner_type,
  owner_id: row.owner_id,
  kind: row.kind,
  title: row.title,
  notes: row.notes,
  mime: row.mime,
  size_bytes: row.size_bytes,
  created_at: row.created_at,
  updated_at: row.updated_at,
  thumb_path: '',
  local_key: row.local_key,
  meta: row.meta,
  localOnly: true,
  thumbUrl: row.thumb_data_url,
  syncPending: Boolean((row.meta as Record<string, unknown> | undefined)?.syncPending),
});

const buildThumbPath = (userId: string, ownerType: OwnerType, ownerId: string, fileId: string) =>
  `${userId}/${ownerType}/${ownerId}/${fileId}.webp`;

export const inferFileKindFromFile = (file: File): FileKind => {
  const mime = (file.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
};

const createLocalOnlyAttachment = async ({
  userId,
  ownerType,
  ownerId,
  file,
  kind,
  title,
  notes,
  localKey,
  size,
  mime,
  thumbBlob,
  syncPending,
}: {
  userId: string | null;
  ownerType: OwnerType;
  ownerId: string;
  file: File;
  kind: FileKind;
  title?: string;
  notes?: string;
  localKey: string;
  size: number;
  mime: string;
  thumbBlob: Blob;
  syncPending: boolean;
}): Promise<AttachmentItem> => {
  const scope = userScopeFor(userId);
  const id = `local:${randomId()}`;
  let thumbDataUrl: string | null = null;
  try {
    thumbDataUrl = await dataUrlFromBlob(thumbBlob);
  } catch {
    thumbDataUrl = null;
  }
  const localRow = createLocalAttachmentRow({
    id,
    userScope: scope,
    ownerType,
    ownerId,
    kind,
    title: title || file.name || kind.toUpperCase(),
    notes: notes || null,
    mime,
    sizeBytes: size,
    localKey,
    thumbDataUrl,
    meta: {
      syncPending,
      source: 'local',
    },
  });
  await upsertLocalAttachmentRow(localRow);
  return mapLocalRow(localRow);
};

export const listAttachmentsForOwner = async (ownerType: OwnerType, ownerId: string): Promise<AttachmentItem[]> => {
  const userId = await getUserIdOrNull();
  const scope = userScopeFor(userId);
  const localRows = await listLocalAttachmentRows(ownerType, ownerId, scope);
  const localItems = localRows.map(mapLocalRow);

  if (!userId) return localItems;

  try {
    const cloudRows = await listFiles(ownerType, ownerId);
    const cloudItems = await Promise.all(
      cloudRows.map(async (row) => {
        try {
          const signedThumb = await getThumbUrl(row.thumb_path);
          return mapCloudRow(row, signedThumb);
        } catch (error) {
          console.warn('[attachments] Failed to sign thumbnail URL', error);
          return mapCloudRow(row, null);
        }
      })
    );
    return [...localItems, ...cloudItems].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  } catch (error) {
    console.warn('[attachments] Cloud list failed, using local attachment rows only', error);
    return localItems;
  }
};

export const attachFileToOwner = async (
  ownerType: OwnerType,
  ownerId: string,
  file: File,
  kind: FileKind = inferFileKindFromFile(file),
  title?: string,
  notes?: string
): Promise<AttachmentItem> => {
  const heavy = await saveHeavyFile(file);
  const userId = await getUserIdOrNull();
  let thumbBlob: Blob;
  try {
    thumbBlob = await makeThumbnail(file);
  } catch {
    thumbBlob = await makePlaceholderThumbnail(kind.toUpperCase());
  }

  if (!userId) {
    return createLocalOnlyAttachment({
      userId: null,
      ownerType,
      ownerId,
      file,
      kind,
      title,
      notes,
      localKey: heavy.localKey,
      size: heavy.size,
      mime: heavy.mime,
      thumbBlob,
      syncPending: false,
    });
  }

  const fileId = randomId();
  const thumbPath = buildThumbPath(userId, ownerType, ownerId, fileId);
  try {
    const created = await createFileRow({
      id: fileId,
      owner_type: ownerType,
      owner_id: ownerId,
      kind,
      title: title || file.name || kind.toUpperCase(),
      notes: notes || null,
      mime: heavy.mime,
      size_bytes: heavy.size,
      thumb_path: thumbPath,
      local_key: heavy.localKey,
      meta: {
        originalName: file.name || null,
      },
    });

    try {
      await uploadThumb(thumbBlob, thumbPath);
    } catch (thumbError) {
      console.warn('[attachments] Thumbnail upload failed', thumbError);
      await updateFileRow(created.id, {
        meta: {
          ...(created.meta || {}),
          missingThumb: true,
          thumbError: (thumbError as Error)?.message || 'upload_failed',
        },
      });
    }

    let thumbUrl: string | null = null;
    try {
      thumbUrl = await getThumbUrl(thumbPath);
    } catch {
      thumbUrl = null;
    }

    return mapCloudRow(
      {
        ...created,
        local_key: heavy.localKey,
      },
      thumbUrl
    );
  } catch (error) {
    if (!isAuthRequiredError(error)) {
      console.warn('[attachments] Cloud attach failed, falling back to local-only attachment', error);
    }
    return createLocalOnlyAttachment({
      userId,
      ownerType,
      ownerId,
      file,
      kind,
      title,
      notes,
      localKey: heavy.localKey,
      size: heavy.size,
      mime: heavy.mime,
      thumbBlob,
      syncPending: true,
    });
  }
};

export const removeAttachment = async (attachment: AttachmentItem): Promise<void> => {
  if (attachment.local_key) {
    try {
      await deleteHeavyFile(attachment.local_key);
    } catch (error) {
      console.warn('[attachments] Failed deleting heavy local file', error);
    }
  }

  if (attachment.localOnly || attachment.id.startsWith('local:')) {
    try {
      await removeLocalAttachmentRow(attachment.id);
    } catch (error) {
      console.warn('[attachments] Failed deleting local attachment metadata', error);
    }
    return;
  }

  try {
    if (attachment.thumb_path) {
      await deleteThumb(attachment.thumb_path);
    }
    await deleteFileRow(attachment.id);
  } catch (error) {
    console.warn('[attachments] Failed removing cloud attachment', error);
    throw error;
  }
};

export type AttachmentViewerSource = {
  url: string | null;
  mime: string | null;
  missingLocal: boolean;
};

export const getAttachmentViewerSource = async (attachment: AttachmentItem): Promise<AttachmentViewerSource> => {
  if (!attachment.local_key) {
    return {
      url: null,
      mime: attachment.mime,
      missingLocal: true,
    };
  }
  const heavyBlob = await getHeavyFile(attachment.local_key);
  if (!heavyBlob) {
    return {
      url: null,
      mime: attachment.mime,
      missingLocal: true,
    };
  }
  return {
    url: URL.createObjectURL(heavyBlob),
    mime: heavyBlob.type || attachment.mime,
    missingLocal: false,
  };
};

export const revokeAttachmentViewerUrl = (url: string | null | undefined) => {
  if (!url) return;
  URL.revokeObjectURL(url);
};

export const makeAttachmentBaseline = (ownerType: OwnerType, ownerId: string): AttachmentItem => ({
  id: `temp:${randomId()}`,
  user_id: 'temp',
  owner_type: ownerType,
  owner_id: ownerId,
  kind: 'file',
  title: null,
  notes: null,
  mime: null,
  size_bytes: null,
  created_at: nowIso(),
  updated_at: nowIso(),
  thumb_path: '',
  local_key: null,
  meta: {},
  localOnly: true,
  thumbUrl: null,
});
