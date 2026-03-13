
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { InventoryCategory } from '../../types';
import { Plus, Trash2, Upload, Box, Car, Wrench, Shirt, Cpu, Loader2, X } from 'lucide-react';
import { playClickSound, playHoverSound, playSuccessSound, playErrorSound } from '../../utils/SoundEffects';
import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabaseClient';
import type { UserFileRow } from '../../src/lib/attachments/types';
import { useXP } from '../XP/xpStore';
import type { InventorySlot } from '../XP/xpTypes';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getActiveCapabilityItems, InventoryCapabilityItem } from '../../src/inventory/models';
// DevOverlay replaced by universal design-mode.js (Ctrl+Shift+D)

type InventoryAttachment = UserFileRow & { thumbUrl: string | null };

type UnifiedItem = {
    id: string;
    source: 'cloud' | 'ledger' | 'capability';
    category: InventoryCategory;
    name: string;
    thumbUrl?: string;
    importance?: 'low' | 'medium' | 'high' | 'critical';
    mediaUrl?: string;
    details?: string;
    cloudRow?: InventoryAttachment;
    ledgerSlot?: InventorySlot;
    capabilityItem?: InventoryCapabilityItem;
};

const ALL_CATS: InventoryCategory[] = ['OUTFIT', 'GEAR', 'VEHICLE', 'TOOLS'];
const GRID_COLS = 3;
const EMPTY_SLOTS = 15;

const catIcons: Record<InventoryCategory, React.FC<{ size?: number; className?: string }>> = {
    OUTFIT: Shirt, GEAR: Cpu, VEHICLE: Car, TOOLS: Wrench,
};
const catKey = (c: InventoryCategory) => c.toLowerCase() as Lowercase<InventoryCategory>;

const impColor = (i?: string) => {
    switch (i) { case 'critical': return '#FF2A3A'; case 'high': return '#a855f7'; case 'medium': return '#ffd000'; default: return '#f4f4f5'; }
};

