export type OwnerType = 'inventory' | 'player';
export type FileKind = 'image' | 'video' | 'file';

export type AttachmentMeta = Record<string, unknown>;

export interface UserFileRow {
  id: string;
  user_id: string;
  owner_type: OwnerType;
  owner_id: string;
  kind: FileKind;
  title: string | null;
  notes: string | null;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  thumb_path: string;
  local_key: string | null;
  meta: AttachmentMeta;
}

export interface AttachmentItem extends UserFileRow {
  localOnly?: boolean;
  thumbUrl?: string | null;
  syncPending?: boolean;
}

export interface LocalAttachmentRow {
  id: string;
  user_scope: string;
  owner_type: OwnerType;
  owner_id: string;
  kind: FileKind;
  title: string | null;
  notes: string | null;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  thumb_data_url: string | null;
  local_key: string | null;
  meta: AttachmentMeta;
}

