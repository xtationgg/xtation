
import React, { useState, useRef, useEffect } from 'react';
import { HexButton, HexCard, HexPanel, HexDivider } from '../UI/HextechUI';
import { InventoryCategory, InventoryItem } from '../../types';
import { Plus, Trash2, Upload, Video, Image as ImageIcon, Box, Car, Wrench, Shirt, Cpu, Link } from 'lucide-react';
import { playClickSound, playHoverSound, playSuccessSound, playErrorSound } from '../../utils/SoundEffects';
import { readFileAsDataUrl } from '../../utils/fileUtils';

export const Inventory: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState<InventoryCategory>('OUTFIT');
    const [items, setItems] = useState<InventoryItem[]>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('inventoryItems');
            if (stored) {
                try {
                    return JSON.parse(stored) as InventoryItem[];
                } catch (err) {
                    console.error('Failed to parse stored inventory items', err);
                }
            }
        }
        return [];
    });
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [previewRotation, setPreviewRotation] = useState<number>(0);
    const resetTimerRef = useRef<number | null>(null);
    const dragStateRef = useRef<{ dragging: boolean; startX: number; startRotation: number }>({
        dragging: false,
        startX: 0,
        startRotation: 0
    });
    const [resolvedMedia, setResolvedMedia] = useState<Record<string, string>>({});
    const toEmbedUrl = (url: string) => {
        const lower = url.toLowerCase();
        const sketchfabIdMatch = lower.match(/sketchfab\.com\/(?:3d-models\/[^/]+\/|models\/)([a-z0-9]{32})/);
        if (sketchfabIdMatch) {
            const id = sketchfabIdMatch[1];
            return `https://sketchfab.com/models/${id}/embed?autostart=1&ui_infos=0&ui_controls=0&ui_watermark=0&ui_settings=0&transparent=1`;
        }
        return url;
    };

    // IndexedDB helpers for large media (videos/gifs/models)
    const openMediaDB = () => new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('InventoryMediaDB', 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('media')) {
                db.createObjectStore('media');
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    const saveMediaToDB = async (file: File) => {
        const db = await openMediaDB();
        const key = `media-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const tx = db.transaction('media', 'readwrite');
        tx.objectStore('media').put(file, key);
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(null);
            tx.onerror = () => reject(tx.error);
        });
        return `idb:${key}`;
    };

    const loadMediaFromDB = async (idbKey: string) => {
        const key = idbKey.replace('idb:', '');
        const db = await openMediaDB();
        const tx = db.transaction('media', 'readonly');
        const req = tx.objectStore('media').get(key);
        const blob: Blob | undefined = await new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result as Blob | undefined);
            req.onerror = () => reject(req.error);
        });
        return blob || null;
    };

    const categories: InventoryCategory[] = ['OUTFIT', 'GEAR', 'VEHICLE', 'TOOLS'];

    const categoryIcons: Record<InventoryCategory, JSX.Element> = {
        OUTFIT: <Shirt size={14} />,
        GEAR: <Cpu size={14} />,
        VEHICLE: <Car size={14} />,
        TOOLS: <Wrench size={14} />
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('inventoryItems', JSON.stringify(items));
        }
    }, [items]);

    useEffect(() => {
        return () => {
            Object.values(resolvedMedia).forEach(url => URL.revokeObjectURL(url));
        };
    }, [resolvedMedia]);

    // Ensure model-viewer is loaded when needed
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!items.some(i => i.mediaType === 'model')) return;
        if (customElements.get('model-viewer')) return;
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://unpkg.com/@google/model-viewer@latest/dist/model-viewer.min.js';
        document.head.appendChild(script);
    }, [items]);

    // Keep selection in sync with active category
    useEffect(() => {
        const inCategory = items.filter(i => i.category === activeCategory);
        if (!inCategory.length) {
            setSelectedItemId(null);
            return;
        }
        if (!selectedItemId || !inCategory.find(i => i.id === selectedItemId)) {
            setSelectedItemId(inCategory[0].id);
        }
    }, [activeCategory, items, selectedItemId]);

    // Resolve idb-backed media
    useEffect(() => {
        const pending = items.filter(i => i.mediaUrl?.startsWith('idb:'));
        if (!pending.length) return;
        pending.forEach(item => {
            if (resolvedMedia[item.mediaUrl!]) return;
            loadMediaFromDB(item.mediaUrl!)
                .then(blob => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        setResolvedMedia(prev => ({ ...prev, [item.mediaUrl!]: url }));
                    }
                })
                .catch(err => console.error('Failed to resolve inventory media', err));
        });
    }, [items, resolvedMedia]);

    const filteredItems = items.filter(item => item.category === activeCategory);
    const selectedItem = items.find(i => i.id === selectedItemId && i.category === activeCategory) || filteredItems[0] || null;

    const handleAddSlot = () => {
        const catItems = items.filter(i => i.category === activeCategory);
        const lastItem = catItems[catItems.length - 1];
        if (lastItem && !lastItem.mediaUrl) {
            playErrorSound();
            setSelectedItemId(lastItem.id);
            return;
        }
        const newItem: InventoryItem = {
            id: Date.now().toString(),
            category: activeCategory,
            mediaType: 'image',
            name: `New ${activeCategory.toLowerCase()} Item`
        };
        setItems(prev => [...prev, newItem]);
        setSelectedItemId(newItem.id);
        setPreviewRotation(0);
        playSuccessSound();
    };

    const handleDeleteSlot = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setItems(prev => prev.filter(item => item.id !== id));
        playErrorSound();
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

    const getMediaTypeFromFile = (file: File): InventoryItem['mediaType'] => {
        const mime = file.type.toLowerCase();
        const name = file.name.toLowerCase();
        if (mime.startsWith('video') || /\.(mp4|webm|mov|m4v|avi|mkv|mpeg|mpg|mpeg4)$/i.test(name)) return 'video';
        if (
            mime.includes('model') ||
            /\.(glb|gltf|usdz|fbx|obj|stl|dae|blend|3ds|ply|abc|x3d|off|bvh|step|stp|iges|igs)$/i.test(name)
        ) return 'model';
        return 'image';
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTargetId) return;

        const type = getMediaTypeFromFile(file);

        try {
            const dataUrl = await readFileAsDataUrl(file);
            const approxSize = dataUrl.length * 0.75; // bytes
            const localLimit = 4.5 * 1024 * 1024;

            let storedUrl = dataUrl;
            if (approxSize > localLimit) {
                storedUrl = await saveMediaToDB(file);
            }
            
            setItems(prev => prev.map(item => 
                item.id === uploadTargetId 
                ? { ...item, mediaUrl: storedUrl, mediaType: type } 
                : item
            ));
        playSuccessSound();
    } catch (err) {
        console.error('Failed to load inventory media', err);
        playErrorSound();
        }
        
        setUploadTargetId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEmbedLink = () => {
        if (!uploadTargetId) return;
        const url = window.prompt('Paste embed or 3D object link (glb/iframe src):');
        if (!url) return;
        const transformed = toEmbedUrl(url);
        const lower = transformed.toLowerCase();
        let mediaType: InventoryItem['mediaType'] = 'embed';
        if (/\.(glb|gltf|usdz|fbx|obj|stl|dae|blend|3ds|ply|abc|x3d|off|bvh|step|stp|iges|igs)(\?|#|$)/.test(lower)) {
            mediaType = 'model';
        } else if (/\.(mp4|webm|mov|m4v|avi|mkv|mpeg|mpg|mpeg4)(\?|#|$)/.test(lower)) {
            mediaType = 'video';
        } else if (/\.(png|jpg|jpeg|gif|webp|bmp|tif|tiff|svg|heic)(\?|#|$)/.test(lower)) {
            mediaType = 'image';
        }
        setItems(prev => prev.map(item => 
            item.id === uploadTargetId 
            ? { ...item, mediaUrl: transformed, mediaType: mediaType } 
            : item
        ));
        playSuccessSound();
        setUploadTargetId(null);
    };

    const renderMedia = (item: InventoryItem, variant: 'grid' | 'detail') => {
        const isDetail = variant === 'detail';
        const commonClass = isDetail ? 'w-full h-full object-contain' : 'w-full h-full object-cover';
        const mediaUrl = item.mediaUrl?.startsWith('idb:') ? resolvedMedia[item.mediaUrl] : item.mediaUrl;
        if (!item.mediaUrl) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#333]">
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
            return <img src={mediaUrl || item.mediaUrl} alt="Inventory Item" className={commonClass} />;
        }
        if (item.mediaType === 'model') {
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
        <div className="p-8 h-full overflow-y-auto custom-scrollbar flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 border-b border-[#333] pb-4">
                <div>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Armory Database</h1>
                    <div className="flex items-center gap-2 mt-1">
                         <span className="w-2 h-2 bg-[#FF2A3A] animate-pulse"></span>
                         <span className="text-[#666] font-mono tracking-widest text-xs">INVENTORY_SYSTEM_V2.0</span>
                    </div>
                </div>
                <div className="text-right font-mono text-xs text-[#666]">
                    CAPACITY: {items.length} / UNLIMITED
                </div>
            </div>

            {/* Category Navigation */}
            <div className="flex gap-4 mb-8">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => { setActiveCategory(cat); playClickSound(); }}
                        onMouseEnter={playHoverSound}
                        className={`
                            px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all duration-300 border flex items-center gap-2
                            ${activeCategory === cat 
                                ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                                : 'bg-[#0A0A0A] text-[#666] border-[#333] hover:text-white hover:border-white'}
                        `}
                    >
                        {categoryIcons[cat]}
                        {cat}
                    </button>
                ))}
            </div>

            {/* Detail + Grid Area */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6">

                {/* Grid Area (left on desktop) */}
                <div 
                    className="grid gap-3 content-start justify-items-start flex-1 order-2 lg:order-1" 
                    style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gridAutoRows: 'auto' }}
                >
                    
                    {/* Items */}
                    {filteredItems.map(item => (
                        <HexCard 
                            key={item.id} 
                            onClick={() => setSelectedItemId(item.id)}
                            className={`aspect-square group cursor-pointer p-0 relative overflow-hidden bg-[#0A0A0A] border ${selectedItem?.id === item.id ? 'border-white' : 'border-[#333] hover:border-[#FF2A3A]'} transition-all mx-auto w-full`}
                        >
                            {item.mediaUrl ? (
                                <>
                                    {renderMedia(item, 'grid')}
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="text-[10px] text-white font-mono uppercase truncate">{item.mediaType} SOURCE</div>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-[#333] group-hover:text-[#FF2A3A] transition-colors">
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
                                    className="p-2 border border-[#5fb6ff] text-[#5fb6ff] hover:bg-[#5fb6ff] hover:text-black transition-colors"
                                    title="Embed Link"
                                    onClick={() => { setUploadTargetId(item.id); handleEmbedLink(); }}
                                >
                                    <Link size={16} />
                                </button>
                                <button 
                                    onClick={(e) => handleDeleteSlot(item.id, e)}
                                    className="p-2 border border-[#FF2A3A] text-[#FF2A3A] hover:bg-[#FF2A3A] hover:text-white transition-colors"
                                    title="Delete Slot"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* Tech Corners */}
                            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 group-hover:border-[#FF2A3A]"></div>
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 group-hover:border-[#FF2A3A]"></div>
                        </HexCard>
                    ))}

                    {/* Add Button */}
                    <button
                        onClick={() => { handleAddSlot(); }}
                        onMouseEnter={playHoverSound}
                        className="aspect-square border border-dashed border-[#333] bg-[#050505] flex flex-col items-center justify-center text-[#444] hover:text-white hover:border-white transition-all group mx-auto w-full"
                    >
                        <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-widest">Add Slot</span>
                    </button>
                </div>

                {/* Detail View (right on desktop) */}
                <div className="border border-[#333] bg-[#0A0A0A] p-4 relative overflow-hidden min-h-[260px] lg:w-2/5 order-1 lg:order-2">
                    {selectedItem ? (
                        <>
                            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(255,42,58,0.1),transparent_40%)]" />
                            <div className="flex items-center gap-4 mb-4 text-xs font-mono text-[#aaa] uppercase tracking-[0.2em]">
                                <span className="px-2 py-1 border border-[#333] text-white bg-[#111]">{selectedItem.mediaType}</span>
                                <span className="text-[#666] truncate">{selectedItem.name}</span>
                            </div>
                            {selectedItem?.mediaType === 'model' ? (
                                <div className="w-full max-w-full border border-[#222] mb-4 overflow-hidden relative bg-black" style={{ aspectRatio: '3 / 2' }}>
                                    <model-viewer
                                        src={selectedItem.mediaUrl?.startsWith('idb:') ? resolvedMedia[selectedItem.mediaUrl] : selectedItem.mediaUrl}
                                        camera-controls
                                        auto-rotate
                                        autoplay
                                        style={{ width: '100%', height: '100%', background: '#000' }}
                                    />
                                </div>
                            ) : (
                                <div 
                                    className="w-full max-w-full border border-[#222] mb-4 overflow-hidden relative bg-black"
                                    style={{ aspectRatio: '3 / 2', perspective: '900px' }}
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
                                        <div className="w-full h-full">
                                            {renderMedia(selectedItem, 'detail')}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-[10px] text-[#888] font-mono uppercase tracking-[0.2em]">
                                <span className="text-[#666]">
                                    {selectedItem?.mediaType === 'model' ? 'Drag inside model to rotate' : 'Drag to rotate'}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-[#444] font-mono uppercase tracking-[0.2em]">
                            No slots in this category. Add one to begin.
                        </div>
                    )}
                </div>
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

            {/* Footer Status */}
            <div className="mt-8 border-t border-[#333] pt-4 flex justify-between text-[10px] text-[#666] font-mono uppercase">
                <span>SECTION: {activeCategory}</span>
                <span>SYNC STATUS: ONLINE</span>
            </div>
        </div>
    );
};
