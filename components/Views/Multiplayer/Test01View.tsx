import React from 'react';
import { Player } from '../../../types';
import { HexButton, HexPanel } from '../../UI/HextechUI';
import { readFileAsDataUrl, readImageCompressedDataUrl } from '../../../utils/fileUtils';
import { nominatimSearch } from '../../../utils/geocode';
import { timeZoneFromLatLng, utcOffsetMinutesForTimeZone } from '../../../utils/timezone';
import {
  Search,
  Plus,
  Globe,
  Ghost,
  Twitch,
  Youtube,
  Instagram,
  Send,
  MessageCircle,
  Image as ImageIcon,
  User as UserIcon,
  X,
  Upload,
  File as FileIcon,
  Mail,
  Scan,
  Facebook,
  Twitter,
  Linkedin,
  Music2,
  Trash2,
  Loader2,
} from 'lucide-react';
import { readUserScopedString, writeUserScopedString } from '../../../src/lib/userScopedStorage';
import { useAuth } from '../../../src/auth/AuthProvider';
import type { AttachmentItem } from '../../../src/lib/attachments/types';
import {
  attachFileToOwner,
  getAttachmentViewerSource,
  inferFileKindFromFile,
  listAttachmentsForOwner,
  removeAttachment,
  revokeAttachmentViewerUrl,
} from '../../../src/lib/attachments/service';

export interface Test01ViewProps {
  players: Player[];
  onUpdatePlayer: (id: string, updates: Partial<Player>) => void;
  onAddPlayer: (data: Omit<Player, 'id'>) => void;
  onDeletePlayer: (id: string) => void;
  onGoToEarth: (focus: { playerId: string; loc: { lat: number; lng: number; label?: string } }) => void;
  setToast: (msg: string) => void;
  focusPlayerId?: string | null;
  onClearFocusPlayer?: () => void;
}

const SmallLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--ui-muted)]">{children}</div>
);

type LinkMeta = { label: string; Icon: React.ComponentType<{ size?: number; className?: string }> };

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const getLinkMeta = (url: string): LinkMeta => {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {}

  if (host.includes('instagram.com')) return { label: 'Instagram', Icon: Instagram };
  if (host.includes('youtube.com') || host.includes('youtu.be')) return { label: 'YouTube', Icon: Youtube };
  if (host.includes('linkedin.com')) return { label: 'LinkedIn', Icon: Linkedin };
  if (host.includes('facebook.com')) return { label: 'Facebook', Icon: Facebook };
  if (host.includes('tiktok.com')) return { label: 'TikTok', Icon: Music2 };
  if (host.includes('twitter.com') || host.includes('x.com')) return { label: 'X', Icon: Twitter };
  if (host.includes('discord.com') || host.includes('discord.gg')) return { label: 'Discord', Icon: MessageCircle };
  if (host.includes('twitch.tv')) return { label: 'Twitch', Icon: Twitch };
  if (host.includes('snapchat.com')) return { label: 'Snapchat', Icon: Ghost };
  if (host.includes('t.me') || host.includes('telegram')) return { label: 'Telegram', Icon: Send };

  return { label: host || 'Website', Icon: Globe };
};

const TextField: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}> = ({ label, value, placeholder, onChange, disabled }) => (
  <div className="space-y-2">
    <SmallLabel>{label}</SmallLabel>
    <input
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded px-3 py-2 text-sm text-[#e6e8ee] placeholder:text-[var(--ui-muted)]"
    />
  </div>
);

const IconCircleButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, onClick, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className="w-10 h-10 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] hover:border-[#e6e8ee] transition-colors flex items-center justify-center"
  >
    {children}
  </button>
);

const EmptyAvatar: React.FC<{ label?: string }> = ({ label }) => (
  <div className="w-full h-full flex flex-col items-center justify-center text-[var(--ui-muted)]">
    <UserIcon size={42} />
    <div className="mt-3 text-[11px] uppercase tracking-[0.25em]">No avatar</div>
    {label && <div className="mt-1 text-xs text-[var(--ui-muted)]">{label}</div>}
  </div>
);

