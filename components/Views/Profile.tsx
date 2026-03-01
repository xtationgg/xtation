import React, { useState, useRef, useEffect } from 'react';
import { Camera, Edit2, Check, X, Upload, Box, User, Activity, Award, BarChart2, Sword, Zap, Link2, FileText, Shield } from 'lucide-react';
import { ProfilePanel } from '../UI/ProfilePanel';
import { DrawerOverlay } from '../Profile/DrawerOverlay';
import { RewardVisual } from '../UI/RewardVisual';
import { RewardConfig, InventoryItem } from '../../types';
import { ASSETS } from '../../constants';
import { playClickSound, playSuccessSound, playHoverSound } from '../../utils/SoundEffects';
import { readFileAsDataUrl } from '../../utils/fileUtils';
import { useXP } from '../XP/xpStore';
import { LogCalendar } from '../XP/LogCalendar';
import { Activity as ProfileActivity } from './Activity';
import './ProfileHUD.css';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        autoplay?: boolean;
        ar?: boolean;
        'ar-modes'?: string;
        style?: React.CSSProperties;
      };
    }
  }
}

interface ProfileProps {
  rewardConfigs: RewardConfig[];
}

interface BioStats {
  name: string;
  gender: string;
  height: string;
  weight: string;
  age: string;
  birthdate: string;
  email: string;
}