export const Inventory: React.FC = () => {
    const { inventorySlots, addInventorySlot, updateInventorySlot, deleteInventorySlot } = useXP();
    const { user } = useAuth();
    const { settings } = useXtationSettings();
    const { theme } = useTheme();
    const uid = user?.id || null;

    const [activeCat, setActiveCat] = useState<InventoryCategory>('OUTFIT');
    const [allAtt, setAllAtt] = useState<Record<InventoryCategory, InventoryAttachment[]>>({ OUTFIT: [], GEAR: [], VEHICLE: [], TOOLS: [] });
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [rotation, setRotation] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [viewerLoading, setViewerLoading] = useState(false);
    const [viewer, setViewer] = useState<{ item: InventoryAttachment; url: string | null; mime: string | null } | null>(null);

    const fileRef = useRef<HTMLInputElement>(null);
    const resetRef = useRef<number | null>(null);
    const dragRef = useRef({ dragging: false, startX: 0, startR: 0 });
    const [uploadCtx, setUploadCtx] = useState<{ cat: InventoryCategory; replaceId?: string } | null>(null);

    const caps = useMemo(() => getActiveCapabilityItems(settings, theme), [settings, theme]);

    // Unified items
    const items = useMemo((): UnifiedItem[] => {
        const out: UnifiedItem[] = [];
        for (const c of ALL_CATS) {
            for (const r of allAtt[c]) out.push({ id: r.id, source: 'cloud', category: c, name: r.title || 'Image', thumbUrl: r.thumbUrl || undefined, importance: (r.meta as Record<string, unknown> | undefined)?.importance as UnifiedItem['importance'], mediaUrl: r.thumbUrl || '', details: r.notes || undefined, cloudRow: r });
            for (const s of inventorySlots.filter(s => s.category === c)) out.push({ id: `l-${s.id}`, source: 'ledger', category: c, name: s.name, importance: s.importance, details: s.details, ledgerSlot: s });
        }
        for (const cap of caps) out.push({ id: `c-${cap.id}`, source: 'capability', category: 'GEAR', name: cap.title, details: cap.description, capabilityItem: cap });
        return out;
    }, [allAtt, inventorySlots, caps]);

    const activeItems = useMemo(() => items.filter(i => i.category === activeCat), [items, activeCat]);
    const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);
    const counts = useMemo(() => {
        const c: Record<InventoryCategory, number> = { OUTFIT: 0, GEAR: 0, VEHICLE: 0, TOOLS: 0 };
        for (const i of items) c[i.category]++;
        return c;
    }, [items]);

    // Supabase
    const resolveUrl = async (p: string) => {
        const { data, error } = await supabase.storage.from('thumbs').createSignedUrl(p, 3600);
        if (!error && data?.signedUrl) return data.signedUrl;
        const { data: pub } = supabase.storage.from('thumbs').getPublicUrl(p);
        return pub?.publicUrl || null;
    };
    const mkUuid = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
    const toPng = async (f: File): Promise<Blob> => {
        if ((f.type || '').toLowerCase() === 'image/png') return f;
        const img = await createImageBitmap(f); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext('2d'); if (!ctx) throw new Error('no ctx'); ctx.drawImage(img, 0, 0);
        return new Promise<Blob>((res, rej) => { cv.toBlob(b => b ? res(b) : rej(new Error('fail')), 'image/png'); });
    };
    const upload = async (f: File, oid: string): Promise<InventoryAttachment> => {
        if (!uid) throw new Error('AUTH'); const blob = await toPng(f); const id = mkUuid();
        const path = `${uid}/inventory/${oid}/${id}.png`;
        const { error: e1 } = await supabase.storage.from('thumbs').upload(path, blob, { upsert: false, contentType: 'image/png' });
        if (e1) throw e1;
        const { data: ins, error: e2 } = await supabase.from('user_files').insert({ user_id: uid, owner_type: 'inventory', owner_id: oid, kind: 'image', thumb_path: path, mime: 'image/png', size_bytes: blob.size }).select('*').single();
        if (e2 || !ins) { await supabase.storage.from('thumbs').remove([path]); throw e2 || new Error('insert fail'); }
        return { ...(ins as UserFileRow), thumbUrl: await resolveUrl(path) };
    };

    const fetchAll = useCallback(async () => {
        if (!uid) { setAllAtt({ OUTFIT: [], GEAR: [], VEHICLE: [], TOOLS: [] }); return; }
        setLoading(true); setError('');
        try {
            const res = await Promise.all(ALL_CATS.map(async c => {
                const { data, error } = await supabase.from('user_files').select('*').eq('user_id', uid).eq('owner_type', 'inventory').eq('owner_id', catKey(c)).order('created_at', { ascending: false });
                if (error) throw error;
                return { c, rows: await Promise.all(((data || []) as UserFileRow[]).map(async r => ({ ...r, thumbUrl: await resolveUrl(r.thumb_path) }))) };
            }));
            const next: Record<InventoryCategory, InventoryAttachment[]> = { OUTFIT: [], GEAR: [], VEHICLE: [], TOOLS: [] };
            for (const r of res) next[r.c] = r.rows;
            setAllAtt(next);
        } catch { setError('Failed to load'); } finally { setLoading(false); }
    }, [uid]);
    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Upload handler
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f || !uploadCtx) return;
        try {
            if (!(f.type || '').toLowerCase().startsWith('image/')) throw new Error('Images only');
            if (!uid) throw new Error('Sign in'); setUploading(true);
            const up = await upload(f, catKey(uploadCtx.cat));
            if (uploadCtx.replaceId) {
                const old = allAtt[uploadCtx.cat].find(r => r.id === uploadCtx.replaceId);
                if (old) { await supabase.from('user_files').delete().eq('id', old.id).eq('user_id', uid); if (old.thumb_path) await supabase.storage.from('thumbs').remove([old.thumb_path]); }
            }
            playSuccessSound(); await fetchAll(); setSelectedId(up.id);
        } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); playErrorSound(); }
        finally { setUploading(false); setUploadCtx(null); if (fileRef.current) fileRef.current.value = ''; }
    };

    const removeCloud = async (row: InventoryAttachment, e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            if (!uid) throw new Error('Sign in');
            await supabase.from('user_files').delete().eq('id', row.id).eq('user_id', uid);
            if (row.thumb_path) await supabase.storage.from('thumbs').remove([row.thumb_path]);
            setAllAtt(prev => { const n = { ...prev }; for (const c of ALL_CATS) n[c] = n[c].filter(r => r.id !== row.id); return n; });
            if (selectedId === row.id) setSelectedId(null);
            playSuccessSound();
        } catch { setError('Delete failed'); playErrorSound(); }
    };

    // Ledger
    const addLedger = () => { const n = newItemName.trim(); if (!n) return; addInventorySlot({ category: activeCat, name: n }); setNewItemName(''); playSuccessSound(); };
    const saveLedger = (id: string) => { const n = editingName.trim(); if (n) updateInventorySlot(id, { name: n }); setEditingId(null); setEditingName(''); };

    // Rotation
    const resetRot = () => { if (resetRef.current) clearTimeout(resetRef.current); resetRef.current = window.setTimeout(() => setRotation(0), 3000); };
    useEffect(() => () => { if (resetRef.current) clearTimeout(resetRef.current); }, []);
    const pDown = (e: React.PointerEvent<HTMLDivElement>) => { dragRef.current = { dragging: true, startX: e.clientX, startR: rotation }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
    const pMove = (e: React.PointerEvent<HTMLDivElement>) => { if (!dragRef.current.dragging) return; setRotation(Math.max(-60, Math.min(60, dragRef.current.startR + (e.clientX - dragRef.current.startX) * 0.2))); resetRot(); };
    const pUp = (e: React.PointerEvent<HTMLDivElement>) => { dragRef.current.dragging = false; (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); resetRot(); };

    // Build grid
    const gridSlots = useMemo(() => {
        const filled: (UnifiedItem | null)[] = [...activeItems];
        const total = Math.max(EMPTY_SLOTS, Math.ceil((filled.length + 1) / GRID_COLS) * GRID_COLS);
        while (filled.length < total) filled.push(null);
        return filled;
    }, [activeItems]);

    const Icon = catIcons[activeCat];

    return (
        <div className="xt-inv-shell">
            {/* ══ TOP BAR — category tabs centered ═══════════════════════ */}
            <div className="xt-inv-topbar">
                {ALL_CATS.map(c => {
                    const CatIcon = catIcons[c];
                    const active = activeCat === c;
                    return (
                        <button key={c}
                            className={`xt-inv-topbar-btn${active ? ' is-active' : ''}`}
                            onClick={() => { setActiveCat(c); setSelectedId(null); setNewItemName(''); playClickSound(); }}
                            onMouseEnter={playHoverSound}>
                            <CatIcon size={14} />
                            <span>{c}</span>
                        </button>
                    );
                })}
            </div>

            {/* ══ MAIN LAYOUT ════════════════════════════════════════════ */}
            <div className="xt-inv-main">

                {/* ── Grid area ───────────────────────────────────────── */}
                <div className="xt-inv-grid-area">
                    <div className="xt-inv-grid-head">
                        <span className="xt-inv-grid-heading">Modules</span>
                        <span className="xt-inv-grid-sub">{activeCat}</span>
                    </div>

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
                                return (
                                    <button key={item.id}
                                        className={`xt-inv-card${sel ? ' is-selected' : ''}`}
                                        onClick={() => { setSelectedId(item.id); setRotation(0); playClickSound(); }}
                                        onMouseEnter={playHoverSound}>
                                        {/* Card icon/thumb */}
                                        <div className="xt-inv-card-visual">
                                            {item.thumbUrl ? (
                                                <img src={item.thumbUrl} alt="" />
                                            ) : (
                                                <Icon size={28} />
                                            )}
                                        </div>
                                        {/* Card text */}
                                        <div className="xt-inv-card-text">
                                            <div className="xt-inv-card-name">{item.name}</div>
                                        </div>
                                        {/* Bottom info */}
                                        <div className="xt-inv-card-footer">
                                            <span className="xt-inv-card-src">{item.source}</span>
                                            {item.importance && (
                                                <span className="xt-inv-card-imp" style={{ background: impColor(item.importance) }} />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Quick-add ledger item */}
                        <div className="xt-inv-add-row">
                            <input value={newItemName} onChange={e => setNewItemName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLedger(); } }}
                                placeholder={`+ add ${activeCat.toLowerCase()} item`} />
                            <button onClick={addLedger}><Plus size={14} /></button>
                        </div>
                    </div>
                </div>

                {/* ── Details panel ───────────────────────────────────── */}
                <div className="xt-inv-details">
                    <div className="xt-inv-details-head">
                        <span className="xt-inv-grid-heading">Details</span>
                    </div>

                    {selected ? (
                        <div className="xt-inv-details-body custom-scrollbar">
                            {/* Preview */}
                            <div className="xt-inv-preview">
                                {selected.source === 'cloud' && selected.mediaUrl ? (
                                    <div className="xt-inv-preview-img"
                                        style={{ perspective: '900px' }}
                                        onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerLeave={pUp}>
                                        <div style={{ transform: `rotateY(${rotation}deg)`, transformStyle: 'preserve-3d', transition: dragRef.current.dragging ? 'none' : 'transform 0.2s ease-out', width: '100%', height: '100%' }}>
                                            <img src={selected.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="xt-inv-preview-icon">
                                        {React.createElement(catIcons[selected.category], { size: 56 })}
                                    </div>
                                )}
                                {/* Overlay actions */}
                                {selected.source === 'cloud' && (
                                    <div className="xt-inv-preview-actions">
                                        <button onClick={() => { setUploadCtx({ cat: selected.category, replaceId: selected.cloudRow?.id }); fileRef.current?.click(); playClickSound(); }} title="Replace"><Upload size={14} /></button>
                                        <button onClick={e => selected.cloudRow && removeCloud(selected.cloudRow, e)} title="Delete" className="danger"><Trash2 size={14} /></button>
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="xt-inv-info">
                                <h3 className="xt-inv-info-name">{selected.name}</h3>
                                {selected.details && <p className="xt-inv-info-desc">{selected.details}</p>}

                                {/* Capability highlights */}
                                {selected.capabilityItem?.highlights && selected.capabilityItem.highlights.length > 0 && (
                                    <div className="xt-inv-info-chips">
                                        {selected.capabilityItem.highlights.map(h => (
                                            <span key={h} className="xt-inv-chip">{h}</span>
                                        ))}
                                    </div>
                                )}

                                {/* Ledger actions */}
                                {selected.source === 'ledger' && selected.ledgerSlot && (
                                    <div className="xt-inv-info-ledger">
                                        {editingId === selected.ledgerSlot.id ? (
                                            <input autoFocus value={editingName}
                                                onChange={e => setEditingName(e.target.value)}
                                                onBlur={() => saveLedger(selected.ledgerSlot!.id)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveLedger(selected.ledgerSlot!.id); if (e.key === 'Escape') setEditingId(null); }}
                                                className="xt-inv-info-rename" />
                                        ) : (
                                            <div className="xt-inv-info-btns">
                                                <button onClick={() => { setEditingId(selected.ledgerSlot!.id); setEditingName(selected.ledgerSlot!.name); }}>Rename</button>
                                                <button className="danger" onClick={() => { deleteInventorySlot(selected.ledgerSlot!.id); playClickSound(); setSelectedId(null); }}><Trash2 size={12} /></button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Stats strip */}
                            <div className="xt-inv-stats">
                                <div className="xt-inv-stat">
                                    <span className="xt-inv-stat-label">Source</span>
                                    <span className="xt-inv-stat-val">{selected.source}</span>
                                </div>
                                {selected.importance && (
                                    <div className="xt-inv-stat">
                                        <span className="xt-inv-stat-label">Priority</span>
                                        <span className="xt-inv-stat-val" style={{ color: impColor(selected.importance) }}>{selected.importance}</span>
                                    </div>
                                )}
                                <div className="xt-inv-stat">
                                    <span className="xt-inv-stat-label">Type</span>
                                    <span className="xt-inv-stat-val">{selected.category}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="xt-inv-details-empty">
                            <Box size={36} />
                            <span>Select an item</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ══ RESOURCE BAR ═══════════════════════════════════════════ */}
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
                        <span className="xt-inv-bar-num">{items.length}</span>
                    </div>
                    <span className="xt-inv-bar-label">total</span>
                </div>
                <div className="xt-inv-bar-grow" />
                <span className="xt-inv-bar-sync">{uid ? 'CLOUD' : 'LOCAL'}</span>
            </div>

            <input type="file" ref={fileRef} className="hidden" accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.svg,.heic" onChange={handleFile} />

            {/* Viewer modal */}
            {viewer && (
                <div className="fixed inset-0 z-[220] bg-black/80 flex items-center justify-center p-6" onMouseDown={() => setViewer(null)}>
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
