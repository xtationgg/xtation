import React, { useState, useRef, useEffect } from 'react';
import { Camera, Edit2, Check, X, Upload, Box, User, Activity, Award } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'HEALTH' | 'ACHIEVEMENTS' | 'ACTIVITY' | 'LOG'>('PROFILE');
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
  const { stats: xpStats, legacyXP, tasks, selectors, dateKey } = useXP();

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

  const openModelDB = () => new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('ProfileModelDB', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('models')) db.createObjectStore('models');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

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
          <div className="border border-[var(--app-border)] bg-[var(--app-text)] p-3 rounded">
            <div className="text-[10px] text-[var(--app-muted)]">Active Missions</div>
            <div className="text-xl font-black text-[var(--app-text)]">{activeMissions}</div>
          </div>
          <div className="border border-[var(--app-border)] bg-[var(--app-text)] p-3 rounded">
            <div className="text-[10px] text-[var(--app-muted)]">Completed Today</div>
            <div className="text-xl font-black text-[var(--app-text)]">{completedToday}</div>
          </div>
        </div>

        <button 
          onClick={handleCoverClick}
          onMouseEnter={playHoverSound}
          className="w-full text-[10px] uppercase tracking-[0.2em] border border-[var(--app-border)] bg-[var(--app-text)] hover:border-[var(--app-accent)] py-2 flex items-center justify-center gap-2 text-[var(--app-muted)] rounded"
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
    <div className="relative border border-[var(--app-border)] bg-[var(--app-text)] rounded-lg shadow-sm overflow-hidden">
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
            <span className="px-2 py-1 border border-[var(--app-border)] bg-[var(--app-text)] rounded">Navigate</span>
            <span className="px-2 py-1 border border-[var(--app-border)] bg-[var(--app-text)] rounded">Rotate</span>
            <span className="px-2 py-1 border border-[var(--app-border)] bg-[var(--app-text)] rounded">Select</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
          {rewardConfigs.map(config => (
            <div 
              key={config.level}
              className={`w-12 h-12 rounded-full border ${totalXP >= config.threshold ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]' : 'border-[var(--app-border)] bg-[var(--app-text)]'} flex items-center justify-center text-[var(--app-text)] text-sm font-bold`}
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
    <div className="border border-[var(--app-border)] bg-[var(--app-text)] rounded-lg shadow-sm p-4 space-y-3">
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
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-text)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>ID</span>
          <input
            type="text"
            value={profileId}
            placeholder="#NA1 // US_WEST // NETWORK_STABLE"
            onChange={(e) => setProfileId(e.target.value)}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-text)] focus:outline-none focus:border-[var(--app-accent)]"
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
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-text)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Gender</span>
          <select
            value={bioStats.gender}
            onChange={(e) => setBioStats(prev => ({ ...prev, gender: e.target.value }))}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-text)] focus:outline-none focus:border-[var(--app-accent)]"
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
              className="w-full border border-[var(--app-border)] rounded-l px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-text)] focus:outline-none focus:border-[var(--app-accent)]"
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
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-text)] focus:outline-none focus:border-[var(--app-accent)]"
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
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-text)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Birthdate (DD/MM/YYYY)</span>
          <input
            type="text"
            value={bioStats.birthdate}
            placeholder="DD/MM/YYYY"
            onChange={(e) => setBioStats(prev => ({ ...prev, birthdate: formatBirthdateInput(e.target.value) }))}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-text)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>Email</span>
          <input
            type="email"
            value={bioStats.email}
            placeholder="user@email.com"
            onChange={(e) => setBioStats(prev => ({ ...prev, email: e.target.value }))}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-text)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'PROFILE':
        return (
          <div className="grid lg:grid-cols-[320px,1fr,280px] gap-6 items-start">
            {dossierCard}
            {stageCard}
            {statsCard}
          </div>
        );
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
                <div key={key} className="border border-[var(--app-border)] bg-[var(--app-text)] rounded-lg shadow-sm p-4 space-y-4">
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
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-[var(--app-text)] text-[var(--app-text)] border border-[var(--app-border)] text-sm leading-none shadow-sm"
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
                      <div className="border border-[var(--app-text)] rounded-md shadow-[4px_6px_0_var(--app-text)] bg-[var(--app-text)] p-4">
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
                                  ? 'border-[var(--app-accent)] text-[var(--app-accent)] bg-[var(--app-text)]'
                                  : 'border-[var(--app-text)] text-[var(--app-text)] bg-[var(--app-text)] hover:border-[var(--app-accent)]'
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
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-[var(--app-text)] text-[var(--app-text)] border border-[var(--app-border)] text-sm leading-none shadow-sm"
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
              <div className="bg-[var(--app-text)] border border-[var(--app-border)] rounded-lg shadow-sm p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-muted)] mb-3">Legacy XP</div>
                <div className="text-2xl font-black text-[var(--app-text)]">{legacyXP} XP</div>
                <div className="text-[11px] text-[var(--app-muted)]">Read-only snapshot from the old quest system.</div>
              </div>
              <div className="bg-[var(--app-text)] border border-[var(--app-border)] rounded-lg shadow-sm p-4">
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

              <div className="bg-[var(--app-text)] border border-[var(--app-border)] rounded-lg shadow-sm p-4">
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
            <div className="bg-[var(--app-text)] border border-[var(--app-border)] rounded-lg shadow-sm p-4">
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
    <div className="profile-hud-theme p-8 h-full overflow-y-auto bg-[var(--ui-bg)] text-[var(--ui-text)]">
      {/* HEADER (private profile) */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)]">
        <div className="h-[340px] relative overflow-hidden">
          {/* Cover media (image/video) */}
          {(() => {
            const src = coverImage?.startsWith('idb:') ? resolvedCoverUrl : coverImage;
            if (!src) return null;

            if (coverType === 'video' || src.startsWith('data:video') || src.endsWith('.mp4')) {
              return (
                <video
                  src={src}
                  className={`absolute inset-0 w-full h-full ${coverFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              );
            }

            return (
              <img
                src={src}
                alt="cover"
                className={`absolute inset-0 w-full h-full ${coverFit === 'cover' ? 'object-cover' : 'object-contain'}`}
              />
            );
          })()}

          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.78)] via-[rgba(0,0,0,0.18)] to-[rgba(0,0,0,0.10)]" />
        </div>

        {/* Cover edit */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCoverFit(v => (v === 'cover' ? 'contain' : 'cover'))}
            className="h-11 w-11 rounded-full border border-[color-mix(in_srgb,var(--app-text)_25%,transparent)] bg-[color-mix(in_srgb,var(--app-bg)_35%,transparent)] backdrop-blur-sm hover:bg-[color-mix(in_srgb,var(--app-bg)_55%,transparent)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] transition-all flex items-center justify-center"
            title={coverFit === 'cover' ? 'Fit (no crop)' : 'Fill (crop)'}
          >
            <span className="text-[var(--app-text)] text-[10px] font-bold">{coverFit === 'cover' ? 'FILL' : 'FIT'}</span>
          </button>

          <button
            type="button"
            onClick={handleCoverClick}
            onMouseEnter={playHoverSound}
            className="h-11 w-11 rounded-full border border-[color-mix(in_srgb,var(--app-text)_25%,transparent)] bg-[color-mix(in_srgb,var(--app-bg)_35%,transparent)] backdrop-blur-sm hover:bg-[color-mix(in_srgb,var(--app-bg)_55%,transparent)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] transition-all flex items-center justify-center"
            title="Change cover"
          >
            <Upload size={18} className="text-[var(--app-text)]" />
          </button>
        </div>

        {/* Header content */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-6">
          {/* extra shadow behind text/content for readability on bright covers */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />
          <div className="relative flex items-end gap-5 flex-wrap">
            {/* Avatar */}
            <div
              className="relative w-[140px] h-[140px] rounded-2xl border border-[var(--ui-border)] overflow-hidden bg-[color-mix(in_srgb,var(--app-bg)_25%,transparent)]"
              onMouseEnter={playHoverSound}
            >
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={handleImageClick}
                className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-[color-mix(in_srgb,var(--app-bg)_40%,transparent)] flex items-center justify-center"
                title="Change avatar"
              >
                <Camera size={20} className="text-[var(--app-text)]" />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/gif, image/jpg" onChange={handleFileChange} />
            </div>

            {/* Name / ID / Role */}
            <div className="flex-1 min-w-[260px]">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[color-mix(in_srgb,var(--app-text)_80%,transparent)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]">PROFILE</div>

              <div className="mt-2 flex items-center gap-3 flex-wrap">
                {!isEditingName ? (
                  <div className="text-3xl font-black tracking-tight text-[var(--app-text)] drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">{summonerName}</div>
                ) : (
                  <input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="h-11 px-3 rounded border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--app-bg)_30%,transparent)] text-[var(--app-text)]"
                  />
                )}

                {!isEditingName ? (
                  <button
                    type="button"
                    onClick={startEditingName}
                    className="h-10 w-10 rounded-full border border-[color-mix(in_srgb,var(--app-text)_15%,transparent)] bg-[color-mix(in_srgb,var(--app-bg)_25%,transparent)] text-[color-mix(in_srgb,var(--app-text)_80%,transparent)] hover:text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)]"
                    title="Edit name"
                  >
                    <Edit2 size={16} className="mx-auto" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveName}
                      className="h-10 w-10 rounded-full border border-[color-mix(in_srgb,var(--app-text)_15%,transparent)] bg-[color-mix(in_srgb,var(--app-bg)_25%,transparent)] text-[color-mix(in_srgb,var(--app-text)_80%,transparent)] hover:text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)]"
                      title="Save"
                    >
                      <Check size={16} className="mx-auto" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="h-10 w-10 rounded-full border border-[color-mix(in_srgb,var(--app-text)_15%,transparent)] bg-[color-mix(in_srgb,var(--app-bg)_25%,transparent)] text-[color-mix(in_srgb,var(--app-text)_80%,transparent)] hover:text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)]"
                      title="Cancel"
                    >
                      <X size={16} className="mx-auto" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <div className="text-[11px] uppercase tracking-[0.25em] text-[color-mix(in_srgb,var(--app-text)_70%,transparent)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]">{profileId}</div>
                <div className="h-1 w-1 rounded-full bg-[color-mix(in_srgb,var(--app-text)_25%,transparent)]" />
                {!isEditingRole ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingRole(true)}
                    className="text-[11px] uppercase tracking-[0.25em] text-[var(--ui-accent)] hover:text-[var(--app-text)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
                    title="Edit role"
                  >
                    {roleText}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      value={roleText}
                      onChange={(e) => setRoleText(e.target.value)}
                      className="h-9 px-3 rounded border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--app-bg)_30%,transparent)] text-[var(--app-text)] text-sm"
                    />
                    <button
                      type="button"
                      onClick={saveRole}
                      className="h-9 px-3 rounded border border-[var(--ui-border)] bg-[var(--ui-accent)] text-[var(--app-text)] text-xs uppercase tracking-[0.2em]"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {/* Progress */}
              <div className="mt-5 max-w-[520px]">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-[color-mix(in_srgb,var(--app-text)_70%,transparent)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]">
                  <span>XP</span>
                  <span>{totalXP} • {nextConfig ? `${nextConfig.threshold - totalXP} to L${nextConfig.level}` : 'Max'}</span>
                </div>
                <div className="mt-2 h-2 rounded bg-[color-mix(in_srgb,var(--app-bg)_35%,transparent)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] overflow-hidden">
                  <div className="h-full bg-[var(--ui-accent)]" style={{ width: `${Math.min(100, Math.max(0, levelProgress))}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <input
          ref={coverInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,video/mp4"
          onChange={handleCoverChange}
        />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex items-center border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] pb-3 mb-6 gap-2 flex-wrap">
        <TabButton label="PROFILE" value="PROFILE" icon={<User size={14} />} />
        <TabButton label="HEALTH" value="HEALTH" icon={<Activity size={14} />} />
        <TabButton label="ACHIEVEMENTS" value="ACHIEVEMENTS" icon={<Award size={14} />} />
        <TabButton label="ACTIVITY" value="ACTIVITY" icon={<Activity size={14} />} />
        <TabButton label="LOG" value="LOG" icon={<Box size={14} />} />
      </div>

      {/* Content */}
      <div className="profile-content-surface">
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