export const Profile: React.FC<ProfileProps> = ({ rewardConfigs }) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'HEALTH' | 'ACHIEVEMENTS' | 'ACTIVITY' | 'LOG'>(() => {
    try {
      const stored = window.sessionStorage.getItem('profileActiveTab');
      if (stored === 'PROFILE' || stored === 'HEALTH' || stored === 'ACHIEVEMENTS' || stored === 'ACTIVITY' || stored === 'LOG') {
        return stored;
      }
    } catch {}
    return 'PROFILE';
  });
  const [summonerName, setSummonerName] = useState(() => localStorage.getItem('profileName') || 'Summoner Name');
  const [profileImage, setProfileImage] = useState(() => localStorage.getItem('profileImage') || ASSETS.PROFILE_ICON);
  const [coverImage, setCoverImage] = useState(() => localStorage.getItem('profileCover') || ASSETS.BACKGROUND_HOME);
  const [coverType, setCoverType] = useState<'image' | 'video'>(() => (localStorage.getItem('profileCoverType') as any) || 'image');
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string | null>(null);
  const [coverFit, setCoverFit] = useState<'contain' | 'cover'>(() => {
    try {
      const v = localStorage.getItem('profileCoverFit');
      if (v === 'contain' || v === 'cover') return v;
    } catch {}
    return 'cover';
  });
  const [characterModel, setCharacterModel] = useState<string>('');
  const [roleText, setRoleText] = useState(() => localStorage.getItem('profileRole') || 'Mid_Lane');
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [profileId, setProfileId] = useState(() => localStorage.getItem('profileId') || '#NA1 // US_WEST // NETWORK_STABLE');
  type SectionKey = 'BREATHING' | 'MEDITATION' | 'BODY';
  const [bioStats, setBioStats] = useState<BioStats>(() => {
    try {
      const stored = localStorage.getItem('profileBioStats');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      name: 'Summoner Name',
      gender: '',
      height: '',
      weight: '',
      age: '',
      birthdate: '',
      email: '',
    };
  });
  const healthSectionDefaults: Record<SectionKey, { model: string; video: string }> = {
    BREATHING: {
      model: localStorage.getItem('healthModel_BREATHING') || '',
      video: localStorage.getItem('healthVideo_BREATHING') || '',
    },
    MEDITATION: {
      model: localStorage.getItem('healthModel_MEDITATION') || '',
      video: localStorage.getItem('healthVideo_MEDITATION') || '',
    },
    BODY: {
      model: localStorage.getItem('healthModel_BODY') || '',
      video: localStorage.getItem('healthVideo_BODY') || '',
    },
  };
  const healthMeta: Record<SectionKey, { title: string; subtitle: string; icon: string; details: string[] }> = {
    BREATHING: {
      title: 'Breathing',
      subtitle: 'Relax and refresh',
      icon: '🫁',
      details: [
        'Improves focus and heart rate',
        'Better stress response',
        'Easy reset, highly effective',
      ],
    },
    MEDITATION: {
      title: 'Meditation',
      subtitle: 'Chill you !!',
      icon: '🧘',
      details: [
        'Lower stress, quiet mind',
        'Steady breath, better focus',
        'Fast mental reset',
      ],
    },
    BODY: {
      title: 'Body Exercises',
      subtitle: 'Light stretches to stay limber.',
      icon: '🏋️',
      details: [
        'Neck rolls & shoulder circles',
        'Hip openers & arm swings',
        '5-minute daily mobility',
      ],
    },
  };
  const [sectionMedia, setSectionMedia] = useState<Record<SectionKey, { model: string; video: string }>>(healthSectionDefaults);
  const [sectionRunning, setSectionRunning] = useState<Record<SectionKey, boolean>>({
    BREATHING: false,
    MEDITATION: false,
    BODY: false,
  });
  const [sectionProgress, setSectionProgress] = useState<Record<SectionKey, number>>({
    BREATHING: 0,
    MEDITATION: 0,
    BODY: 0,
  });
  const [sectionDuration, setSectionDuration] = useState<Record<SectionKey, number>>({
    BREATHING: 0,
    MEDITATION: 0,
    BODY: 0,
  });
  const [sectionTimers, setSectionTimers] = useState<Record<SectionKey, { selected: number | null; remaining: number; running: boolean; startedAt: number | null }>>(() => {
    try {
      const raw = localStorage.getItem('profileSectionTimers');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<SectionKey, { selected: number | null; remaining: number; running: boolean; startedAt: number | null }>;
        if (parsed.BREATHING && parsed.MEDITATION && parsed.BODY) {
          return parsed;
        }
      }
    } catch {}
    return {
      BREATHING: { selected: null, remaining: 0, running: false, startedAt: null },
      MEDITATION: { selected: null, remaining: 0, running: false, startedAt: null },
      BODY: { selected: null, remaining: 0, running: false, startedAt: null },
    };
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const sectionModelInputs = useRef<Record<SectionKey, HTMLInputElement | null>>({ BREATHING: null, MEDITATION: null, BODY: null });
  const sectionVideoInputs = useRef<Record<SectionKey, HTMLInputElement | null>>({ BREATHING: null, MEDITATION: null, BODY: null });
  const sectionVideoRefs = useRef<Record<SectionKey, HTMLVideoElement | null>>({ BREATHING: null, MEDITATION: null, BODY: null });
  const sectionTimerRefs = useRef<Record<SectionKey, number | null>>({ BREATHING: null, MEDITATION: null, BODY: null });
  const sectionVideoObjectUrls = useRef<Record<SectionKey, string | null>>({ BREATHING: null, MEDITATION: null, BODY: null });
  const sectionModelObjectUrls = useRef<Record<SectionKey, string | null>>({ BREATHING: null, MEDITATION: null, BODY: null });
  const [resolvedHealthMedia, setResolvedHealthMedia] = useState<Record<SectionKey, { model?: string; video?: string }>>({
    BREATHING: {},
    MEDITATION: {},
    BODY: {},
  });
  const outfitSlotsOrder = ['HEAD', 'UPPER', 'LOWER', 'FEET', 'ACCESSORY_1', 'ACCESSORY_2'] as const;
  type OutfitSlot = typeof outfitSlotsOrder[number];
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [resolvedInventoryMedia, setResolvedInventoryMedia] = useState<Record<string, string>>({});
  const [selectedOutfitSlot, setSelectedOutfitSlot] = useState<OutfitSlot>('HEAD');
  const [equippedOutfit, setEquippedOutfit] = useState<Record<OutfitSlot, string | null>>(() => {
    try {
      const stored = localStorage.getItem('profileOutfitEquipped');
      if (stored) return JSON.parse(stored);
    } catch {}
    return { HEAD: null, UPPER: null, LOWER: null, FEET: null, ACCESSORY_1: null, ACCESSORY_2: null };
  });
  const objectUrlRef = useRef<string | null>(null);
  const CHARACTER_PLACEHOLDER_SRC = '/characters/placeholder.svg';

  const { stats: xpStats, legacyXP, tasks, selectors, dateKey } = useXP();

  useEffect(() => {
    try {
      window.sessionStorage.setItem('profileActiveTab', activeTab);
    } catch {}
  }, [activeTab]);
  useEffect(() => localStorage.setItem('profileName', summonerName), [summonerName]);
  useEffect(() => localStorage.setItem('profileRole', roleText), [roleText]);
  useEffect(() => { try { localStorage.setItem('profileCoverType', coverType); } catch {} }, [coverType]);
  useEffect(() => { try { localStorage.setItem('profileCoverFit', coverFit); } catch {} }, [coverFit]);
  useEffect(() => {
    localStorage.setItem('profileBioStats', JSON.stringify(bioStats));
  }, [bioStats]);
  useEffect(() => {
    localStorage.setItem('profileSectionTimers', JSON.stringify(sectionTimers));
  }, [sectionTimers]);
  useEffect(() => {
    localStorage.setItem('profileId', profileId);
  }, [profileId]);
  useEffect(() => {
    localStorage.setItem('profileOutfitEquipped', JSON.stringify(equippedOutfit));
  }, [equippedOutfit]);
  useEffect(() => {
    const stored = localStorage.getItem('inventoryItems');
    if (stored) {
      try {
        setInventoryItems(JSON.parse(stored) as InventoryItem[]);
      } catch (err) {
        console.error('Failed to parse inventory items', err);
      }
    }
  }, []);
  useEffect(() => {
    const pending = inventoryItems.filter(i => i.mediaUrl?.startsWith('idb:'));
    if (!pending.length) return;
    pending.forEach(item => {
      if (resolvedInventoryMedia[item.mediaUrl!]) return;
      loadMediaFromInventory(item.mediaUrl!)
        .then(blob => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setResolvedInventoryMedia(prev => ({ ...prev, [item.mediaUrl!]: url }));
          }
        })
        .catch(err => console.error('Failed to resolve inventory media', err));
    });
  }, [inventoryItems, resolvedInventoryMedia]);
  useEffect(() => {
    if (typeof window === 'undefined' || customElements.get('model-viewer')) {
      loadPersistedModel();
      return;
    }
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@google/model-viewer@latest/dist/model-viewer.min.js';
    script.onload = loadPersistedModel;
    document.head.appendChild(script);
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  const totalXP = xpStats.totalEarnedXP;
  const completedToday = selectors.getDayCompletions(dateKey).length;
  const activeMissions = tasks.filter(task => task.status === 'todo' || task.status === 'active').length;
  const sortedConfigs = [...rewardConfigs].sort((a, b) => b.threshold - a.threshold);
  const currentLevelConfig = sortedConfigs.find(c => totalXP >= c.threshold);
  const nextConfig = [...rewardConfigs].sort((a, b) => a.threshold - b.threshold).find(c => c.threshold > totalXP);
  const levelProgress = nextConfig ? Math.min(100, Math.floor((totalXP / nextConfig.threshold) * 100)) : 100;
  const currentMission = tasks.find(task => task.status === 'todo' || task.status === 'active');
  const activeSession = selectors.getActiveSession();

  // ── Lobby state ────────────────────────────────────────────────────────
  type LobbyPanelKey = 'identity' | 'stats' | 'loadout' | 'skills' | 'titles' | 'links' | 'notes' | 'privacy';
  const [lobbyOpenPanel, setLobbyOpenPanel] = useState<LobbyPanelKey | null>(null);
  const [lobbyNotes, setLobbyNotes] = useState(() => {
    try { return localStorage.getItem('xtation_profile_notes_v1') || ''; } catch { return ''; }
  });
  const [lobbyVisibility, setLobbyVisibility] = useState<'Private' | 'Circles' | 'Community'>('Private');
  const stageInnerRef = useRef<HTMLDivElement>(null);

  // ── Character Upload state ───────────────────────────────────────────
  const [stageImage, setStageImage] = useState<string>(() => {
    try { return localStorage.getItem('xtation_stage_img_v1') || ''; } catch { return ''; }
  });
  const [stageGlbKey, setStageGlbKey] = useState<string>(() => {
    try { return localStorage.getItem('xtation_stage_glb_key_v1') || ''; } catch { return ''; }
  });
  const [stageGlbName, setStageGlbName] = useState<string>(() => {
    try { return localStorage.getItem('xtation_stage_glb_name_v1') || ''; } catch { return ''; }
  });
  const [stageGlbUrl, setStageGlbUrl] = useState<string>('');
  const stageImageInputRef = useRef<HTMLInputElement>(null);
  const stageGlbInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => { playClickSound(); fileInputRef.current?.click(); };
  const handleCoverClick = () => { playClickSound(); coverInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await readFileAsDataUrl(file);
      setProfileImage(url);
      localStorage.setItem('profileImage', url);
      playSuccessSound();
    } catch (err) {
      console.error('Failed to load profile image', err);
    } finally { e.target.value = ''; }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const mime = (file.type || '').toLowerCase();
      const isVideo = mime.startsWith('video/') || /\.(mp4)$/i.test(file.name);
      const nextType: 'image' | 'video' = isVideo ? 'video' : 'image';

      // Prefer data URL for small files; fallback to IndexedDB for big covers.
      // (This keeps it stable for later public sharing.)
      const dataUrl = await readFileAsDataUrl(file);
      const approxSize = dataUrl.length * 0.75; // bytes
      const localLimit = 4.5 * 1024 * 1024;

      let storedValue: string = dataUrl;
      if (approxSize > localLimit) {
        const idbKey = await saveCoverToDB(file);
        storedValue = idbKey;
      }

      // clear old resolved object url
      setResolvedCoverUrl(prev => {
        if (prev) {
          try { URL.revokeObjectURL(prev); } catch {}
        }
        return null;
      });

      setCoverType(nextType);
      // default to fill so the cover always takes all space
      setCoverFit('cover');
      setCoverImage(storedValue);
      localStorage.setItem('profileCover', storedValue);
      playSuccessSound();
    } catch (err) {
      console.error('Failed to load cover', err);
    } finally {
      e.target.value = '';
    }
  };

  // resolve cover if stored in IndexedDB
  useEffect(() => {
    if (!coverImage?.startsWith('idb:')) {
      setResolvedCoverUrl(null);
      return;
    }

    let cancelled = false;
    loadCoverFromDB(coverImage)
      .then(blob => {
        if (cancelled) return;
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setResolvedCoverUrl(prev => {
          if (prev) {
            try { URL.revokeObjectURL(prev); } catch {}
          }
          return url;
        });
      })
      .catch(err => console.error('Failed to resolve cover', err));

    return () => {
      cancelled = true;
    };
  }, [coverImage]);

  const handleModelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await persistModel(file);
      playSuccessSound();
    } catch (err) {
      console.error('Failed to load model', err);
    } finally { e.target.value = ''; }
  };

  const startEditingName = () => { playClickSound(); setTempName(summonerName); setIsEditingName(true); };
  const saveName = () => { if (tempName.trim()) { setSummonerName(tempName.trim()); playSuccessSound(); } setIsEditingName(false); };
  const cancelEdit = () => { playClickSound(); setIsEditingName(false); };
  const saveRole = () => { if (roleText.trim()) { setRoleText(roleText.trim()); playSuccessSound(); } setIsEditingRole(false); };

  // Load persisted GLB from IndexedDB on mount
  useEffect(() => {
    if (!stageGlbKey) return;
    loadGlbFromDB(stageGlbKey).then(url => {
      if (url) setStageGlbUrl(url);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageGlbKey]);

  const handleStageImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const url = await readFileAsDataUrl(file);
      setStageImage(url);
      try { localStorage.setItem('xtation_stage_img_v1', url); } catch {}
      playSuccessSound();
    } catch {}
  };

  const handleStageGlbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const key = await saveGlbToDB(file);
      const blobUrl = URL.createObjectURL(file);
      setStageGlbKey(key);
      setStageGlbName(file.name);
      setStageGlbUrl(blobUrl);
      try { localStorage.setItem('xtation_stage_glb_key_v1', key); } catch {}
      try { localStorage.setItem('xtation_stage_glb_name_v1', file.name); } catch {}
      playSuccessSound();
    } catch {}
  };

  const openModelDB = () => new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('ProfileModelDB', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('models')) db.createObjectStore('models');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const saveGlbToDB = async (file: File): Promise<string> => {
    const db = await openModelDB();
    const key = `stage-glb-${Date.now()}`;
    const tx = db.transaction('models', 'readwrite');
    tx.objectStore('models').put(file, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return key;
  };

  const loadGlbFromDB = async (key: string): Promise<string | null> => {
    const db = await openModelDB();
    const tx = db.transaction('models', 'readonly');
    const req = tx.objectStore('models').get(key);
    const blob: Blob | undefined = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    return blob ? URL.createObjectURL(blob) : null;
  };

  const openHealthDB = () => new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('ProfileHealthMediaDB', 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('videos')) db.createObjectStore('videos');
      if (!db.objectStoreNames.contains('models')) db.createObjectStore('models');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // Cover media DB (for mp4/gif/etc when too large for localStorage)
  const openCoverDB = () => new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('ProfileCoverDB', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cover')) db.createObjectStore('cover');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const saveCoverToDB = async (file: File) => {
    const db = await openCoverDB();
    const key = `cover-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const tx = db.transaction('cover', 'readwrite');
    tx.objectStore('cover').put(file, key);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(null);
      tx.onerror = () => reject(tx.error);
    });
    return `idb:${key}`;
  };

  const loadCoverFromDB = async (idbKey: string) => {
    const key = idbKey.replace('idb:', '');
    const db = await openCoverDB();
    const tx = db.transaction('cover', 'readonly');
    const req = tx.objectStore('cover').get(key);
    const blob: Blob | undefined = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    return blob || null;
  };

  // Reuse inventory media persisted in Inventory view
  const openInventoryMediaDB = () => new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('InventoryMediaDB', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const loadMediaFromInventory = async (idbKey: string) => {
    const key = idbKey.replace('idb:', '');
    const db = await openInventoryMediaDB();
    const tx = db.transaction('media', 'readonly');
    const req = tx.objectStore('media').get(key);
    const blob: Blob | undefined = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    return blob || null;
  };

  const persistModel = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    const approxSize = dataUrl.length * 0.75;
    const localLimit = 4.5 * 1024 * 1024;
    if (approxSize < localLimit) {
      localStorage.setItem('profileCharacterModel', dataUrl);
      setCharacterModel(dataUrl);
      return;
    }
    const db = await openModelDB();
    const tx = db.transaction('models', 'readwrite');
    tx.objectStore('models').put(file, 'character');
    await new Promise((resolve, reject) => { tx.oncomplete = () => resolve(null); tx.onerror = () => reject(tx.error); });
    const url = URL.createObjectURL(file);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url;
    setCharacterModel(url);
    localStorage.removeItem('profileCharacterModel');
  };

  const loadPersistedModel = async () => {
    if (typeof window === 'undefined') return;
    const lsModel = localStorage.getItem('profileCharacterModel');
    if (lsModel) { setCharacterModel(lsModel); return; }
    try {
      const db = await openModelDB();
      const tx = db.transaction('models', 'readonly');
      const req = tx.objectStore('models').get('character');
      const blob: Blob | undefined = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result as Blob | undefined);
        req.onerror = () => reject(req.error);
      });
      if (blob) {
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setCharacterModel(url);
      }
    } catch (err) {
      console.error('Failed to load model from IndexedDB', err);
    }
  };

  const handleSectionModelChange = async (key: SectionKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const approxSize = dataUrl.length * 0.75;
      const localLimit = 4.5 * 1024 * 1024;
      const dbKey = `model_${key}`;
      if (approxSize < localLimit) {
        setSectionMedia(prev => ({ ...prev, [key]: { ...prev[key], model: dataUrl } }));
        localStorage.setItem(`healthModel_${key}`, dataUrl);
        if (sectionModelObjectUrls.current[key]) {
          URL.revokeObjectURL(sectionModelObjectUrls.current[key] as string);
          sectionModelObjectUrls.current[key] = null;
        }
      } else {
        const db = await openHealthDB();
        const tx = db.transaction('models', 'readwrite');
        tx.objectStore('models').put(file, dbKey);
        await new Promise((resolve, reject) => { tx.oncomplete = () => resolve(null); tx.onerror = () => reject(tx.error); });
        const url = URL.createObjectURL(file);
        if (sectionModelObjectUrls.current[key]) URL.revokeObjectURL(sectionModelObjectUrls.current[key] as string);
        sectionModelObjectUrls.current[key] = url;
        setSectionMedia(prev => ({ ...prev, [key]: { ...prev[key], model: url } }));
        localStorage.setItem(`healthModel_${key}`, `idb:${dbKey}`);
      }
      playSuccessSound();
    } catch (err) {
      console.error('Failed to load health model', err);
    } finally { e.target.value = ''; }
  };

  const handleSectionVideoChange = async (key: SectionKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const approxSize = dataUrl.length * 0.75;
      const localLimit = 4.5 * 1024 * 1024;
      const dbKey = `video_${key}`;
      if (approxSize < localLimit) {
        setSectionMedia(prev => ({ ...prev, [key]: { ...prev[key], video: dataUrl } }));
        localStorage.setItem(`healthVideo_${key}`, dataUrl);
        if (sectionVideoObjectUrls.current[key]) {
          URL.revokeObjectURL(sectionVideoObjectUrls.current[key] as string);
          sectionVideoObjectUrls.current[key] = null;
        }
      } else {
        const db = await openHealthDB();
        const tx = db.transaction('videos', 'readwrite');
        tx.objectStore('videos').put(file, dbKey);
        await new Promise((resolve, reject) => { tx.oncomplete = () => resolve(null); tx.onerror = () => reject(tx.error); });
        const url = URL.createObjectURL(file);
        if (sectionVideoObjectUrls.current[key]) URL.revokeObjectURL(sectionVideoObjectUrls.current[key] as string);
        sectionVideoObjectUrls.current[key] = url;
        setSectionMedia(prev => ({ ...prev, [key]: { ...prev[key], video: url } }));
        localStorage.setItem(`healthVideo_${key}`, `idb:${dbKey}`);
      }
      playSuccessSound();
    } catch (err) {
      console.error('Failed to load health video', err);
    } finally { e.target.value = ''; }
  };

  const clearSectionTimer = (key: SectionKey) => {
    if (sectionTimerRefs.current[key]) {
      clearInterval(sectionTimerRefs.current[key] as number);
      sectionTimerRefs.current[key] = null;
    }
  };

  useEffect(() => () => {
    (['BREATHING', 'MEDITATION', 'BODY'] as SectionKey[]).forEach(k => clearSectionTimer(k));
    (['BREATHING', 'MEDITATION', 'BODY'] as SectionKey[]).forEach(k => {
      if (sectionVideoObjectUrls.current[k]) URL.revokeObjectURL(sectionVideoObjectUrls.current[k] as string);
      if (sectionModelObjectUrls.current[k]) URL.revokeObjectURL(sectionModelObjectUrls.current[k] as string);
    });
  }, []);

  useEffect(() => {
    const loadHealthMedia = async () => {
      try {
        const db = await openHealthDB();
        const videoTx = db.transaction('videos', 'readonly');
        const modelTx = db.transaction('models', 'readonly');
        const loadStore = (store: IDBObjectStore, key: string, setter: (url: string) => void) =>
          new Promise<void>((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => {
              const blob = req.result as Blob | undefined;
              if (blob) {
                const url = URL.createObjectURL(blob);
                setter(url);
              }
              resolve();
            };
            req.onerror = () => reject(req.error);
          });

        await Promise.all(
          (['BREATHING', 'MEDITATION', 'BODY'] as SectionKey[]).map(key =>
            Promise.all([
              loadStore(videoTx.objectStore('videos'), `video_${key}`, url => {
                sectionVideoObjectUrls.current[key] = url;
                setResolvedHealthMedia(prev => ({ ...prev, [key]: { ...prev[key], video: url } }));
                setSectionMedia(prev => ({ ...prev, [key]: { ...prev[key], video: prev[key].video.startsWith('idb:') ? prev[key].video : url || prev[key].video } }));
              }),
              loadStore(modelTx.objectStore('models'), `model_${key}`, url => {
                sectionModelObjectUrls.current[key] = url;
                setResolvedHealthMedia(prev => ({ ...prev, [key]: { ...prev[key], model: url } }));
                setSectionMedia(prev => ({ ...prev, [key]: { ...prev[key], model: prev[key].model.startsWith('idb:') ? prev[key].model : url || prev[key].model } }));
              }),
            ])
          )
        );
      } catch (err) {
        console.error('Failed to load health media from DB', err);
      }
    };
    loadHealthMedia();
  }, []);

  useEffect(() => {
    (['BREATHING', 'MEDITATION', 'BODY'] as SectionKey[]).forEach(key => {
      const timer = sectionTimers[key];
      if (timer.running && timer.selected && timer.remaining > 0) {
        startSectionTimer(key, timer.selected, timer.remaining, timer.startedAt || undefined);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount to resume timers

  useEffect(() => {
    (['BREATHING', 'MEDITATION', 'BODY'] as SectionKey[]).forEach(key => {
      const video = sectionVideoRefs.current[key];
      const timer = sectionTimers[key];
      if (!video) return;
      if (timer.running && sectionMedia[key]?.video) {
        if (video.paused) {
          video.play().catch(() => {});
        }
      } else {
        video.pause();
      }
    });
  }, [sectionTimers, sectionMedia]);

  const stopSectionPlayback = (key: SectionKey) => {
    const video = sectionVideoRefs.current[key];
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };

  const startSectionTimer = (key: SectionKey, seconds: number, startRemaining?: number, startTimestamp?: number) => {
    clearSectionTimer(key);
    const effectiveRemaining = typeof startRemaining === 'number' ? startRemaining : seconds;
    const startedAt = typeof startTimestamp === 'number'
      ? startTimestamp
      : Date.now() - Math.max(0, (seconds - effectiveRemaining)) * 1000;
    setSectionDuration(prev => ({ ...prev, [key]: seconds }));
    setSectionProgress(prev => ({
      ...prev,
      [key]: Math.min(100, ((seconds - effectiveRemaining) / Math.max(1, seconds)) * 100),
    }));
    setSectionTimers(prev => ({ ...prev, [key]: { selected: seconds, remaining: effectiveRemaining, running: true, startedAt } }));
    setSectionRunning(prev => ({ ...prev, [key]: true }));

    const video = sectionVideoRefs.current[key];
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }

    sectionTimerRefs.current[key] = window.setInterval(() => {
      setSectionTimers(prev => {
        const current = prev[key];
        if (!current.running) return prev;
        const elapsed = current.startedAt ? (Date.now() - current.startedAt) / 1000 : 0;
        const remaining = Math.max(0, (current.selected || 0) - elapsed);
        if (remaining <= 0) {
          clearSectionTimer(key);
          stopSectionPlayback(key);
          setSectionRunning(p => ({ ...p, [key]: false }));
          setSectionProgress(p => ({ ...p, [key]: 0 }));
          return { ...prev, [key]: { selected: null, remaining: 0, running: false, startedAt: null } };
        }
        setSectionProgress(p => ({ ...p, [key]: Math.min(100, ((current.selected || 0) - remaining) / (current.selected || 1) * 100) }));
        return { ...prev, [key]: { ...current, remaining } };
      });
    }, 1000);
  };

  const stopSectionTimer = (key: SectionKey) => {
    clearSectionTimer(key);
    stopSectionPlayback(key);
    setSectionRunning(prev => ({ ...prev, [key]: false }));
    setSectionProgress(prev => ({ ...prev, [key]: 0 }));
    setSectionTimers(prev => ({ ...prev, [key]: { selected: null, remaining: 0, running: false, startedAt: null } }));
  };

  const TabButton: React.FC<{ label: string; value: typeof activeTab; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <button
      onClick={() => setActiveTab(value)}
      className={`px-3 py-1.5 border rounded-lg text-xs tracking-[0.2em] uppercase transition-all duration-200 flex items-center gap-2 ${
        activeTab === value
          ? 'border-[color-mix(in_srgb,var(--app-accent)_70%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] text-[var(--app-text)] shadow-[0_0_18px_color-mix(in_srgb,var(--app-accent)_22%,transparent)]'
          : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)] hover:text-[var(--app-text)]'
      }`}
    >
      <span className={activeTab === value ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'}>{icon}</span>
      {label}
    </button>
  );


  const dossierCard = (
    <div className="bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded-lg shadow-sm relative overflow-hidden">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div 
            className="relative group cursor-pointer w-[30%] min-w-[110px] max-w-[180px] aspect-square border border-[var(--app-border)] bg-[var(--app-panel-2)] overflow-hidden rounded-md"
            onClick={handleImageClick}
            onMouseEnter={playHoverSound}
          >
            <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--app-bg)_40%,transparent)] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera size={18} className="text-[var(--app-text)]" />
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/gif, image/jpg" onChange={handleFileChange}/>
          </div>
        </div>

        <div className="border border-[var(--ui-border)] bg-[var(--ui-panel-2)] p-3 space-y-2 rounded">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">Experience</div>
          <div className="text-3xl font-black text-[var(--ui-text)]">{totalXP} XP</div>
          {nextConfig && (
            <div className="text-[11px] text-[var(--ui-muted)] uppercase tracking-[0.2em]">Next Level {nextConfig.level}: {nextConfig.threshold} XP</div>
          )}
          <div className="w-full h-2 bg-[color-mix(in_srgb,var(--app-bg)_20%,transparent)] border border-[var(--ui-border)] rounded">
            <div className="h-full bg-[var(--ui-accent)] rounded" style={{ width: `${levelProgress}%` }}></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-[0.15em] text-[var(--app-muted)]">
          <div className="border border-[var(--app-border)] bg-[var(--app-panel)] p-3 rounded">
            <div className="text-[10px] text-[var(--app-muted)]">Active Missions</div>
            <div className="text-xl font-black text-[var(--app-text)]">{activeMissions}</div>
          </div>
          <div className="border border-[var(--app-border)] bg-[var(--app-panel)] p-3 rounded">
            <div className="text-[10px] text-[var(--app-muted)]">Completed Today</div>
            <div className="text-xl font-black text-[var(--app-text)]">{completedToday}</div>
          </div>
        </div>

        <button 
          onClick={handleCoverClick}
          onMouseEnter={playHoverSound}
          className="w-full text-[10px] uppercase tracking-[0.2em] border border-[var(--app-border)] bg-[var(--app-panel)] hover:border-[var(--app-accent)] py-2 flex items-center justify-center gap-2 text-[var(--app-muted)] rounded"
        >
          <Upload size={12}/> Change Cover
        </button>
        <input
          ref={coverInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,video/mp4"
          onChange={handleCoverChange}
        />
      </div>
    </div>
  );

  const modelViewerEnv = 'https://modelviewer.dev/shared-assets/environments/neutral.hdr';
  const formatSeconds = (value: number) => {
    const m = Math.floor(value / 60).toString().padStart(2, '0');
    const s = Math.floor(value % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const renderOutfitMedia = (item: InventoryItem | null, variant: 'slot' | 'list') => {
    if (!item) {
      return (
        <div className="w-full h-full flex items-center justify-center text-[var(--app-muted)]">
          <Box size={18} />
        </div>
      );
    }
    const mediaUrl = item.mediaUrl?.startsWith('idb:') ? resolvedInventoryMedia[item.mediaUrl] : item.mediaUrl;
    const common = variant === 'slot' ? 'w-full h-full object-contain' : 'w-full h-24 object-cover';
    if (item.mediaType === 'image') return <img src={mediaUrl} alt={item.name} className={common} />;
    if (item.mediaType === 'video') return <video src={mediaUrl} className={common} autoPlay loop muted playsInline />;
    if (item.mediaType === 'model')
      return (
        <model-viewer
          src={mediaUrl}
          camera-controls
          auto-rotate
          autoplay
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
      );
    return (
      <iframe
        src={mediaUrl}
        className="w-full h-full border-0"
        style={{ background: 'transparent', display: 'block' }}
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        title={item.name}
      />
    );
  };
  const outfitSlotLabels: Record<OutfitSlot, string> = {
    HEAD: 'Head',
    UPPER: 'Upper Body',
    LOWER: 'Lower Body',
    FEET: 'Feet',
    ACCESSORY_1: 'Accessory 1',
    ACCESSORY_2: 'Accessory 2',
  };
  const equipItemToSlot = (slot: OutfitSlot, itemId: string | null) => {
    setEquippedOutfit(prev => ({ ...prev, [slot]: itemId }));
  };
  const availableOutfitItems = inventoryItems.filter(i => i.category === 'OUTFIT');
  const formatBirthdateInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const parts = [];
    if (digits.length > 0) parts.push(digits.slice(0, 2));
    if (digits.length > 2) parts.push(digits.slice(2, 4));
    if (digits.length > 4) parts.push(digits.slice(4, 8));
    return parts.join('/');
  };

  const stageCard = (
    <div className="relative border border-[var(--app-border)] bg-[var(--app-panel)] rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--app-muted)] mb-4">
          <span>Loadout // Model</span>
          {currentMission ? <span className="text-[var(--app-accent)] font-semibold">{currentMission.title}</span> : <span>Standby</span>}
        </div>

        <div className="flex-1 flex items-center justify-center relative bg-[var(--app-panel-2)] rounded border border-dashed border-[var(--app-border)]">
          <div className="absolute inset-3 border border-[var(--app-border)] rounded pointer-events-none"></div>
          <div className="relative w-full h-full flex items-center justify-center">
            {characterModel ? (
              <model-viewer
                src={characterModel}
                camera-controls
                auto-rotate
                autoplay
                exposure="1.1"
                shadow-intensity="0.6"
                environment-image={modelViewerEnv}
                style={{ width: '100%', height: '100%', background: 'var(--app-bg)' }}
              />
            ) : (
              <div className="w-[240px] h-[320px] border border-[var(--app-border)] bg-cover bg-center rounded" style={{ backgroundImage: `url(${coverImage})` }}>
                <div className="w-full h-full bg-[color-mix(in_srgb,var(--app-text)_70%,transparent)] flex items-center justify-center text-[var(--app-muted)] text-xs tracking-[0.2em] uppercase">Upload Model</div>
              </div>
            )}
          </div>
          <div className="absolute bottom-4 inset-x-6 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">
            <span className="px-2 py-1 border border-[var(--app-border)] bg-[var(--app-panel)] rounded">Navigate</span>
            <span className="px-2 py-1 border border-[var(--app-border)] bg-[var(--app-panel)] rounded">Rotate</span>
            <span className="px-2 py-1 border border-[var(--app-border)] bg-[var(--app-panel)] rounded">Select</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
          {rewardConfigs.map(config => (
            <div 
              key={config.level}
              className={`w-12 h-12 rounded-full border ${totalXP >= config.threshold ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]' : 'border-[var(--app-border)] bg-[var(--app-panel)]'} flex items-center justify-center text-[var(--app-text)] text-sm font-bold`}
              title={`Level ${config.level} - ${config.threshold} XP`}
            >
              {config.level}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const statsCard = (
    <div className="border border-[var(--app-border)] bg-[var(--app-panel)] rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--app-muted)]">
        <span>Stats</span>
        <span className="text-[var(--app-accent)] font-semibold">Profile</span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Name</span>
          <input
            type="text"
            value={bioStats.name}
            placeholder="Enter name"
            onChange={(e) => {
              setBioStats(prev => ({ ...prev, name: e.target.value }));
              setSummonerName(e.target.value || 'Summoner Name');
            }}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>ID</span>
          <input
            type="text"
            value={profileId}
            placeholder="#NA1 // US_WEST // NETWORK_STABLE"
            onChange={(e) => setProfileId(e.target.value)}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Role</span>
          <input
            type="text"
            value={roleText}
            placeholder="Enter role"
            onChange={(e) => {
              setRoleText(e.target.value);
            }}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Gender</span>
          <select
            value={bioStats.gender}
            onChange={(e) => setBioStats(prev => ({ ...prev, gender: e.target.value }))}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel)] focus:outline-none focus:border-[var(--app-accent)]"
          >
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Height</span>
          <div className="flex">
            <input
              type="text"
              value={bioStats.height}
              placeholder="e.g. 180"
              onChange={(e) => setBioStats(prev => ({ ...prev, height: e.target.value }))}
              className="w-full border border-[var(--app-border)] rounded-l px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel)] focus:outline-none focus:border-[var(--app-accent)]"
            />
            <span className="px-3 py-2 border border-l-0 border-[var(--app-border)] rounded-r text-sm bg-[var(--app-panel-2)] text-[var(--app-muted)]">cm</span>
          </div>
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Weight</span>
          <input
            type="text"
            value={bioStats.weight}
            placeholder="e.g. 75 kg"
            onChange={(e) => setBioStats(prev => ({ ...prev, weight: e.target.value }))}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Age</span>
          <input
            type="number"
            value={bioStats.age}
            placeholder="Age"
            min={0}
            max={99}
            onChange={(e) => {
              const val = Math.max(0, Math.min(99, Number(e.target.value) || 0));
              setBioStats(prev => ({ ...prev, age: val.toString() }));
            }}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Birthdate (DD/MM/YYYY)</span>
          <input
            type="text"
            value={bioStats.birthdate}
            placeholder="DD/MM/YYYY"
            onChange={(e) => setBioStats(prev => ({ ...prev, birthdate: formatBirthdateInput(e.target.value) }))}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Email</span>
          <input
            type="email"
            value={bioStats.email}
            placeholder="user@email.com"
            onChange={(e) => setBioStats(prev => ({ ...prev, email: e.target.value }))}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>
      </div>
    </div>
  );

  const renderLobbyPanelContent = (panel: LobbyPanelKey | null) => {
    const inputCls = 'w-full border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel-2)] focus:outline-none focus:border-[var(--app-accent)]';
    const labelCls = 'flex flex-col gap-1 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]';
    const sectionTitle = 'text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)] mb-3';
    switch (panel) {
      case 'identity':
        return (
          <div className="space-y-3">
            <div className={sectionTitle}>Identity</div>
            <label className={labelCls}>Display Name
              <input className={inputCls} value={summonerName} placeholder="Your name" onChange={e => { setSummonerName(e.target.value || 'Summoner Name'); setBioStats(p => ({ ...p, name: e.target.value })); }} />
            </label>
            <label className={labelCls}>Role
              <input className={inputCls} value={roleText} placeholder="e.g. Mid Lane" onChange={e => setRoleText(e.target.value)} />
            </label>
            <label className={labelCls}>Region / ID
              <input className={inputCls} value={profileId} placeholder="#NA1 // US_WEST" onChange={e => setProfileId(e.target.value)} />
            </label>
            <label className={labelCls}>Short Bio
              <textarea className={`${inputCls} resize-none h-24`} placeholder="A few words about yourself..." />
            </label>
          </div>
        );
      case 'stats':
        return (
          <div className="space-y-3">
            <div className={sectionTitle}>Stats</div>
            {[
              { label: 'Total XP', value: `${totalXP} XP` },
              { label: 'Current Level', value: currentLevelConfig ? `Level ${currentLevelConfig.level}` : 'Unranked' },
              { label: 'Progress', value: `${levelProgress}%` },
              { label: 'Active Missions', value: activeMissions },
              { label: 'Completed Today', value: completedToday },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] rounded px-3 py-2 bg-[var(--app-panel-2)]">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">{label}</span>
                <span className="text-sm font-bold text-[var(--app-text)]">{value}</span>
              </div>
            ))}
            <div className="mt-1">
              <div className="flex justify-between text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)] mb-1">
                <span>XP Progress</span><span>{levelProgress}%</span>
              </div>
              <div className="h-2 rounded bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] overflow-hidden">
                <div className="h-full bg-[var(--app-accent)] rounded" style={{ width: `${Math.min(100, levelProgress)}%` }} />
              </div>
            </div>
          </div>
        );
      case 'loadout':
        return (
          <div className="space-y-3">
            <div className={sectionTitle}>Loadout</div>
            {['Primary Tool', 'Secondary Tool', 'Companion'].map(slot => (
              <div key={slot} className="border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] rounded-lg p-3 bg-[var(--app-panel-2)] flex items-center gap-3">
                <div className="w-10 h-10 rounded border border-dashed border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] flex items-center justify-center text-[var(--app-muted)]">
                  <Sword size={14} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">{slot}</div>
                  <div className="text-xs text-[var(--app-text)] mt-0.5">— Empty —</div>
                </div>
              </div>
            ))}
            <div className="text-[9px] text-[var(--app-muted)] text-center mt-2">Inventory equip coming soon.</div>
          </div>
        );
      case 'skills':
        return (
          <div className="space-y-4">
            <div className={sectionTitle}>Skills</div>
            {[{ label: 'Focus', val: 72 }, { label: 'Social', val: 58 }, { label: 'Fitness', val: 45 }, { label: 'Craft', val: 61 }].map(({ label, val }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  <span>{label}</span><span className="text-[var(--app-text)]">{val}</span>
                </div>
                <div className="h-2 rounded bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] overflow-hidden">
                  <div className="h-full bg-[color-mix(in_srgb,var(--app-accent)_80%,var(--app-text))] rounded" style={{ width: `${val}%` }} />
                </div>
              </div>
            ))}
          </div>
        );
      case 'titles':
        return (
          <div>
            <div className={sectionTitle}>Earned Titles</div>
            <div className="flex flex-wrap gap-2">
              {['Early Adopter', 'First Log', 'Day 1', 'Mission Complete'].map(t => (
                <span key={t} className="px-2.5 py-1 rounded-full border border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,var(--app-panel-2))] text-[10px] uppercase tracking-[0.14em] text-[var(--app-accent)]">
                  {t}
                </span>
              ))}
            </div>
            <div className="text-[9px] text-[var(--app-muted)] mt-4">More titles unlock as you progress.</div>
          </div>
        );
      case 'links':
        return (
          <div className="space-y-3">
            <div className={sectionTitle}>Quick Links</div>
            <button disabled className="w-full text-left border border-dashed border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] rounded px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] cursor-not-allowed opacity-60 flex items-center gap-2">
              <Link2 size={12} /> + Add Link (coming soon)
            </button>
            <div className="text-[9px] text-[var(--app-muted)]">No links added yet.</div>
          </div>
        );
      case 'notes':
        return (
          <div className="flex flex-col gap-3 h-full">
            <div className={sectionTitle}>Personal Notes</div>
            <textarea
              value={lobbyNotes}
              onChange={e => setLobbyNotes(e.target.value)}
              placeholder="Personal notes, ideas, reminders..."
              className="w-full flex-1 min-h-[180px] border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] rounded-lg p-3 text-sm text-[var(--app-text)] bg-[var(--app-panel-2)] resize-none focus:outline-none focus:border-[var(--app-accent)]"
            />
            <button
              type="button"
              onClick={() => { try { localStorage.setItem('xtation_profile_notes_v1', lobbyNotes); } catch {} }}
              className="text-[10px] uppercase tracking-[0.14em] border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] rounded px-4 py-2 text-[var(--app-muted)] hover:text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)] transition-colors"
            >
              Save Locally
            </button>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-3">
            <div className={sectionTitle}>Profile Visibility</div>
            {(['Private', 'Circles', 'Community'] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setLobbyVisibility(opt)}
                className={`w-full text-left px-3 py-2.5 rounded border text-[10px] uppercase tracking-[0.14em] transition-colors ${
                  lobbyVisibility === opt
                    ? 'border-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))] text-[var(--app-accent)]'
                    : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-text)_25%,transparent)] hover:text-[var(--app-text)]'
                }`}
              >
                {opt}
              </button>
            ))}
            <div className="text-[9px] text-[var(--app-muted)] mt-1">Backend sync coming soon.</div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'PROFILE': {
        type BtnDef = { key: LobbyPanelKey; label: string; icon: React.ReactNode };
        const allBtns: BtnDef[] = [
          { key: 'identity', label: 'Identity', icon: <User size={13} /> },
          { key: 'stats',    label: 'Stats',    icon: <BarChart2 size={13} /> },
          { key: 'loadout',  label: 'Loadout',  icon: <Sword size={13} /> },
          { key: 'skills',   label: 'Skills',   icon: <Zap size={13} /> },
          { key: 'titles',   label: 'Titles',   icon: <Award size={13} /> },
          { key: 'links',    label: 'Links',    icon: <Link2 size={13} /> },
          { key: 'notes',    label: 'Notes',    icon: <FileText size={13} /> },
          { key: 'privacy',  label: 'Privacy',  icon: <Shield size={13} /> },
        ];

        const DockBtn = ({ btn }: { btn: BtnDef }) => {
          const active = lobbyOpenPanel === btn.key;
          return (
            <button
              type="button"
              title={btn.label}
              onClick={() => setLobbyOpenPanel(p => p === btn.key ? null : btn.key)}
              style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)', transitionDuration: '220ms' }}
              className={`flex flex-col items-center gap-0.5 w-12 py-1.5 rounded-xl transition-[transform,background-color,color] select-none ${
                active
                  ? 'bg-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] text-[var(--app-accent)] scale-110'
                  : 'text-white/45 hover:text-white hover:bg-white/10 hover:scale-110 active:scale-90'
              }`}
            >
              {btn.icon}
              <span className="text-[7px] uppercase tracking-[0.08em] leading-none">{btn.label}</span>
            </button>
          );
        };

        const panelIcon = allBtns.find(b => b.key === lobbyOpenPanel)?.icon;
        const panelLabel = allBtns.find(b => b.key === lobbyOpenPanel)?.label ?? '';
        const stageSrc = stageImage || CHARACTER_PLACEHOLDER_SRC;

        // ── Reactive stage state ────────────────────────────────────────
        const stageState: 'active' | 'productive' | 'idle' =
          activeSession ? 'active' : completedToday > 0 ? 'productive' : 'idle';

        const bgCfg = {
          active:     { glowOpacity: 1,    animDuration: '3.5s', glowStrength: '32%' },
          productive: { glowOpacity: 0.85, animDuration: '6s',   glowStrength: '22%' },
          idle:       { glowOpacity: 0.3,  animDuration: '11s',  glowStrength: '10%' },
        }[stageState];

        return (
          <>
            {/* ── Full-bleed cinematic stage ───────────────────────────── */}
            <div
              className="relative overflow-hidden"
              style={{ minHeight: 'calc(100dvh - 220px)' }}
            >
              {/* Layer 1: base bg */}
              <div className="absolute inset-0 bg-[var(--app-bg)]" />

              {/* Layer 2: reactive accent glow — breathe speed + intensity driven by stageState */}
              <div
                className="absolute inset-0 pointer-events-none stage-bg-breathe"
                style={{
                  background: `radial-gradient(ellipse 100% 55% at 50% 110%, color-mix(in_srgb,var(--app-accent)_${bgCfg.glowStrength},transparent) 0%, transparent 65%)`,
                  opacity: bgCfg.glowOpacity,
                  animationDuration: bgCfg.animDuration,
                }}
              />

              {/* Layer 3: scan-line texture */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.022) 3px, rgba(0,0,0,0.022) 4px)' }}
              />

              {/* Layer 4: edge vignette */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 110% 110% at 50% 50%, transparent 30%, rgba(0,0,0,0.6) 100%)' }}
              />

              {/* Layer 5: state-reactive overlays */}
              {/* active → extra pulsing floor glow */}
              {stageState === 'active' && (
                <div
                  className="absolute inset-x-0 bottom-0 pointer-events-none stage-active-pulse"
                  style={{ height: '35%', background: 'radial-gradient(ellipse 90% 100% at 50% 100%, color-mix(in_srgb,var(--app-accent)_14%,transparent) 0%, transparent 70%)' }}
                />
              )}
              {/* idle → subtle cool-tinted dark wash to desaturate */}
              {stageState === 'idle' && (
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
                  style={{ background: 'rgba(4,6,20,0.22)' }}
                />
              )}

              {/* === Character — centered, fills stage === */}
              <div
                className="absolute inset-0 flex items-end justify-center pb-28"
                style={{ perspective: '1100px' }}
                onMouseMove={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
                  const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
                  if (stageInnerRef.current) {
                    stageInnerRef.current.style.transform = `rotateY(${x * 6}deg) rotateX(${-y * 4}deg)`;
                  }
                }}
                onMouseLeave={() => {
                  if (stageInnerRef.current) {
                    stageInnerRef.current.style.transform = 'rotateY(0deg) rotateX(0deg)';
                  }
                }}
              >
                <div
                  ref={stageInnerRef}
                  className="relative stage-idle transition-transform duration-150 ease-out"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Spotlight from above */}
                  <div
                    className="absolute -inset-x-16 -top-10 h-3/4 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in_srgb,var(--app-accent)_16%,transparent) 0%, transparent 70%)' }}
                  />

                  {/* Character */}
                  {stageGlbUrl ? (
                    <model-viewer
                      src={stageGlbUrl}
                      camera-controls
                      auto-rotate
                      autoplay
                      style={{ width: '320px', height: '520px', background: 'transparent', display: 'block' } as React.CSSProperties}
                    />
                  ) : (
                    <img
                      src={stageSrc}
                      alt="Character"
                      className="block w-auto"
                      style={{ maxHeight: 'min(520px, 55dvh)' }}
                      draggable={false}
                    />
                  )}

                  {/* Floor glow */}
                  <div className="absolute -bottom-3 inset-x-0 flex justify-center pointer-events-none">
                    <div
                      className="rounded-full blur-2xl"
                      style={{ width: '150%', height: '36px', background: 'color-mix(in_srgb,var(--app-accent)_38%,transparent)' }}
                    />
                  </div>
                </div>
              </div>

              {/* === Glass name plate — bottom left === */}
              <div className="glass-panel-in absolute bottom-24 left-5 z-20 rounded-2xl backdrop-blur-md border border-white/10 bg-black/35 px-4 py-3 max-w-[200px]">
                <div className="text-[9px] uppercase tracking-[0.18em] text-white/40 mb-0.5">
                  {currentLevelConfig ? `Lv ${currentLevelConfig.level}` : 'Unranked'} · {roleText}
                </div>
                <div className="text-base font-bold text-white leading-tight truncate">{summonerName}</div>
                {stageState === 'active' ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--app-accent)] stage-active-dot" />
                    <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--app-accent)] truncate">
                      Session Running
                    </span>
                  </div>
                ) : stageState === 'productive' ? (
                  <div className="mt-1.5 text-[9px] uppercase tracking-[0.12em] text-emerald-400/80 truncate">
                    ✓ {completedToday} done today
                  </div>
                ) : (
                  <div className="mt-1.5 text-[9px] uppercase tracking-[0.12em] text-white/25 truncate">
                    No activity yet
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[var(--app-accent)] rounded-full transition-[width] duration-500"
                      style={{ width: `${levelProgress}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-white/35 shrink-0">{levelProgress}%</span>
                </div>
              </div>

              {/* === Stats chips — bottom right === */}
              <div className="glass-panel-in glass-panel-in-delay-1 absolute bottom-24 right-5 z-20 flex flex-col items-end gap-1.5">
                <div className="px-3 py-1.5 rounded-xl backdrop-blur-md bg-black/35 border border-white/10 text-[9px] uppercase tracking-[0.12em] text-white/40 whitespace-nowrap">
                  <span className="text-[var(--app-accent)] font-bold mr-1.5">{totalXP}</span>XP
                </div>
                <div className="px-3 py-1.5 rounded-xl backdrop-blur-md bg-black/35 border border-white/10 text-[9px] uppercase tracking-[0.12em] text-white/40 whitespace-nowrap">
                  <span className="text-white font-bold mr-1.5">{activeMissions}</span>Active
                </div>
                <div className="px-3 py-1.5 rounded-xl backdrop-blur-md bg-black/35 border border-white/10 text-[9px] uppercase tracking-[0.12em] text-white/40 whitespace-nowrap">
                  <span className="text-white font-bold mr-1.5">{completedToday}</span>Done Today
                </div>
              </div>

              {/* === Dock — bottom center, glass pill === */}
              <div className="glass-panel-in glass-panel-in-delay-2 absolute bottom-4 inset-x-0 z-20 flex justify-center px-3">
                <div className="flex flex-wrap justify-center gap-px px-2 py-1.5 rounded-2xl backdrop-blur-md bg-black/45 border border-white/8 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                  {allBtns.map(btn => <DockBtn key={btn.key} btn={btn} />)}
                </div>
              </div>

              {/* === Upload buttons — top right === */}
              <div className="absolute top-3 right-3 z-20 flex gap-1.5">
                <button
                  type="button"
                  title="Upload character image (PNG/JPG)"
                  onClick={() => stageImageInputRef.current?.click()}
                  className="group h-7 w-7 rounded-lg bg-black/55 backdrop-blur-sm border border-white/10 hover:border-[color-mix(in_srgb,var(--app-accent)_55%,transparent)] flex items-center justify-center transition-all hover:scale-105"
                >
                  <Camera size={12} className="text-white/50 group-hover:text-[var(--app-accent)]" />
                </button>
                <button
                  type="button"
                  title="Upload 3D model (.glb)"
                  onClick={() => stageGlbInputRef.current?.click()}
                  className="group h-7 w-7 rounded-lg bg-black/55 backdrop-blur-sm border border-white/10 hover:border-[color-mix(in_srgb,var(--app-accent)_55%,transparent)] flex items-center justify-center transition-all hover:scale-105"
                >
                  <Box size={12} className="text-white/50 group-hover:text-[var(--app-accent)]" />
                </button>
              </div>

              {/* === GLB indicator — top left === */}
              {stageGlbName && (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 border border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)]">
                  <Box size={10} className="text-[var(--app-accent)] shrink-0" />
                  <span className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-accent)] truncate max-w-[120px]">{stageGlbName}</span>
                  <button
                    type="button"
                    title="Replace 3D model"
                    onClick={() => stageGlbInputRef.current?.click()}
                    className="text-white/40 hover:text-white ml-0.5 leading-none"
                  >↺</button>
                </div>
              )}

              {/* Hidden file inputs */}
              <input ref={stageImageInputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/jpg" onChange={handleStageImageUpload} />
              <input ref={stageGlbInputRef} type="file" className="hidden" accept=".glb" onChange={handleStageGlbUpload} />
            </div>

            {/* ── Overlay drawer ── */}
            <DrawerOverlay
              open={lobbyOpenPanel !== null}
              onClose={() => setLobbyOpenPanel(null)}
              title={panelLabel}
              icon={panelIcon}
            >
              {renderLobbyPanelContent(lobbyOpenPanel)}
            </DrawerOverlay>
          </>
        );
      }
      case 'HEALTH':
        return (
          <div className="space-y-4">
            {(['BREATHING', 'MEDITATION', 'BODY'] as SectionKey[]).map(key => {
              const meta = healthMeta[key];
              const media = sectionMedia[key];
              const timer = sectionTimers[key];
              const running = timer.running;
              const remaining = timer.remaining;
              return (
                <div key={key} className="border border-[var(--app-border)] bg-[var(--app-panel)] rounded-lg shadow-sm p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{meta.icon}</span>
                      <div>
                        <div className="text-lg font-semibold text-[var(--app-text)]">{meta.title}</div>
                        <div className="text-sm text-[var(--app-muted)]">{meta.subtitle}</div>
                      </div>
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-muted)]">
                      {running && timer.selected ? `Running ${formatSeconds(timer.selected)}` : 'Idle'}
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-[320px,1fr,260px] gap-4 items-start">
                    <div
                      className={`relative bg-[var(--app-bg)] rounded-md border border-[var(--app-panel-2)] h-[360px] overflow-hidden transition-shadow ${
                        running ? 'ring-2 ring-[var(--app-accent)] shadow-[0_0_12px_color-mix(in_srgb,var(--app-accent)_35%,transparent)]' : ''
                      }`}
                    >
                      {(() => {
                        const modelUrl = media.model?.startsWith('idb:') ? resolvedHealthMedia[key].model : media.model;
                        return modelUrl ? (
                          <model-viewer
                            src={modelUrl}
                            camera-controls
                            auto-rotate
                            autoplay
                            exposure="1.1"
                            shadow-intensity="0.6"
                            environment-image={modelViewerEnv}
                            style={{ width: '100%', height: '100%', background: 'var(--app-bg)' }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[color-mix(in_srgb,var(--app-text)_60%,transparent)] text-sm uppercase tracking-[0.2em]">
                            No model
                          </div>
                        );
                      })()}
                      <button
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-[var(--app-panel)] text-[var(--app-text)] border border-[var(--app-border)] text-sm leading-none shadow-sm"
                        onClick={(e) => { e.stopPropagation(); sectionModelInputs.current[key]?.click(); }}
                        aria-label="Change model"
                      >
                        +
                      </button>
                      <input
                        ref={el => (sectionModelInputs.current[key] = el)}
                        type="file"
                        className="hidden"
                        accept=".glb,.gltf,.usdz,.fbx,.obj"
                        onChange={(e) => handleSectionModelChange(key, e)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="border border-[var(--app-border)] rounded-md shadow-[4px_6px_0_color-mix(in_srgb,var(--app-border)_65%,transparent)] bg-[var(--app-panel)] p-4">
                        <div className="text-xl font-black uppercase">{meta.title}</div>
                        <ul className="mt-2 space-y-1 text-sm text-[var(--app-muted)] list-disc list-inside">
                          {meta.details.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[180, 300, 600].map(seconds => {
                          const isSelected = timer.selected === seconds;
                          const label = `${seconds / 60} minutes`;
                          const content = running && isSelected ? formatSeconds(Math.max(0, Math.round(remaining))) : label;
                          return (
                            <button
                              key={seconds}
                              onClick={() => {
                                if (running && isSelected) {
                                  stopSectionTimer(key);
                                } else {
                                  startSectionTimer(key, seconds);
                                }
                              }}
                              className={`w-full h-16 rounded-md border text-center flex flex-col justify-center transition-colors ${
                                isSelected
                                  ? 'border-[var(--app-accent)] text-[var(--app-accent)] bg-[var(--app-panel)]'
                                  : 'border-[var(--app-border)] text-[var(--app-text)] bg-[var(--app-panel)] hover:border-[var(--app-accent)]'
                              }`}
                            >
                              <span className="text-lg font-semibold">{content}</span>
                              <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                total breathing exercise
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-sm text-[var(--app-muted)]">
                        {timer.selected ? `Timer set for ${timer.selected / 60} minutes` : 'Select a duration to start'}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 items-stretch">
                      <div
                        className={`relative h-56 bg-[var(--app-bg)] rounded-md flex items-center justify-center transition-colors ${running ? 'ring-2 ring-[var(--app-accent)]' : ''}`}
                      >
                        {(() => {
                          const videoUrl = media.video?.startsWith('idb:') ? resolvedHealthMedia[key].video : media.video;
                          return videoUrl ? (
                            <video
                              ref={el => (sectionVideoRefs.current[key] = el)}
                              src={videoUrl}
                              className="w-full h-full object-cover rounded-md"
                              loop
                              muted
                            />
                          ) : (
                            <div className="text-[color-mix(in_srgb,var(--app-text)_60%,transparent)] text-sm uppercase tracking-[0.2em]">No video</div>
                          );
                        })()}
                        <button
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-[var(--app-panel)] text-[var(--app-text)] border border-[var(--app-border)] text-sm leading-none shadow-sm"
                          onClick={(e) => { e.stopPropagation(); sectionVideoInputs.current[key]?.click(); }}
                          aria-label="Change video"
                        >
                          +
                        </button>
                        <input
                          ref={el => (sectionVideoInputs.current[key] = el)}
                          type="file"
                          className="hidden"
                          accept="video/*,.gif"
                          onChange={(e) => handleSectionVideoChange(key, e)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      case 'LOG':
        return <LogCalendar />;
      case 'ACTIVITY':
        return <ProfileActivity />;
      case 'ACHIEVEMENTS':
        return (
          <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-6">
            <div className="space-y-4">
              <div className="bg-[var(--app-panel)] border border-[var(--app-border)] rounded-lg shadow-sm p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-muted)] mb-3">Legacy XP</div>
                <div className="text-2xl font-black text-[var(--app-text)]">{legacyXP} XP</div>
                <div className="text-[11px] text-[var(--app-muted)]">Read-only snapshot from the old quest system.</div>
              </div>
              <div className="bg-[var(--app-panel)] border border-[var(--app-border)] rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--app-muted)] mb-3">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[var(--app-accent)] animate-pulse"></span>
                    Live Protocol Status
                  </span>
                  <span className="text-[var(--app-accent)] font-semibold">Real-Time</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 border border-[var(--app-border)] rounded bg-[var(--app-panel-2)]">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--app-muted)]">Current Rank</div>
                    <div className="text-lg font-black text-[var(--app-text)]">
                      {currentLevelConfig ? `Level ${currentLevelConfig.level}` : 'Unranked'}
                    </div>
                    <div className="text-[12px] text-[var(--app-muted)]">Threshold: {currentLevelConfig ? currentLevelConfig.threshold : 0} XP</div>
                  </div>
                  <div className="p-3 border border-[var(--app-border)] rounded bg-[var(--app-panel-2)]">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--app-muted)]">Protocol Points</div>
                    <div className="text-lg font-black text-[var(--app-text)]">{totalXP} XP</div>
                    <div className="text-[12px] text-[var(--app-muted)]">
                      {nextConfig ? `${nextConfig.threshold - totalXP} XP to Level ${nextConfig.level}` : 'Max Rank Achieved'}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] mb-1">
                    <span>Progress to Next</span>
                    <span className="text-[var(--app-text)]">{levelProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--app-panel-2)] border border-[var(--app-border)] rounded">
                    <div
                      className="h-full rounded bg-gradient-to-r from-[var(--app-accent)] to-[var(--app-accent)]"
                      style={{ width: `${Math.min(100, Math.max(0, levelProgress))}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--app-panel)] border border-[var(--app-border)] rounded-lg shadow-sm p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-muted)] mb-3 flex justify-between">
                  <span>Achievement Ranks</span>
                  <span className="text-[var(--app-accent)] font-semibold">{rewardConfigs.length} Levels</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {rewardConfigs.map(config => {
                    const achieved = totalXP >= config.threshold;
                    return (
                      <div
                        key={config.level}
                        className={`p-3 border rounded text-center transition-colors ${
                          achieved ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_5%,transparent)]' : 'border-[var(--app-border)] bg-[var(--app-panel-2)]'
                        }`}
                      >
                        <div className="text-xl font-black text-[var(--app-text)]">Level {config.level}</div>
                        <div className="text-[11px] text-[var(--app-muted)] uppercase">Requires {config.threshold} XP</div>
                        <div className={`mt-2 text-[11px] font-semibold ${achieved ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'}`}>
                          {achieved ? 'ACHIEVED' : 'LOCKED'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="bg-[var(--app-panel)] border border-[var(--app-border)] rounded-lg shadow-sm p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-muted)] mb-3">Reward Visual</div>
              <div className="w-full h-[260px] border border-dashed border-[var(--app-border)] bg-[var(--app-panel-2)] flex items-center justify-center">
                {currentLevelConfig ? (
                  <RewardVisual config={currentLevelConfig} className="w-48 h-48" />
                ) : (
                  <div className="text-[var(--app-muted)] text-sm">Earn XP to unlock</div>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="p-4 md:p-6 h-full overflow-y-auto xt-scroll bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Compact header ≤160px */}
      <div className="flex items-center gap-4 bg-[var(--app-panel)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] rounded-2xl px-4 py-3 mb-4">
        {/* Avatar */}
        <div
          className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] cursor-pointer group"
          onClick={handleImageClick}
          onMouseEnter={playHoverSound}
          title="Change avatar"
        >
          <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <Camera size={14} className="text-white" />
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/png,image/jpeg,image/gif,image/jpg" onChange={handleFileChange} />
        </div>

        {/* Name + XP bar + chips */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {!isEditingName ? (
              <button
                type="button"
                onClick={startEditingName}
                className="text-sm font-bold text-[var(--app-text)] hover:text-[var(--app-accent)] transition-colors truncate max-w-[200px] focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)] rounded"
                title="Edit name"
              >
                {summonerName}
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  className="h-7 px-2 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] bg-[var(--app-panel-2)] text-[var(--app-text)] text-sm focus:outline-none focus:border-[var(--app-accent)]"
                />
                <button type="button" onClick={saveName} className="h-7 w-7 rounded border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] flex items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"><Check size={12} /></button>
                <button type="button" onClick={cancelEdit} className="h-7 w-7 rounded border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] flex items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"><X size={12} /></button>
              </div>
            )}
          </div>

          {/* XP bar */}
          <div className="mb-2">
            <div className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--app-text)_10%,transparent)] overflow-hidden">
              <div
                className="h-full bg-[var(--app-accent)] rounded-full transition-[width] duration-500"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>

          {/* 3 chips: Level, Role, XP */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {nextConfig && (
              <span className="px-2 py-0.5 rounded-full border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,var(--app-panel-2))] text-[9px] uppercase tracking-[0.14em] text-[var(--app-accent)]">
                Lv {nextConfig.level - 1}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)] truncate max-w-[110px]">
              {roleText}
            </span>
            <span className="px-2 py-0.5 rounded-full border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
              {totalXP} XP
            </span>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={coverInputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,video/mp4" onChange={handleCoverChange} />
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] pb-3 mb-5 gap-2 flex-wrap">
        <TabButton label="PROFILE" value="PROFILE" icon={<User size={14} />} />
        <TabButton label="HEALTH" value="HEALTH" icon={<Activity size={14} />} />
        <TabButton label="ACHIEVEMENTS" value="ACHIEVEMENTS" icon={<Award size={14} />} />
        <TabButton label="ACTIVITY" value="ACTIVITY" icon={<Activity size={14} />} />
        <TabButton label="LOG" value="LOG" icon={<Box size={14} />} />
      </div>

      {/* Content */}
      <div className={activeTab === 'PROFILE' ? '-mx-4 md:-mx-6 -mb-4 md:-mb-6' : ''}>
        {renderTabContent()}
      </div>
    </div>
  );
};

const StatBar: React.FC<{ label: string; value: number; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="space-y-1">
    <div className={`text-[11px] uppercase tracking-[0.2em] ${highlight ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-muted)]'}`}>{label}</div>
    <div className="w-full h-2 bg-[color-mix(in_srgb,var(--app-bg)_20%,transparent)] border border-[var(--ui-border)] rounded">
      <div
        className={`${highlight ? 'bg-[var(--ui-accent)]' : 'bg-[color-mix(in_srgb,var(--app-text)_20%,transparent)]'} h-full rounded`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  </div>
);