const EmptyFullBody: React.FC = () => (
  <div className="w-full h-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] flex items-center justify-center">
    <div className="text-center text-[var(--ui-muted)]">
      <div className="mx-auto w-12 h-12 rounded-full border border-[var(--ui-border)] flex items-center justify-center">
        <UserIcon size={24} />
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-[0.25em]">No character image</div>
      <div className="mt-1 text-xs">Upload a full-body photo</div>
    </div>
  </div>
);

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-6" onMouseDown={onClose}>
    <div
      className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ui-border)]">
        <div className="text-xs uppercase tracking-[0.25em] text-[var(--ui-muted)]">{title}</div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] hover:border-[#e6e8ee] transition-colors flex items-center justify-center"
        >
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const Test01View: React.FC<Test01ViewProps> = ({
  players,
  onUpdatePlayer,
  onAddPlayer,
  onDeletePlayer,
  onGoToEarth,
  setToast,
  focusPlayerId,
  onClearFocusPlayer,
}) => {
  const { user } = useAuth();
  const [query, setQuery] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string>(() => players[0]?.id || 'me');
  const playerMediaInputRef = React.useRef<HTMLInputElement | null>(null);
  const viewerObjectUrlRef = React.useRef<string | null>(null);
  const [playerAttachments, setPlayerAttachments] = React.useState<AttachmentItem[]>([]);
  const [playerAttachmentsLoading, setPlayerAttachmentsLoading] = React.useState(false);
  const [playerAttachmentsUploading, setPlayerAttachmentsUploading] = React.useState(false);
  const [playerAttachmentsError, setPlayerAttachmentsError] = React.useState('');
  const [mediaViewerLoading, setMediaViewerLoading] = React.useState(false);
  const [mediaViewer, setMediaViewer] = React.useState<{
    item: AttachmentItem;
    sourceUrl: string | null;
    mime: string | null;
    missingLocal: boolean;
  } | null>(null);

  // modal state
  const [openModal, setOpenModal] = React.useState<null | 'gallery' | 'files'>(null);
  const [galleryIndex, setGalleryIndex] = React.useState(0);

  // Upload triggers
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const characterInputRef = React.useRef<HTMLInputElement | null>(null);

  // Cover preview fit mode (persisted)
  const [coverFit, setCoverFit] = React.useState<'contain' | 'cover'>(() => {
    const v = readUserScopedString('mp_coverFit', null);
    if (v === 'contain' || v === 'cover') return v;
    // default = stretch/fill
    return 'cover';
  });

  // Add-player modal
  const [addOpen, setAddOpen] = React.useState(false);
  const [addName, setAddName] = React.useState('');
  const [addRole, setAddRole] = React.useState('Operator');

  // Confirm modal (Yes/No)
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const confirmRef = React.useRef<{ title: string; body?: string; yesText?: string; noText?: string; onYes: () => void } | null>(null);

  // location search
  const [locQuery, setLocQuery] = React.useState('');
  const [locLoading, setLocLoading] = React.useState(false);
  const [locError, setLocError] = React.useState('');
  const [locResults, setLocResults] = React.useState<{ displayName: string; lat: number; lng: number }[]>([]);
  const [linkDraft, setLinkDraft] = React.useState('');
  const [linkError, setLinkError] = React.useState('');
  const [linkFormOpen, setLinkFormOpen] = React.useState(false);
  const [linksEditOpen, setLinksEditOpen] = React.useState(false);
  const [linkEdits, setLinkEdits] = React.useState<{ id: string; url: string }[]>([]);
  const linkInputRef = React.useRef<HTMLInputElement | null>(null);
  const linksSectionRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!players.find((p) => p.id === selectedId)) {
      setSelectedId(players[0]?.id || 'me');
    }
  }, [players, selectedId]);

  React.useEffect(() => {
    if (!focusPlayerId) return;
    const exists = players.find((p) => p.id === focusPlayerId);
    if (exists) {
      setSelectedId(focusPlayerId);
      setOpenModal(null);
    }
    onClearFocusPlayer?.();
  }, [focusPlayerId, players, onClearFocusPlayer]);

  const selected = players.find((p) => p.id === selectedId) || players[0];

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selected?.id) {
        setPlayerAttachments([]);
        return;
      }
      setPlayerAttachmentsLoading(true);
      setPlayerAttachmentsError('');
      try {
        const rows = await listAttachmentsForOwner('player', selected.id);
        if (!cancelled) setPlayerAttachments(rows);
      } catch (error) {
        console.warn('[multiplayer] Failed to load player attachments', error);
        if (!cancelled) {
          setPlayerAttachments([]);
          setPlayerAttachmentsError('Unable to load media');
        }
      } finally {
        if (!cancelled) setPlayerAttachmentsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, user?.id]);

  React.useEffect(() => {
    return () => {
      revokeAttachmentViewerUrl(viewerObjectUrlRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!selected) return;
    setLinkFormOpen(false);
    setLinksEditOpen(false);
    setLinkError('');
    setLinkDraft('');
    setLinkEdits((selected.links || []).map(link => ({ id: link.id, url: link.url })));
  }, [selected?.id, selected?.links]);

  // persist fit mode
  React.useEffect(() => {
    writeUserScopedString('mp_coverFit', coverFit);
  }, [coverFit]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = players.slice();
    if (!q) return list;
    return list.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.role || '').toLowerCase().includes(q));
  }, [players, query]);

  const update = (updates: Partial<Player>) => {
    if (!selected) return;
    onUpdatePlayer(selected.id, updates);
  };

  const refreshPlayerAttachments = async () => {
    if (!selected?.id) return;
    try {
      const rows = await listAttachmentsForOwner('player', selected.id);
      setPlayerAttachments(rows);
    } catch (error) {
      console.warn('[multiplayer] Failed to refresh player attachments', error);
    }
  };

  const addPlayerAttachment = async (file: File) => {
    if (!selected) return;
    setPlayerAttachmentsUploading(true);
    setPlayerAttachmentsError('');
    try {
      const row = await attachFileToOwner('player', selected.id, file, inferFileKindFromFile(file), file.name);
      setPlayerAttachments((prev) => [row, ...prev]);
      setToast('Media attached');
      await refreshPlayerAttachments();
    } catch (error) {
      console.warn('[multiplayer] Failed attaching player media', error);
      setPlayerAttachmentsError('Upload failed');
      setToast('Failed to attach media');
    } finally {
      setPlayerAttachmentsUploading(false);
      if (playerMediaInputRef.current) {
        playerMediaInputRef.current.value = '';
      }
    }
  };

  const openAttachmentViewer = async (attachment: AttachmentItem) => {
    setMediaViewerLoading(true);
    try {
      const source = await getAttachmentViewerSource(attachment);
      revokeAttachmentViewerUrl(viewerObjectUrlRef.current);
      viewerObjectUrlRef.current = source.url;
      setMediaViewer({
        item: attachment,
        sourceUrl: source.url,
        mime: source.mime,
        missingLocal: source.missingLocal,
      });
    } catch (error) {
      console.warn('[multiplayer] Failed opening attachment viewer', error);
      setMediaViewer({
        item: attachment,
        sourceUrl: null,
        mime: attachment.mime,
        missingLocal: true,
      });
    } finally {
      setMediaViewerLoading(false);
    }
  };

  const closeAttachmentViewer = () => {
    revokeAttachmentViewerUrl(viewerObjectUrlRef.current);
    viewerObjectUrlRef.current = null;
    setMediaViewer(null);
  };

  const deletePlayerAttachment = async (attachment: AttachmentItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await removeAttachment(attachment);
      setPlayerAttachments((prev) => prev.filter((row) => row.id !== attachment.id));
      if (mediaViewer?.item.id === attachment.id) {
        closeAttachmentViewer();
      }
      setToast('Media removed');
    } catch (error) {
      console.warn('[multiplayer] Failed deleting player attachment', error);
      setPlayerAttachmentsError('Delete failed');
      setToast('Failed to remove media');
    }
  };

  const addLink = () => {
    if (!selected) return;
    const normalized = normalizeUrl(linkDraft);
    if (!normalized) return;
    let parsed: URL | null = null;
    try {
      parsed = new URL(normalized);
    } catch {
      setLinkError('Enter a valid URL');
      return;
    }

    const next = (selected.links || []).slice();
    if (next.some(item => item.url === parsed!.toString())) {
      setLinkError('Link already added');
      return;
    }

    next.unshift({ id: `link-${Date.now()}`, url: parsed.toString() });
    update({ links: next });
    setLinkDraft('');
    setLinkError('');
    setLinkFormOpen(false);
    setLinkEdits(next.map(link => ({ id: link.id, url: link.url })));
  };

  const removeLink = (id: string) => {
    if (!selected) return;
    const next = (selected.links || []).filter(item => item.id !== id);
    update({ links: next });
    setLinkEdits(next.map(link => ({ id: link.id, url: link.url })));
  };

  const saveEditedLink = (id: string) => {
    if (!selected) return;
    const edit = linkEdits.find(item => item.id === id);
    if (!edit) return;
    const normalized = normalizeUrl(edit.url);
    if (!normalized) {
      removeLink(id);
      return;
    }
    let parsed: URL | null = null;
    try {
      parsed = new URL(normalized);
    } catch {
      setLinkError('Enter a valid URL');
      return;
    }
    const next = (selected.links || []).map(item => (item.id === id ? { ...item, url: parsed!.toString() } : item));
    update({ links: next });
    setLinkError('');
    setLinkEdits(next.map(link => ({ id: link.id, url: link.url })));
  };

  const pngHasTransparency = async (file: File) => {
    try {
      const bmp = await createImageBitmap(file);
      const w = Math.min(256, bmp.width);
      const h = Math.min(256, bmp.height);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true } as any);
      if (!ctx) return false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      for (let i = 3; i < data.length; i += 4 * 4) {
        if (data[i] < 255) return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // If user uploads a "transparent" asset but it still has a black matte baked in,
  // remove near-black pixels connected to the image edges (simple flood-fill).
  const removeEdgeBlackMatteToPngDataUrl = async (file: File, threshold = 18) => {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true } as any);
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0);

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    const w = canvas.width;
    const h = canvas.height;

    const idx = (x: number, y: number) => (y * w + x) * 4;
    const isNearBlack = (i: number) => {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      if (a === 0) return false;
      return r <= threshold && g <= threshold && b <= threshold;
    };

    const seen = new Uint8Array(w * h);
    const qx: number[] = [];
    const qy: number[] = [];

    const push = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const p = y * w + x;
      if (seen[p]) return;
      const i = idx(x, y);
      if (!isNearBlack(i)) return;
      seen[p] = 1;
      qx.push(x);
      qy.push(y);
    };

    // seed from edges
    for (let x = 0; x < w; x++) {
      push(x, 0);
      push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      push(0, y);
      push(w - 1, y);
    }

    while (qx.length) {
      const x = qx.pop()!;
      const y = qy.pop()!;
      const i = idx(x, y);
      // make transparent
      d[i + 3] = 0;
      // BFS
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }

    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  };

  const uploadAvatar = async (file: File) => {
    if (!selected) return;

    const type = (file.type || '').toLowerCase();
    const isPng = type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    const isGif = type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
    const isJpeg = type === 'image/jpeg' || type === 'image/jpg' || /\.(jpe?g)$/i.test(file.name);

    let dataUrl: string | null = null;

    if (isPng) {
      // Preserve alpha, and also strip black matte connected to edges if present.
      // (This fixes "transparent" exports that still have a black box baked in.)
      const fixed = await removeEdgeBlackMatteToPngDataUrl(file);
      if (!fixed) {
        const hasAlpha = await pngHasTransparency(file);
        if (!hasAlpha) {
          setToast('PNG must be transparent (no background).');
          return;
        }
        dataUrl = await readFileAsDataUrl(file);
      } else {
        dataUrl = fixed;
      }
    } else if (isGif) {
      dataUrl = await readFileAsDataUrl(file);
    } else if (isJpeg) {
      // JPEG is fine to compress
      dataUrl = await readImageCompressedDataUrl(file, { maxSize: 768, quality: 0.9, mimeType: 'image/jpeg' });
    } else {
      // keep existing behavior for other image types
      dataUrl = await readImageCompressedDataUrl(file, { maxSize: 768, quality: 0.9 });
    }

    update({ avatar: dataUrl || undefined });
    setToast('Avatar updated');
  };

  const uploadFullBody = async (file: File) => {
    if (!selected) return;

    const type = (file.type || '').toLowerCase();
    const isVideo = type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name);
    const isPng = type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    const isGif = type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

    if (isVideo) {
      // Avoid base64 localStorage crashes: use blob URL
      const url = URL.createObjectURL(file);
      update({ fullBodyImage: url, fullBodyType: 'video' });
      setToast('Cover video updated (won\'t persist after refresh yet)');
      return;
    }

    if (isPng) {
      // Preserve alpha, and also strip black matte connected to edges if present.
      const fixed = await removeEdgeBlackMatteToPngDataUrl(file);
      let dataUrl: string | null = fixed;

      if (!dataUrl) {
        const hasAlpha = await pngHasTransparency(file);
        if (!hasAlpha) {
          setToast('PNG must be transparent (no background).');
          return;
        }
        dataUrl = await readFileAsDataUrl(file);
      }

      update({ fullBodyImage: dataUrl, fullBodyType: 'image' });
      setToast('Cover updated');
      return;
    }

    if (isGif) {
      const dataUrl = await readFileAsDataUrl(file);
      update({ fullBodyImage: dataUrl, fullBodyType: 'image' });
      setToast('Cover updated');
      return;
    }

    // Default: compress to JPEG
    const dataUrl = await readImageCompressedDataUrl(file, { maxSize: 1400, quality: 0.9, mimeType: 'image/jpeg' });
    update({ fullBodyImage: dataUrl, fullBodyType: 'image' });
    setToast('Cover updated');
  };

  const addGalleryImage = async (file: File) => {
    if (!selected) return;

    const type = (file.type || '').toLowerCase();
    const isPng = type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    const isGif = type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

    let dataUrl: string | null = null;
    if (isPng) {
      const hasAlpha = await pngHasTransparency(file);
      if (!hasAlpha) {
        setToast('PNG must be transparent (no background).');
        return;
      }
      dataUrl = await readFileAsDataUrl(file);
    } else if (isGif) {
      dataUrl = await readFileAsDataUrl(file);
    } else {
      dataUrl = await readImageCompressedDataUrl(file, { maxSize: 1280, quality: 0.9, mimeType: 'image/jpeg' });
    }

    update({ gallery: [dataUrl, ...(selected.gallery || [])] });
    setToast('Added to gallery');
  };

  const addFile = async (file: File) => {
    if (!selected) return;
    const dataUrl = await readFileAsDataUrl(file);
    const item = {
      id: `f-${Date.now()}`,
      name: file.name || 'file',
      mimeType: file.type || 'application/octet-stream',
      dataUrl,
      addedAt: Date.now(),
    };
    update({ files: [item, ...(selected.files || [])] });
    setToast('File added');
  };

  // location search debounce
  React.useEffect(() => {
    const q = locQuery.trim();
    if (!q) {
      setLocResults([]);
      setLocError('');
      return;
    }
    const t = window.setTimeout(async () => {
      setLocLoading(true);
      setLocError('');
      try {
        const res = await nominatimSearch(q, 6);
        setLocResults(res);
      } catch (e: any) {
        setLocError(e?.message || 'Search failed');
        setLocResults([]);
      } finally {
        setLocLoading(false);
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [locQuery]);

  const setLocationFromResult = (r: { displayName: string; lat: number; lng: number }) => {
    if (!selected) return;

    const parts = r.displayName.split(',').map((s) => s.trim()).filter(Boolean);
    const cityOrPlace = parts[0] || r.displayName;
    const region = parts.length >= 3 ? parts[1] : '';
    const country = parts.length >= 2 ? parts[parts.length - 1] : '';
    const label = [cityOrPlace, region, country].filter(Boolean).join(', ');

    // Clear input + suggestions after selection
    setLocQuery('');
    setLocResults([]);
    setLocError('');

    const tz = timeZoneFromLatLng(r.lat, r.lng);
    const offset = tz ? utcOffsetMinutesForTimeZone(tz) : null;

    update({
      location: { lat: r.lat, lng: r.lng, label },
      timeZone: tz || undefined,
      utcOffsetMinutes: typeof offset === 'number' ? offset : undefined,
    });
    setToast('Location updated');
  };

  const gallery = selected?.gallery || [];
  const files = selected?.files || [];
  const attachmentMedia = playerAttachments.filter((entry) => entry.kind === 'image' || entry.kind === 'video');
  const attachmentFiles = playerAttachments.filter((entry) => entry.kind === 'file');

  return (
    <div className="grid grid-cols-[300px,420px,1fr,240px] gap-6 items-start">
      {/* Left list */}
      <div className="border border-[var(--ui-border)] bg-[var(--ui-panel)] rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-220px)]">
        <div className="p-4 border-b border-[var(--ui-border)]">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded-xl px-10 py-3 text-sm text-[#e6e8ee] placeholder:text-[var(--ui-muted)]"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-muted)]" />
            </div>
            <button
              type="button"
              className="w-11 h-11 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] hover:border-[#e6e8ee] transition-colors flex items-center justify-center"
              title="Add player"
              onClick={() => {
                setAddName('');
                setAddRole('Operator');
                setAddOpen(true);
              }}
            >
              <Plus size={18} />
            </button>

          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto pb-24">
          {filtered.map((p) => {
            const active = p.id === selectedId;
            const linkIcons = (p.links || []).slice(0, 4).map(link => {
              const meta = getLinkMeta(link.url);
              return meta.Icon;
            });
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedId(p.id);
                  setOpenModal(null);
                }}
                className={
                  'w-full text-left px-4 py-3 border-b border-[var(--ui-border)] transition-colors ' +
                  (active ? 'bg-[var(--ui-panel)]' : 'hover:bg-[var(--ui-panel)]')
                }
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] overflow-hidden flex items-center justify-center text-[11px] text-[var(--ui-muted)]">
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{p.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#e6e8ee] truncate">{p.name}</div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--ui-muted)] truncate">{p.role}</div>
                    <div className="mt-2 flex items-center gap-1">
                  {linkIcons.length ? (
                    linkIcons.map((Icon, idx) => (
                      <span
                        key={`${p.id}-link-${idx}`}
                        className="w-6 h-6 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] flex items-center justify-center text-[var(--ui-muted)]"
                      >
                        <Icon size={12} />
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] text-[var(--ui-muted)]">No links</span>
                  )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {!filtered.length && <div className="p-4 text-sm text-[var(--ui-muted)]">No results</div>}
        </div>
      </div>

      {/* Middle info panel */}
      <div className="space-y-5 max-h-[calc(100vh-220px)] overflow-auto pr-2">
        <div className="relative rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5">
          <button
            type="button"
            title="Add player link"
            onClick={() => {
              setLinkFormOpen(true);
              requestAnimationFrame(() => linkInputRef.current?.focus());
              linksSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] hover:border-[#e6e8ee] transition-colors shadow-sm"
          >
            <Globe size={16} />
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Links</span>
            <span className="ml-1 w-5 h-5 rounded-full bg-[#f46a2e] text-white flex items-center justify-center text-[11px]">
              <Plus size={12} />
            </span>
          </button>
          <div className="flex items-start gap-3">
            {/* Avatar block fills the available space */}
            <div className="relative flex-1 w-full aspect-square rounded-lg border border-[var(--ui-border)] overflow-hidden bg-white">
              {selected?.avatar ? (
                <img src={selected.avatar} alt={selected.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--ui-muted)]">
                  <EmptyAvatar label="Upload a profile picture" />
                </div>
              )}

              <button
                type="button"
                className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full border border-white/25 bg-black/35 backdrop-blur-sm hover:bg-black/55 hover:border-white/40 transition-all flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                title="Change avatar"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Plus size={18} className="text-white" />
              </button>
            </div>

            {/* Hidden inputs (triggered by the + overlays) */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                await uploadAvatar(f);
                e.currentTarget.value = '';
              }}
            />

            <input
              ref={characterInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                await uploadFullBody(f);
                e.currentTarget.value = '';
              }}
            />
          </div>

          <div className="mt-5 space-y-4">
            <TextField label="Name" value={selected?.name || ''} onChange={(v) => update({ name: v })} />
            <TextField label="Role" value={selected?.role || ''} onChange={(v) => update({ role: v })} />
            <TextField label="ID" value={selected?.id || ''} onChange={() => {}} disabled />

            <TextField label="Email" value={selected?.email || ''} onChange={(v) => update({ email: v })} placeholder="name@email.com" />
            <TextField label="Phone" value={selected?.phone || ''} onChange={(v) => update({ phone: v })} placeholder="+62…" />

            {/* Functional location section (search -> pick result -> sets lat/lng/label + timezone) */}
            <div className="space-y-2">
              <SmallLabel>Location (search)</SmallLabel>
              <input
                value={locQuery}
                onChange={(e) => setLocQuery(e.target.value)}
                placeholder="Search city / place…"
                className="w-full bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded px-3 py-2 text-sm text-[#e6e8ee] placeholder:text-[var(--ui-muted)]"
              />
              {locLoading && <div className="text-[11px] text-[var(--ui-muted)]">Searching…</div>}
              {locError && <div className="text-[11px] text-[var(--ui-accent)]">{locError}</div>}
              {!!locResults.length && (
                <div className="border border-[var(--ui-border)] rounded overflow-hidden">
                  {locResults.map((r, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-[#171b22] border-b border-[var(--ui-border)] last:border-b-0"
                      onClick={() => setLocationFromResult(r)}
                    >
                      {(() => {
                        const parts = r.displayName.split(',').map(s => s.trim()).filter(Boolean);
                        const title = parts[0] || r.displayName;
                        const subtitle = parts.slice(1).join(', ');
                        return (
                          <>
                            <div className="text-sm text-[#e6e8ee] font-semibold truncate">{title}</div>
                            <div className="text-[11px] text-[var(--ui-muted)] truncate">{subtitle}</div>
                          </>
                        );
                      })()}
                    </button>
                  ))}
                </div>
              )}

              {selected?.location && (
                <button
                  type="button"
                  className="w-full text-left border border-[var(--ui-border)] bg-[var(--ui-panel)] rounded px-3 py-2 hover:border-[#e6e8ee] transition-colors"
                  onClick={() => {
                    onGoToEarth({
                      playerId: selected.id,
                      loc: {
                        lat: selected.location!.lat,
                        lng: selected.location!.lng,
                        label: selected.location!.label,
                      },
                    });
                    setToast('Opened on map');
                  }}
                  title="View on map"
                >
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--ui-muted)]">Location</div>
                  <div className="text-sm text-[#e6e8ee] font-semibold truncate">{selected.location.label || 'Saved location'}</div>
                  <div className="text-[11px] text-[var(--ui-muted)]">{selected.location.lat.toFixed(5)}, {selected.location.lng.toFixed(5)}{selected.timeZone ? ` • ${selected.timeZone}` : ''}</div>
                </button>
              )}
            </div>

            {/* Danger zone */}
            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!selected) return;
                  if (selected.id === 'me') return setToast('Cannot delete Admin');

                  confirmRef.current = {
                    title: 'Remove player?',
                    body: `Are you sure you want to remove: ${selected.name}?`,
                    yesText: 'Yes',
                    noText: 'No',
                    onYes: () => {
                      onDeletePlayer(selected.id);
                      setConfirmOpen(false);
                    },
                  };
                  setConfirmOpen(true);
                }}
                className="px-4 py-2 rounded-lg border border-[#5b1a1a] text-[#f5b3b3] text-[11px] uppercase tracking-[0.2em] hover:border-[#ff4d4d] hover:text-white transition-colors"
                title="Delete player"
              >
                Delete Player
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cover stage */}
      <div className="relative">
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            type="button"
            className="w-11 h-11 rounded-full border border-white/25 bg-black/35 backdrop-blur-sm hover:bg-black/55 hover:border-white/40 transition-all flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            title={coverFit === 'contain' ? 'Fill (crop)' : 'Fit'}
            onClick={() => setCoverFit(v => (v === 'contain' ? 'cover' : 'contain'))}
          >
            <Scan size={18} className="text-white" />
          </button>

          <button
            type="button"
            className="w-11 h-11 rounded-full border border-white/25 bg-black/35 backdrop-blur-sm hover:bg-black/55 hover:border-white/40 transition-all flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            title="Change character"
            onClick={() => characterInputRef.current?.click()}
          >
            <Plus size={18} className="text-white" />
          </button>
        </div>

        <div className="w-full aspect-video rounded-2xl border border-[var(--ui-border)] bg-white overflow-hidden flex items-center justify-center">
          {selected?.fullBodyImage ? (
            selected.fullBodyType === 'video' || selected.fullBodyImage.startsWith('data:video') ? (
              <video
                src={selected.fullBodyImage}
                className={`w-full h-full ${coverFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                controls
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={selected.fullBodyImage}
                alt="Cover"
                className={`w-full h-full ${coverFit === 'contain' ? 'object-contain' : 'object-cover'}`}
              />
            )
          ) : (
            <EmptyFullBody />
          )}
        </div>
      </div>

      {/* Right tools */}
      <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-auto pr-2">
        <div className="flex items-center justify-end gap-3 flex-wrap">
          {/* Email */}
          {selected?.email ? (
            <IconCircleButton
              title="Email"
              onClick={() => {
                window.location.href = `mailto:${selected.email}`;
              }}
            >
              <Mail size={18} />
            </IconCircleButton>
          ) : null}

          {/* WhatsApp (from socials.whatsapp or phone) */}
          {selected?.socials?.whatsapp || selected?.phone ? (
            <IconCircleButton
              title="WhatsApp"
              onClick={() => {
                const v = (selected?.socials?.whatsapp || selected?.phone || '').toString();
                const clean = v.replace(/[^0-9]/g, '');
                window.open(`https://wa.me/${clean}`, '_blank');
              }}
            >
              <MessageCircle size={18} />
            </IconCircleButton>
          ) : null}

          {/* YouTube */}
          {(selected?.socials?.youtube || selected?.socials?.linkedin) ? (
            <IconCircleButton
              title="YouTube"
              onClick={() => window.open((selected.socials?.youtube || selected.socials?.linkedin) as string, '_blank')}
            >
              <Youtube size={18} />
            </IconCircleButton>
          ) : null}

          {/* Instagram */}
          {selected?.socials?.instagram ? (
            <IconCircleButton title="Instagram" onClick={() => window.open(selected.socials!.instagram as string, '_blank')}>
              <Instagram size={18} />
            </IconCircleButton>
          ) : null}

          {/* TikTok (no lucide tiktok icon; use Music2 as placeholder) */}
          {selected?.socials?.tiktok ? (
            <IconCircleButton title="TikTok" onClick={() => window.open(selected.socials!.tiktok as string, '_blank')}>
              <Music2 size={18} />
            </IconCircleButton>
          ) : null}

          {/* Facebook */}
          {selected?.socials?.facebook ? (
            <IconCircleButton title="Facebook" onClick={() => window.open(selected.socials!.facebook as string, '_blank')}>
              <Facebook size={18} />
            </IconCircleButton>
          ) : null}

          {/* LinkedIn */}
          {selected?.socials?.linkedin ? (
            <IconCircleButton title="LinkedIn" onClick={() => window.open(selected.socials!.linkedin as string, '_blank')}>
              <Linkedin size={18} />
            </IconCircleButton>
          ) : null}

          {/* X */}
          {(selected?.socials?.x || selected?.socials?.twitter) ? (
            <IconCircleButton title="X" onClick={() => window.open((selected.socials?.x || selected.socials?.twitter) as string, '_blank')}>
              <Twitter size={18} />
            </IconCircleButton>
          ) : null}

          {/* Telegram */}
          {(selected?.socials?.telegram || selected?.socials?.twitter) ? (
            <IconCircleButton title="Telegram" onClick={() => window.open((selected.socials?.telegram || selected.socials?.twitter) as string, '_blank')}>
              <Send size={18} />
            </IconCircleButton>
          ) : null}
        </div>

        {/* Cloud/local attachment media */}
        <div className="border border-[var(--ui-border)] bg-[var(--ui-panel)] rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <SmallLabel>Media</SmallLabel>
            <button
              type="button"
              className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 text-[var(--ui-muted)] hover:text-white hover:border-[#e6e8ee] disabled:opacity-60"
              onClick={() => playerMediaInputRef.current?.click()}
              disabled={playerAttachmentsUploading || !selected}
            >
              <Upload size={12} />
              {playerAttachmentsUploading ? 'Uploading...' : 'Add Media'}
            </button>
          </div>
          <div className="mt-1 text-[11px] text-[var(--ui-muted)]">
            {user ? 'Cloud thumbnails + local heavy files' : 'Local-only media (sign in to sync thumbnails)'}
          </div>
          <input
            ref={playerMediaInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              await addPlayerAttachment(f);
              e.currentTarget.value = '';
            }}
          />
          {playerAttachmentsError ? (
            <div className="mt-3 text-[11px] text-[#f46a2e]">{playerAttachmentsError}</div>
          ) : null}
          {playerAttachmentsLoading ? (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--ui-muted)]">
              <Loader2 size={12} className="animate-spin" />
              Loading media...
            </div>
          ) : playerAttachments.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {playerAttachments.slice(0, 9).map((entry) => (
                <div
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openAttachmentViewer(entry)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openAttachmentViewer(entry);
                    }
                  }}
                  className="group relative aspect-square rounded-lg border border-[var(--ui-border)] bg-[var(--ui-panel)] overflow-hidden hover:border-[#e6e8ee] transition-colors cursor-pointer"
                >
                  {entry.thumbUrl ? (
                    <img src={entry.thumbUrl} alt={entry.title || 'Attachment'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">
                      No thumb
                    </div>
                  )}
                  <div className="absolute left-1 bottom-1 px-1.5 py-0.5 rounded bg-black/70 text-[8px] uppercase tracking-[0.15em] text-white">
                    {entry.localOnly ? 'local' : 'cloud'}
                  </div>
                  {entry.syncPending ? (
                    <div className="absolute right-1 bottom-1 px-1.5 py-0.5 rounded bg-[#f46a2e]/85 text-[8px] uppercase tracking-[0.15em] text-black">
                      syncing
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={(event) => deletePlayerAttachment(entry, event)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full border border-white/15 bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete media"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-[11px] text-[var(--ui-muted)]">No media attached yet.</div>
          )}
          <div className="mt-2 text-[11px] text-[var(--ui-muted)]">
            {attachmentMedia.length} media • {attachmentFiles.length} files
          </div>
        </div>

        {/* Files card */}
        <div className="border border-[var(--ui-border)] bg-[var(--ui-panel)] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <SmallLabel>Files</SmallLabel>
            <label className="cursor-pointer inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 text-[var(--ui-muted)] hover:text-white hover:border-[#e6e8ee]">
              <Upload size={12} />
              Upload
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  await addFile(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          <button
            type="button"
            className="mt-3 w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 hover:border-[#e6e8ee] transition-colors"
            onClick={() => {
              if (!files.length) return setToast('No files yet');
              setOpenModal('files');
            }}
          >
            <div className="w-14 h-14 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] flex items-center justify-center mx-auto">
              <FileIcon size={22} />
            </div>
            <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-[#e6e8ee]">Open Files</div>
            <div className="mt-1 text-[11px] text-[var(--ui-muted)]">{files.length} items</div>
          </button>
        </div>

        {/* Gallery card */}
        <div className="border border-[var(--ui-border)] bg-[var(--ui-panel)] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <SmallLabel>Gallery</SmallLabel>
            <label className="cursor-pointer inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 text-[var(--ui-muted)] hover:text-white hover:border-[#e6e8ee]">
              <Upload size={12} />
              Upload
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  await addGalleryImage(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          {/* previews */}
          {gallery.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {gallery.slice(0, 6).map((src, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setGalleryIndex(idx);
                    setOpenModal('gallery');
                  }}
                  className="aspect-square rounded-lg overflow-hidden border border-[var(--ui-border)] hover:border-[#e6e8ee] transition-colors"
                  title="Open"
                >
                  <img src={src} alt={`gallery-${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="mt-3 w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 hover:border-[#e6e8ee] transition-colors"
              onClick={() => setToast('Upload images to gallery')}
            >
              <div className="w-14 h-14 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] flex items-center justify-center mx-auto">
                <ImageIcon size={22} />
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-[#e6e8ee]">Add Images</div>
              <div className="mt-1 text-[11px] text-[var(--ui-muted)]">No images yet</div>
            </button>
          )}

          {gallery.length > 6 && <div className="mt-2 text-[11px] text-[var(--ui-muted)]">+{gallery.length - 6} more</div>}
        </div>

        {/* Links card */}
        <div ref={linksSectionRef} className="border border-[var(--ui-border)] bg-[var(--ui-panel)] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <SmallLabel>Links</SmallLabel>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLinkFormOpen(true);
                  setLinksEditOpen(false);
                  requestAnimationFrame(() => linkInputRef.current?.focus());
                }}
                className="text-[10px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 text-[var(--ui-muted)] hover:text-white hover:border-[#e6e8ee]"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinksEditOpen(v => !v);
                  if (!linksEditOpen) {
                    setLinkEdits((selected?.links || []).map(link => ({ id: link.id, url: link.url })));
                  }
                  setLinkFormOpen(false);
                }}
                className="text-[10px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 text-[var(--ui-muted)] hover:text-white hover:border-[#e6e8ee]"
              >
                {linksEditOpen ? 'Done' : 'Edit'}
              </button>
            </div>
          </div>

          {linkError && <div className="mt-2 text-[11px] text-[#f46a2e]">{linkError}</div>}

          {!linksEditOpen ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {(selected?.links || []).map(link => {
                const meta = getLinkMeta(link.url);
                const Icon = meta.Icon;
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => window.open(link.url, '_blank')}
                    title={link.label || meta.label}
                    className="w-10 h-10 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] flex items-center justify-center hover:border-[#e6e8ee] transition-colors"
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
              {!selected?.links?.length && (
                <div className="text-[11px] text-[var(--ui-muted)]">No links added yet.</div>
              )}
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              {linkEdits.map(link => {
                const meta = getLinkMeta(link.url || '');
                const Icon = meta.Icon;
                return (
                  <div
                    key={link.id}
                    className="border border-[var(--ui-border)] rounded-xl px-3 py-3 space-y-2 min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] flex items-center justify-center">
                        <Icon size={16} />
                      </div>
                      <div className="text-[10px] text-[var(--ui-muted)]">Edit link</div>
                    </div>
                    <input
                      value={link.url}
                      onChange={(e) => {
                        setLinkEdits(prev => prev.map(item => (item.id === link.id ? { ...item, url: e.target.value } : item)));
                        setLinkError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditedLink(link.id);
                      }}
                      className="w-full bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded px-3 py-2 text-sm text-[#e6e8ee] placeholder:text-[var(--ui-muted)]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => saveEditedLink(link.id)}
                        className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-[11px] uppercase tracking-[0.15em] text-[var(--ui-muted)] hover:text-white hover:border-[#e6e8ee]"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLink(link.id)}
                        className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-[11px] uppercase tracking-[0.15em] text-[var(--ui-muted)] hover:text-white hover:border-[#e6e8ee]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              {!linkEdits.length && (
                <div className="text-[11px] text-[var(--ui-muted)]">No links added yet.</div>
              )}
            </div>
          )}

          {linkFormOpen && (
            <div className="mt-4 flex flex-col gap-2">
              <input
                ref={linkInputRef}
                value={linkDraft}
                onChange={(e) => {
                  setLinkDraft(e.target.value);
                  setLinkError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addLink();
                }}
                placeholder="https://example.com"
                className="w-full bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded px-3 py-2 text-sm text-[#e6e8ee] placeholder:text-[var(--ui-muted)]"
              />
              <button
                type="button"
                onClick={addLink}
                className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-[11px] uppercase tracking-[0.15em] text-[var(--ui-muted)] hover:text-white hover:border-[#e6e8ee]"
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Gallery modal */}
      {openModal === 'gallery' && (
        <ModalShell
          title={`Gallery • ${gallery.length} images`}
          onClose={() => setOpenModal(null)}
        >
          <div className="grid grid-cols-[260px,1fr] h-[80vh]">
            <div className="border-r border-[var(--ui-border)] p-4 overflow-auto">
              <div className="grid grid-cols-2 gap-2">
                {gallery.map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={
                      'aspect-square rounded-lg overflow-hidden border transition-colors ' +
                      (idx === galleryIndex ? 'border-[var(--ui-accent)]' : 'border-[var(--ui-border)] hover:border-[#e6e8ee]')
                    }
                    onClick={() => setGalleryIndex(idx)}
                  >
                    <img src={src} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 flex items-center justify-center bg-black">
              {gallery[galleryIndex] ? (
                <img src={gallery[galleryIndex]} className="max-h-full max-w-full object-contain" alt="preview" />
              ) : (
                <div className="text-[var(--ui-muted)]">No image</div>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {/* Files modal */}
      {openModal === 'files' && (
        <ModalShell title={`Files • ${files.length} items`} onClose={() => setOpenModal(null)}>
          <div className="grid grid-cols-[340px,1fr] h-[80vh]">
            <div className="border-r border-[var(--ui-border)] p-4 overflow-auto">
              <div className="space-y-2">
                {files.map((f) => (
                  <div key={f.id} className="border border-[var(--ui-border)] bg-[var(--ui-panel)] rounded-xl px-3 py-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-panel)] flex items-center justify-center">
                      <FileIcon size={18} className="text-[var(--ui-muted)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[#e6e8ee] truncate">{f.name}</div>
                      <div className="text-[11px] text-[var(--ui-muted)] truncate">{f.mimeType}</div>
                    </div>
                    <a
                      className="text-[10px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 text-[var(--ui-muted)] hover:text-white hover:border-[#e6e8ee]"
                      href={f.dataUrl}
                      download={f.name}
                    >
                      Download
                    </a>
                  </div>
                ))}
                {!files.length && <div className="text-sm text-[var(--ui-muted)]">No files</div>}
              </div>
            </div>
            <div className="p-6">
              <div className="text-sm text-[var(--ui-muted)]">Files preview can be added next (PDF/image render). For now you can download any file.</div>
              <div className="mt-4 border border-[var(--ui-border)] bg-[var(--ui-panel)] rounded-xl p-4">
                <SmallLabel>Add file</SmallLabel>
                <label className="mt-3 inline-flex items-center gap-2 cursor-pointer text-[10px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-3 py-2 text-[var(--ui-muted)] hover:text-white hover:border-[#e6e8ee]">
                  <Upload size={12} /> Upload
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      await addFile(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      {mediaViewer && (
        <ModalShell title={`Media • ${mediaViewer.item.title || 'Attachment'}`} onClose={closeAttachmentViewer}>
          <div className="h-[80vh] p-4 bg-[var(--ui-bg)] flex items-center justify-center">
            {mediaViewerLoading ? (
              <div className="flex items-center gap-2 text-[var(--ui-muted)] text-sm">
                <Loader2 size={16} className="animate-spin" />
                Loading media...
              </div>
            ) : mediaViewer.sourceUrl ? (
              mediaViewer.mime?.startsWith('video/') ? (
                <video src={mediaViewer.sourceUrl} controls className="max-h-full max-w-full rounded-xl border border-[var(--ui-border)]" />
              ) : mediaViewer.mime?.startsWith('image/') || !mediaViewer.mime ? (
                <img src={mediaViewer.sourceUrl} alt={mediaViewer.item.title || 'Attachment'} className="max-h-full max-w-full object-contain rounded-xl border border-[var(--ui-border)]" />
              ) : (
                <a
                  href={mediaViewer.sourceUrl}
                  download={mediaViewer.item.title || 'attachment'}
                  className="px-4 py-2 rounded border border-[var(--ui-border)] text-[11px] uppercase tracking-[0.2em] hover:border-white"
                >
                  Download file
                </a>
              )
            ) : (
              <div className="text-center">
                <div className="text-sm text-[var(--ui-muted)]">
                  {mediaViewer.missingLocal
                    ? 'Heavy file is local-only and not available on this device.'
                    : 'Preview unavailable.'}
                </div>
                {mediaViewer.item.thumbUrl ? (
                  <img
                    src={mediaViewer.item.thumbUrl}
                    alt="Thumb preview"
                    className="mt-4 w-40 h-40 object-cover rounded-xl border border-[var(--ui-border)] mx-auto"
                  />
                ) : null}
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {/* Add player modal (replaces browser prompt) */}
      {addOpen && (
        <div className="fixed inset-0 z-[250] bg-black/60 flex items-center justify-center p-6" onMouseDown={() => setAddOpen(false)}>
          <div className="w-full max-w-xl" onMouseDown={(e) => e.stopPropagation()}>
            <HexPanel>
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-[var(--ui-muted)]">Add Player</div>
                    <div className="text-sm text-[var(--ui-muted)]">Create a new player profile.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="w-10 h-10 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] hover:border-white transition-colors flex items-center justify-center"
                    title="Close"
                  >
                    <X size={16} className="text-[var(--ui-muted)]" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <TextField label="Name" value={addName} onChange={setAddName} placeholder="Player name" />
                  <TextField label="Role" value={addRole} onChange={setAddRole} placeholder="Operator / Recon / Support" />
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <HexButton variant="secondary" onClick={() => setAddOpen(false)}>
                    Cancel
                  </HexButton>
                  <HexButton
                    variant="primary"
                    onClick={() => {
                      const name = addName.trim();
                      if (!name) {
                        setToast('Name is required');
                        return;
                      }
                      onAddPlayer({
                        name,
                        role: addRole.trim() || 'Operator',
                        accepted: true,
                        permissions: {
                          profileLevel: 'details',
                          location: 'off',
                          pinVisibility: 'specific',
                          rankVisibility: true,
                          appearsInRank: true,
                          closeCircle: true,
                        },
                      });
                      setAddOpen(false);
                      setToast('Player added');
                    }}
                  >
                    Create
                  </HexButton>
                </div>
              </div>
            </HexPanel>
          </div>
        </div>
      )}

      {/* Confirm modal (replaces browser confirm) */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[260] bg-black/60 flex items-center justify-center p-6"
          onMouseDown={() => setConfirmOpen(false)}
        >
          <div className="w-full max-w-xl" onMouseDown={(e) => e.stopPropagation()}>
            <HexPanel>
              <div className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-[var(--ui-muted)]">{confirmRef.current?.title || 'Confirm'}</div>
                    {confirmRef.current?.body && <div className="mt-2 text-sm text-[var(--ui-muted)]">{confirmRef.current.body}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    className="w-10 h-10 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] hover:border-white transition-colors flex items-center justify-center"
                    title="Close"
                  >
                    <X size={16} className="text-[var(--ui-muted)]" />
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <HexButton variant="secondary" onClick={() => setConfirmOpen(false)}>
                    {confirmRef.current?.noText || 'No'}
                  </HexButton>
                  <HexButton
                    variant="primary"
                    onClick={() => {
                      confirmRef.current?.onYes?.();
                    }}
                  >
                    {confirmRef.current?.yesText || 'Yes'}
                  </HexButton>
                </div>
              </div>
            </HexPanel>
          </div>
        </div>
      )}
    </div>
  );
};
