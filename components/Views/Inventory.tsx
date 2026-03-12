
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HexCard } from '../UI/HextechUI';
import { InventoryCategory, InventoryItem } from '../../types';
import { Plus, Trash2, Upload, Box, Car, Wrench, Shirt, Cpu, Settings, Loader2, X } from 'lucide-react';
import { playClickSound, playHoverSound, playSuccessSound, playErrorSound } from '../../utils/SoundEffects';
import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/lib/supabaseClient';
import type { UserFileRow } from '../../src/lib/attachments/types';
import { useXP } from '../XP/xpStore';
import type { InventorySlot } from '../XP/xpTypes';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getActiveCapabilityItems } from '../../src/inventory/models';

export const Inventory: React.FC<{ uiTheme?: 'kpr' | 'valorant-a' | 'valorant-b' }> = ({ uiTheme = 'kpr' }) => {
    const { inventorySlots, addInventorySlot, updateInventorySlot, deleteInventorySlot } = useXP();
    const { user } = useAuth();
    const { settings } = useXtationSettings();
    const { theme } = useTheme();
    const activeUserId = user?.id || null;
    type InventoryAttachment = UserFileRow & { thumbUrl: string | null };
    const isValorantB = uiTheme === 'valorant-b';
    const [activeCategory, setActiveCategory] = useState<InventoryCategory>('OUTFIT');

    // DB stores owner_id lowercase (tools/outfit/gear/vehicle)
    const categoryKey = (category: InventoryCategory) => category.toLowerCase() as Lowercase<InventoryCategory>;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [previewRotation, setPreviewRotation] = useState<number>(0);
    const [detailEditOpen, setDetailEditOpen] = useState<boolean>(false);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const resetTimerRef = useRef<number | null>(null);
    const dragStateRef = useRef<{ dragging: boolean; startX: number; startRotation: number }>({
        dragging: false,
        startX: 0,
        startRotation: 0
    });
    const [itemAttachments, setItemAttachments] = useState<InventoryAttachment[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachmentsUploading, setAttachmentsUploading] = useState(false);
    const [attachmentsError, setAttachmentsError] = useState<string>('');
    const [viewerLoading, setViewerLoading] = useState(false);
    const [attachmentViewer, setAttachmentViewer] = useState<{
        item: InventoryAttachment;
        sourceUrl: string | null;
        mime: string | null;
    } | null>(null);
    const [newLedgerItemName, setNewLedgerItemName] = useState('');
    const [editingLedgerSlotId, setEditingLedgerSlotId] = useState<string | null>(null);
    const [editingLedgerSlotName, setEditingLedgerSlotName] = useState('');

    const activeLedgerSlots = inventorySlots.filter((s) => s.category === activeCategory);
    const activeCapabilityItems = useMemo(() => getActiveCapabilityItems(settings, theme), [settings, theme]);

    const handleAddLedgerItem = () => {
        const name = newLedgerItemName.trim();
        if (!name) return;
        addInventorySlot({ category: activeCategory, name });
        setNewLedgerItemName('');
        playSuccessSound();
    };

    const handleStartEditLedgerSlot = (slot: InventorySlot) => {
        setEditingLedgerSlotId(slot.id);
        setEditingLedgerSlotName(slot.name);
    };

    const handleSaveLedgerSlot = (id: string) => {
        const name = editingLedgerSlotName.trim();
        if (name) updateInventorySlot(id, { name });
        setEditingLedgerSlotId(null);
        setEditingLedgerSlotName('');
    };

    const categories: InventoryCategory[] = ['OUTFIT', 'GEAR', 'VEHICLE', 'TOOLS'];
    const activeCategoryOwnerId = categoryKey(activeCategory);

    const categoryIcons: Record<InventoryCategory, JSX.Element> = {
        OUTFIT: <Shirt size={14} />,
        GEAR: <Cpu size={14} />,
        VEHICLE: <Car size={14} />,
        TOOLS: <Wrench size={14} />
    };

    const createUuid = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
            const rand = Math.random() * 16 | 0;
            const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
            return value.toString(16);
        });
    };

    const toPngBlob = async (file: File): Promise<Blob> => {
        if ((file.type || '').toLowerCase() === 'image/png') return file;
        const image = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to initialize thumbnail canvas');
        ctx.drawImage(image, 0, 0);
        const pngBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to encode image'));
                    return;
                }
                resolve(blob);
            }, 'image/png');
        });
        return pngBlob;
    };

    const uploadInventoryImage = async (file: File, categoryOwnerId: string): Promise<InventoryAttachment> => {
        if (!activeUserId) {
            console.error('[Inventory] missing session/user during upload');
            throw new Error('AUTH_REQUIRED');
        }

        const pngBlob = await toPngBlob(file);
        const uuid = createUuid();
        const thumbPath = `${activeUserId}/inventory/${categoryOwnerId}/${uuid}.png`;

        const { error: uploadError } = await supabase.storage.from('thumbs').upload(thumbPath, pngBlob, {
            upsert: false,
            contentType: 'image/png',
        });
        if (uploadError) {
            console.error('[Inventory] storage upload error', uploadError);
            throw uploadError;
        }

        const { data: inserted, error: insertError } = await supabase
            .from('user_files')
            .insert({
                user_id: activeUserId,
                owner_type: 'inventory',
                owner_id: categoryOwnerId,
                kind: 'image',
                thumb_path: thumbPath,
                mime: 'image/png',
                size_bytes: pngBlob.size,
            })
            .select('*')
            .single();

        if (insertError || !inserted) {
            if (insertError) console.error('[Inventory] DB insert error', insertError);
            await supabase.storage.from('thumbs').remove([thumbPath]);
            throw insertError || new Error('Failed to create inventory file row');
        }

        const signed = await resolveThumbUrl(thumbPath);
        return {
            ...(inserted as UserFileRow),
            thumbUrl: signed,
        };
    };

    const resolveThumbUrl = async (thumbPath: string): Promise<string | null> => {
        const { data: signedData, error: signedError } = await supabase.storage
            .from('thumbs')
            .createSignedUrl(thumbPath, 3600);

        if (!signedError && signedData?.signedUrl) {
            return signedData.signedUrl;
        }

        if (signedError) {
            console.error('[Inventory] signed url error', signedError, thumbPath);
        }

        const { data: publicData } = supabase.storage.from('thumbs').getPublicUrl(thumbPath);
        return publicData?.publicUrl || null;
    };

    const mapRowToItem = (row: InventoryAttachment): InventoryItem => ({
        id: row.id,
        category: activeCategory,
        mediaType: 'image',
        mediaUrl: row.thumbUrl || '',
        name: row.title || 'Inventory Image',
        details: row.notes || undefined,
        importance: (row.meta as Record<string, unknown> | undefined)?.importance as InventoryItem['importance'] | undefined,
    });

    const cloudItems = itemAttachments.map(mapRowToItem);
    const filteredItems = cloudItems;
    const selectedItem = cloudItems.find(i => i.id === selectedItemId) || cloudItems[0] || null;

    useEffect(() => {
        if (!filteredItems.length) {
            setSelectedItemId(null);
            return;
        }
        if (!selectedItemId || !filteredItems.find(i => i.id === selectedItemId)) {
            setSelectedItemId(filteredItems[0].id);
        }
    }, [filteredItems, selectedItemId]);

    useEffect(() => {
        let isCancelled = false;
        const run = async () => {
            if (!activeUserId) {
                setItemAttachments([]);
                setAttachmentsLoading(false);
                setAttachmentsError('');
                return;
            }
            setAttachmentsLoading(true);
            setAttachmentsError('');
            try {
                const { data, error } = await supabase
                    .from('user_files')
                    .select('*')
                    .eq('user_id', activeUserId)
                    .eq('owner_type', 'inventory')
                    .eq('owner_id', activeCategoryOwnerId)
                    .order('created_at', { ascending: false });
                if (error) {
                    console.error('[Inventory] fetch error', error);
                    throw error;
                }

                const rows = (data || []) as UserFileRow[];
                const signedRows = await Promise.all(rows.map(async (row) => {
                    const resolved = await resolveThumbUrl(row.thumb_path);
                    return {
                        ...row,
                        thumbUrl: resolved,
                    };
                }));
                if (!isCancelled) {
                    setItemAttachments(signedRows);
                }
            } catch (error) {
                console.error('[Inventory] fetch error', error);
                if (!isCancelled) {
                    setItemAttachments([]);
                    setAttachmentsError('Failed to load media');
                }
            } finally {
                if (!isCancelled) setAttachmentsLoading(false);
            }
        };
        run();
        return () => {
            isCancelled = true;
        };
    }, [activeUserId, activeCategoryOwnerId]);

    const refreshAttachmentsForCategory = async () => {
        if (!activeUserId) {
            console.error('[Inventory] missing session/user during refresh');
            setItemAttachments([]);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('user_files')
                .select('*')
                .eq('user_id', activeUserId)
                .eq('owner_type', 'inventory')
                .eq('owner_id', activeCategoryOwnerId)
                .order('created_at', { ascending: false });
            if (error) {
                console.error('[Inventory] fetch error', error);
                throw error;
            }
            const rows = (data || []) as UserFileRow[];
            const signedRows = await Promise.all(rows.map(async (row) => {
                const resolved = await resolveThumbUrl(row.thumb_path);
                return {
                    ...row,
                    thumbUrl: resolved,
                };
            }));
            setItemAttachments(signedRows);
        } catch (error) {
            console.error('[Inventory] fetch error', error);
        }
    };

    const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setAttachmentsUploading(true);
        setAttachmentsError('');
        try {
            if (!(file.type || '').toLowerCase().startsWith('image/')) {
                throw new Error('Only images are supported');
            }
            const next = await uploadInventoryImage(file, activeCategoryOwnerId);
            setItemAttachments(prev => [next, ...prev]);
            playSuccessSound();
            await refreshAttachmentsForCategory();
        } catch (error) {
            console.warn('[inventory] Failed to attach media', error);
            setAttachmentsError('Upload failed (sign in and try again)');
            playErrorSound();
        } finally {
            setAttachmentsUploading(false);
            if (attachmentInputRef.current) attachmentInputRef.current.value = '';
        }
    };

    const handleOpenAttachmentViewer = async (attachment: InventoryAttachment) => {
        setViewerLoading(false);
        setAttachmentViewer({
            item: attachment,
            sourceUrl: attachment.thumbUrl,
            mime: attachment.mime,
        });
    };

    const closeAttachmentViewer = () => {
        setAttachmentViewer(null);
    };

    const handleRemoveAttachment = async (attachment: InventoryAttachment, event?: React.MouseEvent) => {
        event?.stopPropagation();
        try {
            if (!activeUserId) throw new Error('Sign in required');
            const { error: rowDeleteError } = await supabase
                .from('user_files')
                .delete()
                .eq('id', attachment.id)
                .eq('user_id', activeUserId);
            if (rowDeleteError) throw rowDeleteError;
            if (attachment.thumb_path) {
                await supabase.storage.from('thumbs').remove([attachment.thumb_path]);
            }
            setItemAttachments(prev => prev.filter(item => item.id !== attachment.id));
            if (attachmentViewer?.item.id === attachment.id) {
                closeAttachmentViewer();
            }
            playSuccessSound();
        } catch (error) {
            console.warn('[inventory] Failed to remove attachment', error);
            setAttachmentsError('Delete failed');
            playErrorSound();
        }
    };

    // 4-level importance indicator colors (requested): purple / red / yellow / white
    const importanceColor = (imp?: InventoryItem['importance']) => {
        switch (imp) {
            case 'high': return '#a855f7';     // purple
            case 'critical': return '#FF2A3A'; // red
            case 'medium': return '#ffd000';   // yellow
            case 'low': return '#f4f4f5';      // white-ish
            default: return '#f4f4f5';
        }
    };

    const handleAddSlot = () => {
        setUploadTargetId(null);
        setPreviewRotation(0);
        fileInputRef.current?.click();
        playSuccessSound();
    };

    const handleDeleteSlot = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const target = itemAttachments.find((row) => row.id === id);
        if (!target) return;
        handleRemoveAttachment(target, e);
    };

    const scheduleRotationReset = () => {
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = window.setTimeout(() => {
            setPreviewRotation(0);
        }, 3000);
    };

    useEffect(() => {
        return () => {
            if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
            }
        };
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        dragStateRef.current = {
            dragging: true,
            startX: e.clientX,
            startRotation: previewRotation
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStateRef.current.dragging) return;
        const delta = e.clientX - dragStateRef.current.startX;
        const next = Math.max(-60, Math.min(60, dragStateRef.current.startRotation + delta * 0.2));
        setPreviewRotation(next);
        scheduleRotationReset();
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        dragStateRef.current.dragging = false;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        scheduleRotationReset();
    };

    const handleUploadClick = (id: string) => {
        setUploadTargetId(id);
        setSelectedItemId(id);
        setPreviewRotation(0);
        fileInputRef.current?.click();
        playClickSound();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const replacingAttachment = uploadTargetId ? itemAttachments.find((row) => row.id === uploadTargetId) || null : null;
        const targetCategoryOwnerId = activeCategoryOwnerId;

        try {
            if (!(file.type || '').toLowerCase().startsWith('image/')) {
                throw new Error('Only image files are supported for cloud inventory uploads');
            }
            if (!activeUserId) {
                throw new Error('Sign in is required to upload inventory media');
            }

            const uploaded = await uploadInventoryImage(file, targetCategoryOwnerId);
            if (replacingAttachment) {
                const { error: rowDeleteError } = await supabase
                    .from('user_files')
                    .delete()
                    .eq('id', replacingAttachment.id)
                    .eq('user_id', activeUserId);
                if (rowDeleteError) {
                    console.error('[Inventory] DB delete error while replacing item', rowDeleteError);
                }
                if (replacingAttachment.thumb_path) {
                    const { error: storageDeleteError } = await supabase.storage
                        .from('thumbs')
                        .remove([replacingAttachment.thumb_path]);
                    if (storageDeleteError) {
                        console.error('[Inventory] storage remove error while replacing item', storageDeleteError);
                    }
                }
            }
            playSuccessSound();
            await refreshAttachmentsForCategory();
            setSelectedItemId(uploaded.id);
        } catch (err) {
            console.error('[Inventory] upload flow error', err);
            setAttachmentsError(err instanceof Error ? err.message : 'Upload failed');
            playErrorSound();
        }
        
        setUploadTargetId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const renderMedia = (item: InventoryItem, variant: 'grid' | 'detail') => {
        const isDetail = variant === 'detail';
        const commonClass = isDetail ? 'w-full h-full object-contain' : 'w-full h-full object-cover';
        const mediaUrl = item.mediaUrl;
        if (!item.mediaUrl) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center text-[var(--ui-border)]">
                    <Box size={32} className="mb-2 opacity-50" />
                    <span className="text-[10px] font-mono uppercase tracking-widest">Empty Slot</span>
                    <div className="mt-2 text-[8px] border border-current px-2 py-0.5">CLICK TO UPLOAD</div>
                </div>
            );
        }
        if (item.mediaType === 'video') {
            return <video src={mediaUrl} autoPlay loop muted playsInline className={commonClass} />;
        }
        if (item.mediaType === 'image') {
            // Transparent PNGs will simply show the current theme color behind them.
            return <img src={mediaUrl || item.mediaUrl} alt="Inventory Item" className={commonClass} />;
        }
        if (item.mediaType === 'model') {
            // model-viewer reliably supports glb/gltf/usdz. For other formats, show a download.
            const lowerName = (item.name || '').toLowerCase();
            const supported = /\.(glb|gltf|usdz)$/.test(lowerName);
            if (!supported) {
                return (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[var(--ui-muted)] gap-2">
                        <Box size={30} className="opacity-60" />
                        <div className="text-[10px] font-mono uppercase tracking-widest">Model file</div>
                        <div className="text-[11px] text-[var(--ui-muted)] text-center px-3">
                            Preview not supported for this format. Download to view.
                        </div>
                        {mediaUrl ? (
                            <a
                                href={mediaUrl}
                                download={item.name || 'model'}
                                className="mt-2 text-[10px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-3 py-2 hover:border-white"
                            >
                                Download
                            </a>
                        ) : null}
                    </div>
                );
            }

            return (
                <model-viewer
                    src={mediaUrl || item.mediaUrl}
                    camera-controls
                    auto-rotate
                    autoplay
                    style={{ width: '100%', height: '100%', background: 'transparent' }}
                />
            );
        }
        return (
            <iframe 
                src={item.mediaUrl} 
                className={isDetail ? 'w-full h-full border-0' : 'w-full h-full border-0'}
                style={{ background: 'transparent', display: 'block' }}
                sandbox="allow-scripts allow-same-origin allow-forms"
                allow="autoplay; fullscreen; xr-spatial-tracking"
                allowFullScreen
                frameBorder="0"
                title="Embedded 3D"
            />
        );
    };

    return (
        <div className={(isValorantB ? 'p-10 ui-font ' : 'xt-inventory-shell p-8 ') + 'min-h-full custom-scrollbar flex flex-col'}>
            {/* Header */}
            {isValorantB ? (
              <div className="mb-10 ui-panel clip-cut-corner border border-white/15 bg-black/20 overflow-hidden">
                <div className="p-8 flex items-end justify-between gap-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">ARMORY</div>
                    <div className="ui-heading text-4xl text-white leading-none">INVENTORY</div>
                    <div className="mt-2 text-[12px] text-white/65">Slots • Media • Models • Notes</div>
                  </div>
                  <div className="clip-cut-corner border border-white/10 bg-black/30 px-5 py-4">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">CAPACITY</div>
                    <div className="ui-heading text-3xl text-[var(--ui-accent)]">{filteredItems.length}</div>
                  </div>
                </div>
                <div className="h-[1px] bg-[linear-gradient(90deg,transparent,rgba(255,70,85,0.7),transparent)]" />
              </div>
            ) : (
              <div className="xt-inventory-header flex items-center justify-between mb-8 pb-4">
                <div>
                  <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Armory Database</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 bg-[var(--ui-accent)] animate-pulse"></span>
                    <span className="text-[var(--ui-muted)] font-mono tracking-widest text-xs">INVENTORY_SYSTEM_V2.0</span>
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-[var(--ui-muted)]">CAPACITY: {filteredItems.length} / UNLIMITED</div>
              </div>
            )}

            {/* Category Navigation */}
            {isValorantB ? (
              <div className="mb-8 ui-panel clip-cut-corner border border-white/12 bg-black/20 p-4 flex items-center gap-2 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); playClickSound(); }}
                    onMouseEnter={playHoverSound}
                    className={
                      'h-10 px-4 clip-cut-corner border uppercase tracking-[0.25em] text-[10px] flex items-center gap-2 transition-colors ' +
                      (activeCategory === cat
                        ? 'bg-[var(--ui-accent)] border-[var(--ui-accent)] text-black font-bold'
                        : 'bg-black/20 border-white/10 text-white/70 hover:text-white hover:border-white/25')
                    }
                  >
                    {categoryIcons[cat]}
                    {cat}
                  </button>
                ))}
              </div>
            ) : (
              <div className="xt-inventory-nav flex gap-4 mb-8">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); playClickSound(); }}
                    onMouseEnter={playHoverSound}
                    className={
                      `
                            xt-inventory-nav-btn px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all duration-300 border flex items-center gap-2
                            ${activeCategory === cat 
                                ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                                : 'bg-[var(--ui-surface)] text-[var(--ui-muted)] border-[var(--ui-border)] hover:text-white hover:border-white'}
                        `
                    }
                  >
                    {categoryIcons[cat]}
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Detail + Grid Area */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6">

                {/* Grid Area (left on desktop) */}
                <div 
                    className="inventory-grid grid gap-6 flex-none order-2 lg:order-1" 
                    style={{
                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                        gridAutoRows: '240px',
                        gridAutoFlow: 'row',
                        maxWidth: 1040,
                        width: '100%',
                        flexBasis: 1040,
                        flexGrow: 0,
                        flexShrink: 1,
                    }}
                >
                    
                    {/* Items */}
                    {filteredItems.map(item => (
                        <HexCard 
                            key={item.id} 
                            onClick={() => { setSelectedItemId(item.id); setDetailEditOpen(false); }}
                            className={`inventory-slot h-full group cursor-pointer p-0 relative overflow-hidden w-full ${selectedItem?.id === item.id ? 'is-selected' : ''}`}
                        >
                            {item.mediaUrl ? (
                                <>
                                    {renderMedia(item, 'grid')}
                                    {/* importance mark (bottom-left triangle) */}
                                    <div className="inventory-slot-mark" style={{ color: importanceColor(item.importance) }} />
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-[var(--ui-border)] group-hover:text-[var(--ui-accent)] transition-colors">
                                    <Box size={32} className="mb-2 opacity-50" />
                                    <span className="text-[10px] font-mono uppercase tracking-widest">Empty Slot</span>
                                    <div className="mt-2 text-[8px] border border-current px-2 py-0.5">CLICK TO UPLOAD</div>
                                </div>
                            )}

                            {/* Hover Actions Overlay */}
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                <button 
                                    className="p-2 border border-white text-white hover:bg-white hover:text-black transition-colors"
                                    title="Change Media"
                                    onClick={() => handleUploadClick(item.id)}
                                >
                                    <Upload size={16} />
                                </button>
                                <button 
                                    onClick={(e) => handleDeleteSlot(item.id, e)}
                                    className="p-2 border border-[var(--ui-accent)] text-[var(--ui-accent)] hover:bg-[var(--ui-accent)] hover:text-white transition-colors"
                                    title="Delete Slot"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* Tech Corners */}
                            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 group-hover:border-[var(--ui-accent)]"></div>
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 group-hover:border-[var(--ui-accent)]"></div>
                        </HexCard>
                    ))}

                    {/* Add Button */}
                    <button
                        onClick={() => { handleAddSlot(); }}
                        onMouseEnter={playHoverSound}
                        className="inventory-slot h-[240px] relative overflow-hidden flex flex-col items-center justify-center text-[var(--ui-muted)] hover:text-white transition-all group w-full"
                        type="button"
                    >
                        <div className="inventory-slot-mark" style={{ color: '#FF2A3A' }} />
                        <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-widest">Add Slot</span>
                    </button>
                </div>

                {/* Detail View (right on desktop) */}
                <div className="relative min-h-[260px] lg:basis-[40%] lg:max-w-[40%] order-1 lg:order-2 lg:sticky lg:top-6 self-start ml-auto">
                    {selectedItem ? (
                        <>
                            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(255,42,58,0.10),transparent_45%)]" />

                            {/* Media Frame */}
                            <div
                                className="xt-inventory-preview relative clip-cut-corner overflow-hidden inventory-preview-frame"
                                style={{ aspectRatio: '4 / 3' }}
                            >
                                {/* corner ticks */}
                                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/20" />
                                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-white/10" />
                                <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-white/10" />
                                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/20" />

                                {/* importance wedge */}
                                <div
                                    className="absolute bottom-0 left-0 z-10 w-0 h-0 border-t-[22px] border-t-transparent border-r-[22px]"
                                    style={{ borderRightColor: importanceColor(selectedItem.importance) }}
                                />

                                {/* settings button */}
                                <button
                                    className="xt-inventory-icon-btn absolute top-3 right-3 z-20 w-10 h-10 flex items-center justify-center text-[var(--app-text)]"
                                    title="Edit item"
                                    onClick={(e) => { e.stopPropagation(); setDetailEditOpen(v => !v); }}
                                >
                                    <Settings size={18} />
                                </button>

                                <div className="absolute inset-0 z-0">
                                    {selectedItem?.mediaType === 'model' ? (
                                        <model-viewer
                                            src={selectedItem.mediaUrl}
                                            camera-controls
                                            auto-rotate
                                            autoplay
                                            style={{ width: '100%', height: '100%', background: 'transparent' }}
                                        />
                                    ) : (
                                        <div
                                            className="w-full h-full"
                                            style={{ perspective: '900px' }}
                                            onPointerDown={handlePointerDown}
                                            onPointerMove={handlePointerMove}
                                            onPointerUp={handlePointerUp}
                                            onPointerLeave={handlePointerUp}
                                        >
                                            <div
                                                className="absolute inset-0 flex items-center justify-center"
                                                style={{
                                                    transform: `rotateY(${previewRotation}deg)`,
                                                    transformStyle: 'preserve-3d',
                                                    transition: dragStateRef.current.dragging ? 'none' : 'transform 0.2s ease-out'
                                                }}
                                            >
                                                <div className="w-full h-full">{renderMedia(selectedItem, 'detail')}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Text / Details */}
                            <div className="xt-inventory-detail-card mt-4 clip-cut-corner p-4">
                                {detailEditOpen ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--ui-muted)]">Edit item</div>
                                            <select
                                                value={selectedItem.importance || 'high'}
                                                onChange={() => {}}
                                                disabled
                                                className="xt-inventory-input px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--app-text)]"
                                                title="Importance"
                                            >
                                                <option value="low">LOW</option>
                                                <option value="medium">MED</option>
                                                <option value="high">HIGH</option>
                                                <option value="critical">CRIT</option>
                                            </select>
                                        </div>

                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--ui-muted)]">Main title</div>
                                            <input
                                                value={selectedItem.name || ''}
                                                onChange={() => {}}
                                                readOnly
                                                className="xt-inventory-input mt-2 w-full px-3 py-2 text-sm font-mono text-[var(--app-text)]"
                                                placeholder="Title…"
                                            />
                                        </div>

                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--ui-muted)]">Detailed text (optional)</div>
                                            <textarea
                                                value={selectedItem.details || ''}
                                                onChange={() => {}}
                                                readOnly
                                                className="xt-inventory-input xt-inventory-textarea mt-2 w-full px-3 py-2 text-sm font-mono text-[var(--app-text)]"
                                                placeholder="Add detailed text…"
                                                rows={4}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-base font-bold uppercase tracking-widest text-white">
                                            {selectedItem.name || 'UNTITLED'}
                                        </div>
                                        {selectedItem.details ? (
                                            <div className="mt-2 text-sm text-[var(--ui-muted)] whitespace-pre-wrap">{selectedItem.details}</div>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            <div className="xt-inventory-detail-card mt-4 clip-cut-corner p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--ui-muted)]">Media</div>
                                        <div className="text-[11px] text-[var(--ui-muted)]">
                                            {activeUserId ? 'Cloud thumbnails (Supabase)' : 'Sign in required for cloud upload'}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="xt-inventory-action px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-[var(--ui-muted)] hover:text-white disabled:opacity-60"
                                        onClick={() => attachmentInputRef.current?.click()}
                                        disabled={attachmentsUploading || !selectedItem}
                                    >
                                        {attachmentsUploading ? 'Uploading...' : 'Add Media'}
                                    </button>
                                </div>

                                {attachmentsError ? (
                                    <div className="mt-3 text-[11px] text-[var(--ui-accent)]">{attachmentsError}</div>
                                ) : null}

                                {attachmentsLoading ? (
                                    <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--ui-muted)]">
                                        <Loader2 size={14} className="animate-spin" />
                                        Loading media...
                                    </div>
                                ) : itemAttachments.length ? (
                                    <div className="mt-4 grid grid-cols-4 gap-2">
                                        {itemAttachments.map((attachment) => (
                                            <div
                                                key={attachment.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => handleOpenAttachmentViewer(attachment)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        handleOpenAttachmentViewer(attachment);
                                                    }
                                                }}
                                                className="xt-inventory-attachment group relative aspect-square overflow-hidden cursor-pointer"
                                                title={attachment.title || 'Media'}
                                            >
                                                {attachment.thumbUrl ? (
                                                    <img src={attachment.thumbUrl} alt={attachment.title || 'Media thumbnail'} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[9px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">
                                                        No thumb
                                                    </div>
                                                )}
                                                <div className="xt-inventory-chip absolute left-1 bottom-1 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.15em] text-white">
                                                    cloud
                                                </div>
                                                <button
                                                    type="button"
                                                    className="xt-inventory-icon-btn absolute top-1 right-1 h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                                                    onClick={(event) => handleRemoveAttachment(attachment, event)}
                                                    title="Delete media"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-4 text-[11px] text-[var(--ui-muted)]">No media attached yet.</div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-[var(--ui-muted)] font-mono uppercase tracking-[0.2em]">
                            No slots in this category. Add one to begin.
                        </div>
                    )}
                </div>
            </div>

            {/* Ledger Items — local-first data model (no Supabase required) */}
            <div className="xt-inventory-system-card mt-8 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
                            Ledger Items — {activeCategory}
                        </div>
                        <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                            Offline-first items stored in your XP ledger
                        </div>
                    </div>
                    <span className="font-mono text-[9px] text-[var(--app-muted)]">{activeLedgerSlots.length}</span>
                </div>

                <div className="flex gap-2 mb-3">
                    <input
                        value={newLedgerItemName}
                        onChange={(e) => setNewLedgerItemName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLedgerItem(); } }}
                        className="xt-inventory-input flex-1 px-2.5 py-1.5 text-[12px] text-[var(--app-text)]"
                        placeholder={`New ${activeCategory.toLowerCase()} item name`}
                    />
                    <button
                        type="button"
                        onClick={handleAddLedgerItem}
                        className="xt-inventory-icon-btn inline-flex h-8 w-8 shrink-0 items-center justify-center"
                        aria-label="Add ledger item"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {activeLedgerSlots.length > 0 ? (
                    <div className="space-y-1">
                        {activeLedgerSlots.map((slot) => (
                            <div
                                key={slot.id}
                                className="xt-inventory-ledger-row flex items-center gap-2 px-2.5 py-1.5"
                            >
                                {editingLedgerSlotId === slot.id ? (
                                    <input
                                        autoFocus
                                        value={editingLedgerSlotName}
                                        onChange={(e) => setEditingLedgerSlotName(e.target.value)}
                                        onBlur={() => handleSaveLedgerSlot(slot.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveLedgerSlot(slot.id);
                                            if (e.key === 'Escape') { setEditingLedgerSlotId(null); }
                                        }}
                                        className="flex-1 bg-transparent text-[12px] text-[var(--app-text)] outline-none"
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleStartEditLedgerSlot(slot)}
                                        className="flex-1 text-left text-[12px] text-[var(--app-text)] hover:text-[var(--app-accent)] transition-colors truncate"
                                    >
                                        {slot.name}
                                    </button>
                                )}
                                {slot.importance ? (
                                    <span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-[var(--app-muted)] font-mono">
                                        {slot.importance}
                                    </span>
                                ) : null}
                                <button
                                    type="button"
                                    aria-label="Delete ledger item"
                                    onClick={() => { deleteInventorySlot(slot.id); playClickSound(); }}
                                    className="xt-inventory-icon-btn shrink-0 inline-flex h-6 w-6 items-center justify-center text-[var(--app-muted)]"
                                >
                                    <Trash2 size={11} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-[10px] text-[var(--app-muted)]">
                        No ledger items for this category. Add one above.
                    </div>
                )}
            </div>

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={[
                    'image/*',
                    '.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.svg,.heic',
                    'video/*,.mp4,.webm,.mov,.m4v,.avi,.mkv,.mpeg,.mpg,.mpeg4',
                    '.glb,.gltf,.usdz,.fbx,.obj,.stl,.dae,.blend,.3ds,.ply,.abc,.x3d,.off,.bvh,.step,.stp,.iges,.igs'
                ].join(',')}
                onChange={handleFileChange}
            />
            <input
                type="file"
                ref={attachmentInputRef}
                className="hidden"
                accept="image/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
                onChange={handleAttachmentUpload}
            />

            {attachmentViewer ? (
                <div className="fixed inset-0 z-[220] bg-black/70 flex items-center justify-center p-6" onMouseDown={closeAttachmentViewer}>
                    <div
                        className="xt-inventory-viewer w-full max-w-4xl overflow-hidden"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ui-border)]">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Attachment Viewer</div>
                                <div className="text-sm text-white truncate">{attachmentViewer.item.title || 'Media file'}</div>
                            </div>
                            <button
                                type="button"
                                className="xt-inventory-icon-btn w-9 h-9 flex items-center justify-center"
                                onClick={closeAttachmentViewer}
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-4 min-h-[360px] flex items-center justify-center bg-[var(--ui-bg)]">
                            {viewerLoading ? (
                                <div className="flex items-center gap-2 text-[var(--ui-muted)] text-sm">
                                    <Loader2 size={16} className="animate-spin" />
                                    Loading media...
                                </div>
                            ) : attachmentViewer.sourceUrl ? (
                                attachmentViewer.mime?.startsWith('video/') ? (
                                    <video
                                        src={attachmentViewer.sourceUrl}
                                        controls
                                        className="max-h-[70vh] max-w-full rounded-lg border border-[var(--ui-border)]"
                                    />
                                ) : attachmentViewer.mime?.startsWith('image/') || !attachmentViewer.mime ? (
                                    <img
                                        src={attachmentViewer.sourceUrl}
                                        alt={attachmentViewer.item.title || 'Attachment'}
                                        className="max-h-[70vh] max-w-full object-contain rounded-lg border border-[var(--ui-border)]"
                                    />
                                ) : (
                                    <a
                                        href={attachmentViewer.sourceUrl}
                                        download={attachmentViewer.item.title || 'attachment'}
                                        className="xt-inventory-action px-4 py-2 text-[12px] uppercase tracking-[0.15em] text-[var(--app-text)]"
                                    >
                                        Download File
                                    </a>
                                )
                            ) : (
                                <div className="text-center">
                                    <div className="text-sm text-[var(--ui-muted)]">
                                        Preview unavailable for this attachment.
                                    </div>
                                    {attachmentViewer.item.thumbUrl ? (
                                        <img
                                            src={attachmentViewer.item.thumbUrl}
                                            alt="Thumbnail preview"
                                            className="mt-4 w-40 h-40 object-cover rounded-lg border border-[var(--ui-border)] mx-auto"
                                        />
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="xt-inventory-system-card mt-8 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
                            System Assets
                        </div>
                        <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                            Active themes, widgets, and modules working inside XTATION right now
                        </div>
                    </div>
                    <span className="font-mono text-[9px] text-[var(--app-muted)]">{activeCapabilityItems.length}</span>
                </div>

                {activeCapabilityItems.length ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {activeCapabilityItems.map((item) => (
                            <div
                                key={item.id}
                                className="xt-inventory-system-item px-3 py-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text)]">
                                            {item.title}
                                        </div>
                                        <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                            {item.kind} · {item.sourceLabel}
                                        </div>
                                    </div>
                                    <div className="xt-inventory-chip shrink-0 px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                        active
                                    </div>
                                </div>

                                <div className="mt-3 text-[12px] leading-5 text-[var(--ui-muted)]">
                                    {item.description}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {item.highlights.slice(0, 3).map((highlight) => (
                                        <span
                                            key={`${item.id}-${highlight}`}
                                            className="xt-inventory-chip px-2 py-1 text-[8px] uppercase tracking-[0.12em] text-[var(--ui-muted)]"
                                        >
                                            {highlight}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-[10px] text-[var(--app-muted)]">
                        No active system assets yet. Enable themes, widgets, or Lab modules in Store and they will appear here.
                    </div>
                )}
            </div>

            {/* Footer Status */}
            <div className="mt-8 border-t border-[var(--ui-border)] pt-4 flex justify-between text-[10px] text-[var(--ui-muted)] font-mono uppercase">
                <span>SECTION: {activeCategory}</span>
                <span>SYNC STATUS: {activeUserId ? 'CLOUD READY' : 'LOCAL ONLY'}</span>
            </div>
        </div>
    );
};
