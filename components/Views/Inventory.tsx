
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    Plus, Trash2, Upload, Box, Wrench, Shirt, Cpu, Loader2, X,
    Send, Archive, RotateCcw, FolderOpen,
    BookOpen, Coffee, Gem,
} from 'lucide-react';
import { playClickSound, playHoverSound, playSuccessSound, playErrorSound } from '../../utils/SoundEffects';
import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabaseClient';
import type { UserFileRow } from '../../src/lib/attachments/types';
import { useXP } from '../XP/xpStore';
import type { InventoryCategory, InventorySlot, SelfTreeBranch } from '../XP/xpTypes';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import {
    getActiveCapabilityItems,
    assignCapabilityItemsToLoadoutSlots,
    summarizeCapabilityLoadoutAssignments,
} from '../../src/inventory/models';
import type { InventoryCapabilityItem, InventoryCapabilityLoadoutSlot } from '../../src/inventory/models';
import { useOptionalPresentationEvents } from '../../src/presentation/PresentationEventsProvider';
import { openDuskBrief } from '../../src/dusk/bridge';

// ─── Types ────────────────────────────────────────────────────────────────────

type InventoryAttachment = UserFileRow & { thumbUrl: string | null };

type UnifiedItem = {
    id: string;
    source: 'cloud' | 'ledger' | 'capability';
    category: InventoryCategory;
    name: string;
    thumbUrl?: string;
    importance?: 'low' | 'medium' | 'high' | 'critical';
    tier?: import('../XP/xpTypes').InventoryTier;
    subtype?: string;
    quantity?: number;
    externalLink?: string;
    mediaUrl?: string;
    details?: string;
    selfTreeBranch?: SelfTreeBranch;
    linkedProjectIds?: string[];
    archivedAt?: number;
    cloudRow?: InventoryAttachment;
    ledgerSlot?: InventorySlot;
    capabilityItem?: InventoryCapabilityItem;
    createdAt?: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_CATS: InventoryCategory[] = ['APPAREL', 'EQUIPMENT', 'TOOLS', 'LIBRARY', 'CONSUMABLES', 'VALUABLES', 'MISC'];
const GRID_COLS = 4;
const EMPTY_SLOTS = 16;

const catIcons: Record<InventoryCategory, React.FC<{ size?: number; className?: string }>> = {
    APPAREL: Shirt, EQUIPMENT: Cpu, TOOLS: Wrench,
    LIBRARY: BookOpen, CONSUMABLES: Coffee, VALUABLES: Gem, MISC: Box,
};
const catKey = (c: InventoryCategory) => c.toLowerCase() as Lowercase<InventoryCategory>;

const TIER_LABELS: Record<number, string> = { 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Epic', 5: 'Legendary' };
const TIER_COLORS: Record<number, string> = {
    1: '#9ca3af', 2: '#34d399', 3: '#60a5fa', 4: '#c084fc', 5: '#f59e0b',
};
const LIBRARY_SUBTYPES = ['book', 'pdf', 'article', 'course', 'research', 'dataset', 'note'];

const impColor = (i?: string) => {
    switch (i) {
        case 'critical': return '#e8293a';
        case 'high': return '#a055f5';
        case 'medium': return '#e8b800';
        default: return '#c4c2ba';
    }
};

const SELF_TREE_BRANCHES: { value: SelfTreeBranch; label: string; color: string }[] = [
    { value: 'Knowledge',      label: 'Knowledge',  color: '#3b82f6' },
    { value: 'Creation',       label: 'Creation',   color: '#f59e0b' },
    { value: 'Systems',        label: 'Systems',    color: '#10b981' },
    { value: 'Communication',  label: 'Comms',      color: '#8b5cf6' },
    { value: 'Physical',       label: 'Physical',   color: '#ef4444' },
    { value: 'Inner',          label: 'Inner',      color: '#6b7280' },
];

const CAP_KIND_LABEL: Record<string, string> = {
    theme: 'SKIN', sound: 'AUDIO', widget: 'WIDGET', module: 'MODULE',
};

// Capability loadout slots — maps to InventoryCapabilityKind
const DEFAULT_LOADOUT_SLOTS: InventoryCapabilityLoadoutSlot[] = [
    { id: 'theme',  label: 'Theme',  icon: '◈', equipped: false, binding: 'theme'  },
    { id: 'sound',  label: 'Sound',  icon: '◉', equipped: false, binding: 'sound'  },
    { id: 'widget', label: 'Widget', icon: '◫', equipped: false, binding: 'widget' },
    { id: 'module', label: 'Module', icon: '◧', equipped: false, binding: 'module' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const Inventory: React.FC = () => {
    const { inventorySlots, addInventorySlot, updateInventorySlot, deleteInventorySlot, projects } = useXP();
    const { user } = useAuth();
    const { settings } = useXtationSettings();
    const { theme } = useTheme();
    const uid = user?.id || null;
    /** Get fresh uid or throw — guards against stale auth during async ops */
    const requireUid = useCallback(() => {
        const freshUid = user?.id;
        if (!freshUid) throw new Error('Not signed in');
        return freshUid;
    }, [user]);
    const pe = useOptionalPresentationEvents();

    // ── Core state
    const [activeCat, setActiveCat]     = useState<InventoryCategory>('APPAREL');
    const [allAtt, setAllAtt]           = useState<Record<InventoryCategory, InventoryAttachment[]>>({ APPAREL: [], EQUIPMENT: [], TOOLS: [], LIBRARY: [], CONSUMABLES: [], VALUABLES: [], MISC: [] });
    const [loading, setLoading]         = useState(false);
    const [uploading, setUploading]     = useState(false);
    const uploadingCatRef               = useRef<string | null>(null);
    const [error, setError]             = useState('');
    const [selectedId, setSelectedId]   = useState<string | null>(null);
    const [rotation, setRotation]       = useState(0);
    const [newItemName, setNewItemName] = useState('');
    const [viewer, setViewer]           = useState<{ item: InventoryAttachment; url: string | null } | null>(null);
    const [uploadCtx, setUploadCtx]     = useState<{ cat: InventoryCategory; replaceId?: string } | null>(null);

    // ── Grid controls
    const [searchQuery, setSearchQuery]     = useState('');
    const [showArchived, setShowArchived]   = useState(false);

    // ── Details panel editing state
    const [confirmDelete, setConfirmDelete]     = useState<string | null>(null);
    const [editingName, setEditingName]         = useState<string | null>(null);
    const [editingDetails, setEditingDetails]   = useState<string | null>(null);
    const [showProjectPicker, setShowProjectPicker] = useState(false);

    const fileRef   = useRef<HTMLInputElement>(null);
    const resetRef  = useRef<number | null>(null);
    const dragRef   = useRef({ dragging: false, startX: 0, startR: 0 });

    // ── Capability loadout (GEAR panel)
    const caps = useMemo(() => getActiveCapabilityItems(settings, theme), [settings, theme]);
    const loadoutAssignments = useMemo(() => assignCapabilityItemsToLoadoutSlots(DEFAULT_LOADOUT_SLOTS, caps), [caps]);
    const loadoutSummary     = useMemo(() => summarizeCapabilityLoadoutAssignments(loadoutAssignments), [loadoutAssignments]);

    // ── Unified item list
    const items = useMemo((): UnifiedItem[] => {
        const out: UnifiedItem[] = [];
        for (const c of ALL_CATS) {
            for (const r of (allAtt[c] || [])) {
                out.push({
                    id: r.id, source: 'cloud', category: c,
                    name: r.title || 'Image',
                    thumbUrl: r.thumbUrl || undefined,
                    importance: (r.meta as Record<string, unknown> | undefined)?.importance as UnifiedItem['importance'],
                    mediaUrl: r.thumbUrl || '',
                    details: r.notes || undefined,
                    cloudRow: r,
                    createdAt: r.created_at ? new Date(r.created_at as string).getTime() : undefined,
                });
            }
            for (const s of inventorySlots.filter(s => s.category === c)) {
                out.push({
                    id: `l-${s.id}`, source: 'ledger', category: c,
                    name: s.name,
                    importance: s.importance,
                    tier: s.tier,
                    subtype: s.subtype,
                    quantity: s.quantity,
                    externalLink: s.externalLink,
                    details: s.details,
                    selfTreeBranch: s.selfTreeBranch,
                    linkedProjectIds: s.linkedProjectIds,
                    archivedAt: s.archivedAt,
                    ledgerSlot: s,
                    createdAt: s.createdAt,
                });
            }
        }
        for (const cap of caps) {
            out.push({
                id: `c-${cap.id}`, source: 'capability', category: 'EQUIPMENT',
                name: cap.title, details: cap.description,
                capabilityItem: cap,
            });
        }
        return out;
    }, [allAtt, inventorySlots, caps]);

    const activeItems = useMemo(() => {
        let result = items.filter(i => i.category === activeCat);
        if (!showArchived) result = result.filter(i => !i.archivedAt);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(i =>
                i.name.toLowerCase().includes(q) ||
                i.details?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [items, activeCat, showArchived, searchQuery]);

    const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);

    const counts = useMemo(() => {
        const c: Record<InventoryCategory, number> = { APPAREL: 0, EQUIPMENT: 0, TOOLS: 0, LIBRARY: 0, CONSUMABLES: 0, VALUABLES: 0, MISC: 0 };
        for (const i of items) if (!i.archivedAt && i.category in c) c[i.category]++;
        return c;
    }, [items]);

    const archivedCount = useMemo(
        () => items.filter(i => i.category === activeCat && i.archivedAt && i.source === 'ledger').length,
        [items, activeCat]
    );

    const activeProjects = useMemo(
        () => projects.filter(p => p.status === 'Active' || p.status === 'Draft'),
        [projects]
    );

    // ── Supabase helpers ──────────────────────────────────────────────────────

    const resolveUrl = async (p: string) => {
        const { data, error } = await supabase.storage.from('thumbs').createSignedUrl(p, 3600);
        if (!error && data?.signedUrl) return data.signedUrl;
        const { data: pub } = supabase.storage.from('thumbs').getPublicUrl(p);
        return pub?.publicUrl || null;
    };

    const mkUuid = () =>
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
            });

    const toPng = async (f: File): Promise<Blob> => {
        if ((f.type || '').toLowerCase() === 'image/png') return f;
        const img = await createImageBitmap(f);
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext('2d');
        if (!ctx) throw new Error('no ctx');
        ctx.drawImage(img, 0, 0);
        return new Promise<Blob>((res, rej) => { cv.toBlob(b => b ? res(b) : rej(new Error('fail')), 'image/png'); });
    };

    const upload = async (f: File, oid: string): Promise<InventoryAttachment> => {
        const freshUid = requireUid();
        const blob = await toPng(f);
        const id = mkUuid();
        const path = `${freshUid}/inventory/${oid}/${id}.png`;
        const { error: e1 } = await supabase.storage.from('thumbs').upload(path, blob, { upsert: false, contentType: 'image/png' });
        if (e1) throw e1;
        const { data: ins, error: e2 } = await supabase.from('user_files')
            .insert({ user_id: freshUid, owner_type: 'inventory', owner_id: oid, kind: 'image', thumb_path: path, mime: 'image/png', size_bytes: blob.size })
            .select('*').single();
        if (e2 || !ins) { await supabase.storage.from('thumbs').remove([path]); throw e2 || new Error('insert fail'); }
        return { ...(ins as UserFileRow), thumbUrl: await resolveUrl(path) };
    };

    const fetchAll = useCallback(async () => {
        if (!uid) { setAllAtt({ APPAREL: [], EQUIPMENT: [], TOOLS: [], LIBRARY: [], CONSUMABLES: [], VALUABLES: [], MISC: [] }); return; }
        setLoading(true); setError('');
        try {
            const res = await Promise.all(ALL_CATS.map(async c => {
                const { data, error } = await supabase.from('user_files').select('*')
                    .eq('user_id', uid).eq('owner_type', 'inventory').eq('owner_id', catKey(c))
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return { c, rows: await Promise.all(((data || []) as UserFileRow[]).map(async r => ({ ...r, thumbUrl: await resolveUrl(r.thumb_path) }))) };
            }));
            const next: Record<InventoryCategory, InventoryAttachment[]> = { APPAREL: [], EQUIPMENT: [], TOOLS: [], LIBRARY: [], CONSUMABLES: [], VALUABLES: [], MISC: [] };
            for (const r of res) next[r.c] = r.rows;
            setAllAtt(next);
        } catch { setError('Failed to load'); } finally { setLoading(false); }
    }, [uid]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Prune dead project references from inventory slots ────────────────────
    useEffect(() => {
        if (!projects.length || !inventorySlots.length) return;
        const validIds = new Set(projects.map(p => p.id));
        for (const slot of inventorySlots) {
            if (!slot.linkedProjectIds?.length) continue;
            const pruned = slot.linkedProjectIds.filter(id => validIds.has(id));
            if (pruned.length !== slot.linkedProjectIds.length) {
                updateInventorySlot(slot.id, { linkedProjectIds: pruned.length ? pruned : undefined });
            }
        }
    // Run once when projects and slots are both loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects.length > 0 && inventorySlots.length > 0]);

    // ── Upload / delete cloud ─────────────────────────────────────────────────

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f || !uploadCtx) return;
        // Prevent concurrent uploads to the same category (race condition guard)
        const catLock = catKey(uploadCtx.cat);
        if (uploadingCatRef.current === catLock) return;
        try {
            if (!(f.type || '').toLowerCase().startsWith('image/')) throw new Error('Images only');
            const freshUid = requireUid();
            setUploading(true);
            uploadingCatRef.current = catLock;
            const up = await upload(f, catLock);
            if (uploadCtx.replaceId) {
                const old = allAtt[uploadCtx.cat].find(r => r.id === uploadCtx.replaceId);
                if (old) {
                    // DB first, storage best-effort
                    const { error: delErr } = await supabase.from('user_files').delete().eq('id', old.id).eq('user_id', freshUid);
                    if (!delErr && old.thumb_path) {
                        try { await supabase.storage.from('thumbs').remove([old.thumb_path]); } catch { /* orphan ok */ }
                    }
                }
            }
            pe?.emitEvent('inventory.upload.completed', { source: 'user', metadata: { category: uploadCtx.cat } });
            playSuccessSound();
            await fetchAll();
            setSelectedId(up.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
            playErrorSound();
        } finally {
            setUploading(false);
            uploadingCatRef.current = null;
            setUploadCtx(null);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const removeCloud = async (row: InventoryAttachment) => {
        try {
            const freshUid = requireUid();
            // Delete DB row first (the record of truth), then storage (best-effort cleanup)
            const { error: dbErr } = await supabase.from('user_files').delete().eq('id', row.id).eq('user_id', freshUid);
            if (dbErr) throw dbErr;
            // Storage cleanup — best-effort; if this fails the file is orphaned but DB is clean
            if (row.thumb_path) {
                try { await supabase.storage.from('thumbs').remove([row.thumb_path]); } catch { /* orphaned file, non-critical */ }
            }
            setAllAtt(prev => { const n = { ...prev }; for (const c of ALL_CATS) n[c] = n[c].filter(r => r.id !== row.id); return n; });
            if (selectedId === row.id) setSelectedId(null);
            setConfirmDelete(null);
            pe?.emitEvent('inventory.item.deleted', { source: 'user', metadata: { itemSource: 'cloud' } });
            playSuccessSound();
        } catch (err) { setError(err instanceof Error ? err.message : 'Delete failed'); playErrorSound(); }
    };

    // ── Ledger CRUD ───────────────────────────────────────────────────────────

    const addLedger = () => {
        const n = newItemName.trim();
        if (!n) return;
        addInventorySlot({ category: activeCat, name: n });
        setNewItemName('');
        playSuccessSound();
    };

    const removeLedger = (id: string) => {
        deleteInventorySlot(id);
        setSelectedId(null);
        setConfirmDelete(null);
        pe?.emitEvent('inventory.item.deleted', { source: 'user', metadata: { itemSource: 'ledger' } });
        playClickSound();
    };

    const updateLedger = (slotId: string, patch: Partial<InventorySlot>) => {
        updateInventorySlot(slotId, patch);
        pe?.emitEvent('inventory.item.updated', { source: 'user', metadata: { field: Object.keys(patch)[0] } });
    };

    // ── Details panel actions ─────────────────────────────────────────────────

    const saveEditingName = (item: UnifiedItem) => {
        if (!item.ledgerSlot || editingName === null) return;
        const n = editingName.trim();
        if (n && n !== item.name) updateLedger(item.ledgerSlot.id, { name: n });
        setEditingName(null);
    };

    const saveEditingDetails = (item: UnifiedItem) => {
        if (!item.ledgerSlot || editingDetails === null) return;
        updateLedger(item.ledgerSlot.id, { details: editingDetails || undefined });
        setEditingDetails(null);
    };

    const setTreeBranch = (item: UnifiedItem, branch: SelfTreeBranch) => {
        if (!item.ledgerSlot) return;
        const next = branch === item.selfTreeBranch ? undefined : branch;
        updateLedger(item.ledgerSlot.id, { selfTreeBranch: next });
        if (next) pe?.emitEvent('inventory.item.tree_tagged', { source: 'user', metadata: { branch: next, category: item.category } });
    };

    const setImportance = (item: UnifiedItem, imp: InventorySlot['importance']) => {
        if (!item.ledgerSlot) return;
        const next = imp === item.importance ? undefined : imp;
        updateLedger(item.ledgerSlot.id, { importance: next });
    };

    const toggleProject = (item: UnifiedItem, projectId: string) => {
        if (!item.ledgerSlot) return;
        const current = item.linkedProjectIds || [];
        const next = current.includes(projectId)
            ? current.filter(id => id !== projectId)
            : [...current, projectId];
        updateLedger(item.ledgerSlot.id, { linkedProjectIds: next });
    };

    const archiveItem = (item: UnifiedItem) => {
        if (!item.ledgerSlot) return;
        updateLedger(item.ledgerSlot.id, { archivedAt: Date.now() });
        setSelectedId(null);
        setConfirmDelete(null);
        playClickSound();
    };

    const restoreItem = (item: UnifiedItem) => {
        if (!item.ledgerSlot) return;
        updateLedger(item.ledgerSlot.id, { archivedAt: undefined });
        playClickSound();
    };

    const sendToDusk = (item: UnifiedItem) => {
        const branch = item.selfTreeBranch;
        const linkedNames = (item.linkedProjectIds || [])
            .map(pid => projects.find(p => p.id === pid)?.title)
            .filter(Boolean).join(', ');
        openDuskBrief({
            title: `Inventory: ${item.name}`,
            body: [
                `Category: ${item.category}`,
                `Source: ${item.source}`,
                branch            ? `Self Tree: ${branch}` : null,
                item.importance   ? `Priority: ${item.importance}` : null,
                item.details      ? `Notes: ${item.details}` : null,
                linkedNames       ? `Linked Projects: ${linkedNames}` : null,
            ].filter(Boolean).join('\n'),
            source: 'inventory',
            tags: ['inventory', item.category.toLowerCase(), ...(branch ? [branch.toLowerCase()] : [])],
            linkedProjectIds: item.linkedProjectIds,
        });
        pe?.emitEvent('inventory.item.sent_to_dusk', { source: 'user', metadata: { itemId: item.id } });
        playClickSound();
    };

    // ── 3D rotation drag on preview ───────────────────────────────────────────

    const resetRot = () => {
        if (resetRef.current) clearTimeout(resetRef.current);
        resetRef.current = window.setTimeout(() => setRotation(0), 3000);
    };
    useEffect(() => () => { if (resetRef.current) clearTimeout(resetRef.current); }, []);
    const pDown = (e: React.PointerEvent<HTMLDivElement>) => {
        dragRef.current = { dragging: true, startX: e.clientX, startR: rotation };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };
    const pMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current.dragging) return;
        setRotation(Math.max(-60, Math.min(60, dragRef.current.startR + (e.clientX - dragRef.current.startX) * 0.2)));
        resetRot();
    };
    const pUp = (e: React.PointerEvent<HTMLDivElement>) => {
        dragRef.current.dragging = false;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        resetRot();
    };

    // ── Grid construction ─────────────────────────────────────────────────────

    const gridSlots = useMemo(() => {
        const filled: (UnifiedItem | null)[] = [...activeItems];
        const total = Math.max(EMPTY_SLOTS, Math.ceil((filled.length + 1) / GRID_COLS) * GRID_COLS);
        while (filled.length < total) filled.push(null);
        return filled;
    }, [activeItems]);

    const Icon = catIcons[activeCat];

    // ── Helpers ───────────────────────────────────────────────────────────────

    const fmtDate = (ts?: number) => {
        if (!ts) return null;
        const d = new Date(ts);
        return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear().toString().slice(-2)}`;
    };

    const handleSelectItem = (item: UnifiedItem) => {
        setSelectedId(item.id);
        setRotation(0);
        setEditingName(null);
        setEditingDetails(null);
        setShowProjectPicker(false);
        setConfirmDelete(null);
        pe?.emitEvent('inventory.item.selected', { source: 'user', metadata: { category: item.category, itemSource: item.source } });
        playClickSound();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="xt-inv-shell">

            {/* ══ TOP BAR — category tabs ═══════════════════════════════════ */}
            <div className="xt-inv-topbar">
                {ALL_CATS.map(c => {
                    const CatIcon = catIcons[c];
                    const active = activeCat === c;
                    return (
                        <button key={c}
                            className={`xt-inv-topbar-btn${active ? ' is-active' : ''}`}
                            onClick={() => { setActiveCat(c); setSelectedId(null); setNewItemName(''); setSearchQuery(''); setShowArchived(false); playClickSound(); }}
                            onMouseEnter={playHoverSound}>
                            <CatIcon size={14} />
                            <span>{c}</span>
                            {counts[c] > 0 && <span className="xt-inv-topbar-count">{counts[c]}</span>}
                        </button>
                    );
                })}
            </div>

            {/* ── Grid area ─────────────────────────────────────────── */}
            <div className="xt-inv-grid-area">

                    {/* Grid header — heading + search */}
                    <div className="xt-inv-grid-head">
                        <div className="xt-inv-grid-head-left">
                            <span className="xt-inv-grid-heading">Modules</span>
                            <span className="xt-inv-grid-sub">{activeCat}</span>
                        </div>
                        <div className="xt-inv-search">
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="search…"
                                className="xt-inv-search-input"
                            />
                            {searchQuery && (
                                <button className="xt-inv-search-clear" onClick={() => setSearchQuery('')}>
                                    <X size={9} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Capability loadout strip — GEAR only */}
                    {activeCat === 'EQUIPMENT' && (
                        <div className={`xt-inv-loadout-bar xt-inv-loadout-bar--${loadoutSummary.state}`}>
                            <span className="xt-inv-loadout-state">{loadoutSummary.state.toUpperCase()}</span>
                            {loadoutAssignments.map(a => (
                                <div key={a.slot.id} className={`xt-inv-loadout-slot${a.item ? ' is-equipped' : ''}`}>
                                    <span className="xt-inv-loadout-slot-label">{a.slot.label}</span>
                                    <span className="xt-inv-loadout-slot-val">{a.item ? a.item.title : '—'}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="xt-inv-grid-scroll custom-scrollbar">
                        <div className="xt-inv-grid">
                            {gridSlots.map((item, i) => {
                                if (!item) {
                                    const isAdd = i === activeItems.length;
                                    return (
                                        <button key={`e-${i}`}
                                            className={`xt-inv-card xt-inv-card--empty${isAdd ? ' xt-inv-card--add' : ''}`}
                                            onClick={isAdd ? () => { setUploadCtx({ cat: activeCat }); fileRef.current?.click(); playClickSound(); } : undefined}>
                                            {isAdd && <Plus size={20} className="xt-inv-card-plus" />}
                                        </button>
                                    );
                                }
                                const sel = selectedId === item.id;
                                const branch = SELF_TREE_BRANCHES.find(b => b.value === item.selfTreeBranch);
                                return (
                                    <button key={item.id}
                                        className={`xt-inv-card${sel ? ' is-selected' : ''}${item.archivedAt ? ' is-archived' : ''}`}
                                        onClick={() => handleSelectItem(item)}
                                        onMouseEnter={playHoverSound}>
                                        <div className="xt-inv-card-visual">
                                            {item.thumbUrl ? (
                                                <img src={item.thumbUrl} alt="" />
                                            ) : item.source === 'capability' && item.capabilityItem ? (
                                                <div className="xt-inv-card-cap-badge">
                                                    {CAP_KIND_LABEL[item.capabilityItem.kind] || item.capabilityItem.kind.toUpperCase()}
                                                </div>
                                            ) : (
                                                <Icon size={28} />
                                            )}
                                        </div>
                                        <div className="xt-inv-card-text">
                                            <div className="xt-inv-card-name">{item.name}</div>
                                        </div>
                                        <div className="xt-inv-card-footer">
                                            {branch ? (
                                                <span className="xt-inv-card-branch" style={{ color: branch.color }}>{branch.label}</span>
                                            ) : (
                                                <span className="xt-inv-card-src">{item.source}</span>
                                            )}
                                            {item.importance && (
                                                <span className="xt-inv-card-imp" style={{ background: impColor(item.importance) }} />
                                            )}
                                        </div>
                                        {item.archivedAt && <span className="xt-inv-card-archived-mark" title="Archived" />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer: add + archive toggle */}
                        <div className="xt-inv-grid-footer">
                            <div className="xt-inv-add-row">
                                <input value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLedger(); } }}
                                    placeholder={`+ add ${activeCat.toLowerCase()} item`} />
                                <button onClick={addLedger}><Plus size={14} /></button>
                            </div>
                            {archivedCount > 0 && (
                                <button className="xt-inv-archive-toggle" onClick={() => setShowArchived(v => !v)}>
                                    <Archive size={11} />
                                    <span>{showArchived ? 'hide archived' : `${archivedCount} archived`}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Details panel ─────────────────────────────────────── */}
                <div className="xt-inv-details">
                    {selected ? (
                        <>
                            {/* Hero: full-width image/icon preview */}
                            <div className="xt-inv-details-hero">
                                {selected.source === 'cloud' && selected.mediaUrl ? (
                                    <div className="xt-inv-hero-img"
                                        style={{ perspective: '900px' }}
                                        onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerLeave={pUp}>
                                        <div style={{ transform: `rotateY(${rotation}deg)`, transformStyle: 'preserve-3d', transition: dragRef.current.dragging ? 'none' : 'transform 0.2s ease-out', width: '100%', height: '100%' }}>
                                            <img src={selected.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="xt-inv-hero-icon">
                                        {React.createElement(catIcons[selected.category], { size: 72 })}
                                    </div>
                                )}
                                {/* Floating action buttons */}
                                <div className="xt-inv-hero-actions">
                                    {selected.source === 'cloud' && (
                                        <button onClick={() => { setUploadCtx({ cat: selected.category, replaceId: selected.cloudRow?.id }); fileRef.current?.click(); playClickSound(); }} title="Replace image">
                                            <Upload size={13} />
                                        </button>
                                    )}
                                    {selected.source !== 'capability' && (
                                        confirmDelete === selected.id ? (
                                            <div className="xt-inv-confirm-delete">
                                                <span>Delete?</span>
                                                <button className="yes" onClick={() => {
                                                    if (selected.cloudRow) removeCloud(selected.cloudRow);
                                                    else if (selected.ledgerSlot) removeLedger(selected.ledgerSlot.id);
                                                }}>Yes</button>
                                                <button className="no" onClick={() => setConfirmDelete(null)}>No</button>
                                            </div>
                                        ) : (
                                            <>
                                                {selected.source === 'ledger' && (
                                                    selected.archivedAt ? (
                                                        <button title="Restore" onClick={() => restoreItem(selected)}>
                                                            <RotateCcw size={13} />
                                                        </button>
                                                    ) : (
                                                        <button title="Archive" onClick={() => archiveItem(selected)}>
                                                            <Archive size={13} />
                                                        </button>
                                                    )
                                                )}
                                                <button className="danger" title="Delete permanently" onClick={() => setConfirmDelete(selected.id)}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </>
                                        )
                                    )}
                                    <button className="dusk" title="Send context to Dusk" onClick={() => sendToDusk(selected)}>
                                        <Send size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Content zone */}
                            <div className="xt-inv-details-content">
                                {/* Item name */}
                                <div className="xt-inv-details-name-zone">
                                    {selected.source === 'ledger' && selected.ledgerSlot ? (
                                        editingName !== null ? (
                                            <input autoFocus className="xt-inv-details-name-input"
                                                value={editingName}
                                                onChange={e => setEditingName(e.target.value)}
                                                onBlur={() => saveEditingName(selected)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveEditingName(selected); if (e.key === 'Escape') setEditingName(null); }} />
                                        ) : (
                                            <span className="xt-inv-details-title is-editable" title="Click to rename" onClick={() => setEditingName(selected.name)}>
                                                {selected.name}
                                            </span>
                                        )
                                    ) : (
                                        <span className="xt-inv-details-title">{selected.name}</span>
                                    )}
                                </div>

                                {/* Capability info */}
                                {selected.source === 'capability' && selected.capabilityItem && (
                                    <div className="xt-inv-cap-info">
                                        <div className="xt-inv-cap-header">
                                            <span className="xt-inv-cap-kind-badge">{CAP_KIND_LABEL[selected.capabilityItem.kind] || selected.capabilityItem.kind.toUpperCase()}</span>
                                            <span className="xt-inv-cap-source">{selected.capabilityItem.sourceLabel}</span>
                                        </div>
                                        <p className="xt-inv-cap-desc">{selected.capabilityItem.description}</p>
                                        {selected.capabilityItem.highlights.length > 0 && (
                                            <div className="xt-inv-info-chips">
                                                {selected.capabilityItem.highlights.map(h => (
                                                    <span key={h} className="xt-inv-chip">{h}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Notes */}
                                {selected.source !== 'capability' && (
                                    <div className="xt-inv-details-desc">
                                        {selected.source === 'ledger' && selected.ledgerSlot ? (
                                            editingDetails !== null ? (
                                                <textarea autoFocus
                                                    className="xt-inv-notes-input"
                                                    value={editingDetails}
                                                    onChange={e => setEditingDetails(e.target.value)}
                                                    onBlur={() => saveEditingDetails(selected)}
                                                    onKeyDown={e => { if (e.key === 'Escape') setEditingDetails(null); }}
                                                    rows={3}
                                                    placeholder="Add notes about this item…" />
                                            ) : (
                                                <div className="xt-inv-notes-display" onClick={() => setEditingDetails(selected.details || '')}>
                                                    {selected.details
                                                        ? <p>{selected.details}</p>
                                                        : <span className="xt-inv-notes-placeholder">Click to add notes…</span>}
                                                </div>
                                            )
                                        ) : (
                                            <p className="xt-inv-info-desc">
                                                {selected.details || <span className="xt-inv-notes-placeholder">No notes</span>}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Metadata — scrollable */}
                                <div className="xt-inv-details-meta custom-scrollbar">

                                    {/* Tier */}
                                    {selected.source === 'ledger' && selected.ledgerSlot && (
                                        <div className="xt-inv-section">
                                            <span className="xt-inv-section-label">TIER</span>
                                            <div className="xt-inv-tier-pills">
                                                {([1, 2, 3, 4, 5] as const).map(t => (
                                                    <button key={t}
                                                        className={`xt-inv-tier-btn${selected.tier === t ? ' is-active' : ''}`}
                                                        style={selected.tier === t ? { borderColor: TIER_COLORS[t], color: TIER_COLORS[t], background: `${TIER_COLORS[t]}18` } : {}}
                                                        onClick={() => updateLedger(selected.ledgerSlot!.id, { tier: t })}>
                                                        T{t} <span className="xt-inv-tier-label">{TIER_LABELS[t]}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Subtype — LIBRARY only */}
                                    {selected.source === 'ledger' && selected.category === 'LIBRARY' && selected.ledgerSlot && (
                                        <div className="xt-inv-section">
                                            <span className="xt-inv-section-label">SUBTYPE</span>
                                            <div className="xt-inv-tier-pills">
                                                {LIBRARY_SUBTYPES.map(st => (
                                                    <button key={st}
                                                        className={`xt-inv-tier-btn${selected.subtype === st ? ' is-active' : ''}`}
                                                        style={selected.subtype === st ? { borderColor: '#60a5fa', color: '#60a5fa', background: '#60a5fa18' } : {}}
                                                        onClick={() => updateLedger(selected.ledgerSlot!.id, { subtype: st })}>
                                                        {st}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quantity — CONSUMABLES only */}
                                    {selected.source === 'ledger' && selected.category === 'CONSUMABLES' && selected.ledgerSlot && (
                                        <div className="xt-inv-section">
                                            <span className="xt-inv-section-label">QUANTITY</span>
                                            <div className="xt-inv-qty-row">
                                                <button className="xt-inv-qty-btn"
                                                    onClick={() => updateLedger(selected.ledgerSlot!.id, { quantity: Math.max(0, (selected.quantity || 0) - 1) })}>−</button>
                                                <span className="xt-inv-qty-val">{selected.quantity ?? 0}</span>
                                                <button className="xt-inv-qty-btn"
                                                    onClick={() => updateLedger(selected.ledgerSlot!.id, { quantity: (selected.quantity || 0) + 1 })}>+</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* External link */}
                                    {selected.source === 'ledger' && (selected.category === 'TOOLS' || selected.category === 'LIBRARY') && selected.ledgerSlot && (
                                        <div className="xt-inv-section">
                                            <span className="xt-inv-section-label">LINK</span>
                                            <input
                                                type="url"
                                                className="xt-inv-link-input"
                                                value={selected.externalLink || ''}
                                                placeholder="https://…"
                                                onChange={e => updateLedger(selected.ledgerSlot!.id, { externalLink: e.target.value || undefined })}
                                            />
                                            {selected.externalLink && (
                                                <a href={selected.externalLink} target="_blank" rel="noreferrer" className="xt-inv-link-open">
                                                    open ↗
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* Self Tree */}
                                    {selected.source === 'ledger' && (
                                        <div className="xt-inv-section">
                                            <span className="xt-inv-section-label">SELF TREE</span>
                                            <div className="xt-inv-tree-picker">
                                                {SELF_TREE_BRANCHES.map(b => (
                                                    <button key={b.value}
                                                        className={`xt-inv-tree-btn${selected.selfTreeBranch === b.value ? ' is-active' : ''}`}
                                                        style={selected.selfTreeBranch === b.value ? { borderColor: b.color, color: b.color, background: `${b.color}14` } : {}}
                                                        onClick={() => setTreeBranch(selected, b.value)}>
                                                        {b.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Priority */}
                                    {selected.source === 'ledger' && (
                                        <div className="xt-inv-section">
                                            <span className="xt-inv-section-label">PRIORITY</span>
                                            <div className="xt-inv-imp-pills">
                                                {(['low', 'medium', 'high', 'critical'] as const).map(imp => (
                                                    <button key={imp}
                                                        className={`xt-inv-imp-btn${selected.importance === imp ? ' is-active' : ''}`}
                                                        style={selected.importance === imp ? { borderColor: impColor(imp), color: impColor(imp), background: `${impColor(imp)}14` } : {}}
                                                        onClick={() => setImportance(selected, imp)}>
                                                        {imp}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Linked Projects */}
                                    {selected.source === 'ledger' && activeProjects.length > 0 && (
                                        <div className="xt-inv-section">
                                            <div className="xt-inv-section-head">
                                                <span className="xt-inv-section-label">PROJECTS</span>
                                                <button className="xt-inv-section-toggle" onClick={() => setShowProjectPicker(v => !v)}>
                                                    <FolderOpen size={11} />
                                                </button>
                                            </div>
                                            {(selected.linkedProjectIds || []).length > 0 && (
                                                <div className="xt-inv-project-tags">
                                                    {(selected.linkedProjectIds || []).map(pid => {
                                                        const proj = projects.find(p => p.id === pid);
                                                        if (!proj) return null;
                                                        return (
                                                            <span key={pid} className="xt-inv-project-tag"
                                                                onClick={() => toggleProject(selected, pid)}>
                                                                {proj.title}
                                                                <X size={9} />
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {showProjectPicker && (
                                                <div className="xt-inv-project-picker">
                                                    {activeProjects.map(proj => {
                                                        const linked = (selected.linkedProjectIds || []).includes(proj.id);
                                                        return (
                                                            <button key={proj.id}
                                                                className={`xt-inv-project-opt${linked ? ' is-linked' : ''}`}
                                                                onClick={() => toggleProject(selected, proj.id)}>
                                                                <span className="xt-inv-project-opt-name">{proj.title}</span>
                                                                <span className="xt-inv-project-opt-type">{proj.type}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </div>
                            </div>

                            {/* Stats footer — fixed bottom bar like reference */}
                            <div className="xt-inv-details-foot">
                                <div className="xt-inv-foot-stat">
                                    <span className="xt-inv-foot-label">Source</span>
                                    <span className="xt-inv-foot-val">{selected.source}</span>
                                </div>
                                <div className="xt-inv-foot-stat">
                                    <span className="xt-inv-foot-label">Category</span>
                                    <span className="xt-inv-foot-val">{selected.category}</span>
                                </div>
                                {selected.tier && (
                                    <div className="xt-inv-foot-stat">
                                        <span className="xt-inv-foot-label">Tier</span>
                                        <span className="xt-inv-foot-val" style={{ color: TIER_COLORS[selected.tier] }}>{TIER_LABELS[selected.tier]}</span>
                                    </div>
                                )}
                                {selected.importance && (
                                    <div className="xt-inv-foot-stat">
                                        <span className="xt-inv-foot-label">Priority</span>
                                        <span className="xt-inv-foot-val" style={{ color: impColor(selected.importance) }}>{selected.importance}</span>
                                    </div>
                                )}
                                {selected.createdAt && (
                                    <div className="xt-inv-foot-stat xt-inv-foot-stat--right">
                                        <span className="xt-inv-foot-label">Added</span>
                                        <span className="xt-inv-foot-val">{fmtDate(selected.createdAt)}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="xt-inv-details-empty">
                            <Box size={36} />
                            <span>Select an item</span>
                        </div>
                    )}
                </div>

            {/* ══ RESOURCE BAR ════════════════════════════════════════════ */}
            <div className="xt-inv-bar">
                {ALL_CATS.map(c => {
                    const CI = catIcons[c];
                    return (
                        <div key={c} className="xt-inv-bar-item">
                            <div className="xt-inv-bar-top">
                                <CI size={14} />
                                <span className="xt-inv-bar-num">{String(counts[c]).padStart(3, '0')}</span>
                            </div>
                            <span className="xt-inv-bar-label">{c.toLowerCase()}</span>
                        </div>
                    );
                })}
                <div className="xt-inv-bar-sep" />
                <div className="xt-inv-bar-item">
                    <div className="xt-inv-bar-top">
                        <span className="xt-inv-bar-num">{items.filter(i => !i.archivedAt).length}</span>
                    </div>
                    <span className="xt-inv-bar-label">total</span>
                </div>
                <div className="xt-inv-bar-grow" />
                {error && <span className="xt-inv-bar-error">{error}</span>}
                {(loading || uploading) && <Loader2 size={12} className="xt-inv-bar-loader" />}
                <span className="xt-inv-bar-sync">{uid ? 'CLOUD' : 'LOCAL'}</span>
            </div>

            <input type="file" ref={fileRef} className="hidden" accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.svg,.heic" onChange={handleFile} />

            {/* Viewer modal */}
            {viewer && (
                <div className="fixed inset-0 z-[220] bg-black/80 flex items-center justify-center p-6"
                    onMouseDown={() => setViewer(null)}>
                    <div className="xt-inv-viewer" onMouseDown={e => e.stopPropagation()}>
                        <div className="xt-inv-viewer-top">
                            <span>{viewer.item.title || 'Media'}</span>
                            <button onClick={() => setViewer(null)}><X size={14} /></button>
                        </div>
                        <div className="xt-inv-viewer-img">
                            {viewer.url ? <img src={viewer.url} alt="" /> : <span>No preview</span>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
