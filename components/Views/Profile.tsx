import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Camera, Edit2, Check, X, Upload, Box, User, Activity, Award, BarChart2, Sword, Zap, Link2, FileText, Shield } from 'lucide-react';
import { ProfilePanel } from '../UI/ProfilePanel';
import { RewardVisual } from '../UI/RewardVisual';
import { RewardConfig, InventoryItem } from '../../types';
import { ASSETS } from '../../constants';
import { playClickSound, playSuccessSound, playHoverSound } from '../../utils/SoundEffects';
import { readFileAsDataUrl } from '../../utils/fileUtils';
import { useXP } from '../XP/xpStore';
import { LogCalendar } from '../XP/LogCalendar';
import { DayTimeline } from '../XP/DayTimeline';
import { Activity as ProfileActivity } from './Activity';
import { ClientView } from '../../types';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import {
  assignCapabilityItemsToLoadoutSlots,
  getActiveCapabilityItems,
  summarizeCapabilityLoadoutAssignments,
} from '../../src/inventory/models';
import { useOptionalAdminConsole } from '../../src/admin/AdminConsoleProvider';
import {
  clearPendingStarterWorkspaceAction,
  clearPendingStarterWorkspaceCue,
  describeStarterWorkspaceAction,
  dismissStarterWorkspaceCue,
  formatStarterWorkspaceCueEyebrow,
  openStarterWorkspaceAction,
  readPendingStarterWorkspaceAction,
  STARTER_WORKSPACE_DISMISS_EVENT,
  STARTER_WORKSPACE_ACTION_EVENT,
  readPendingStarterWorkspaceCue,
  STARTER_WORKSPACE_CUE_EVENT,
  type XtationStarterWorkspaceActionTarget,
  type XtationStarterWorkspaceCue,
} from '../../src/onboarding/workspaceCue';
import { openPlayNavigation } from '../../src/play/bridge';
import {
  readCreativeOpsStateSnapshot,
  resolveCreativeAvatarPresencePreset,
  resolveCreativeSceneAvatarPreset,
  resolvePublishedCreativeSkin,
} from '../../src/admin/creativeOps';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePresentationEvents } from '../../src/presentation/PresentationEventsProvider';
import { ProfileLobbyScene } from './ProfileLobbyScene';
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
  const [calendarSubView, setCalendarSubView] = useState<'day' | 'log'>('day');
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'HEALTH' | 'ACHIEVEMENTS' | 'ACTIVITY' | 'LOG'>(() => {
    try {
      const stored = window.sessionStorage.getItem('profileActiveTab');
      if (stored === 'PROFILE' || stored === 'HEALTH' || stored === 'ACHIEVEMENTS' || stored === 'ACTIVITY' || stored === 'LOG') {
        return stored;
      }
    } catch {}
    return 'PROFILE';
  });
  useEffect(() => {
    setActiveTab('PROFILE');
    try {
      window.sessionStorage.setItem('profileActiveTab', 'PROFILE');
    } catch {}
  }, []);
  const [stationName, setStationName] = useState(() => localStorage.getItem('profileName') || 'Station Pilot');
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
  const [roleText, setRoleText] = useState(() => localStorage.getItem('profileRole') || 'Operator');
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [profileId, setProfileId] = useState(() => localStorage.getItem('profileId') || '#LOCAL // ACTIVE');
  type SectionKey = 'BREATHING' | 'MEDITATION' | 'BODY';
  const [bioStats, setBioStats] = useState<BioStats>(() => {
    try {
      const stored = localStorage.getItem('profileBioStats');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      name: 'Station Pilot',
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
      subtitle: 'Quiet the noise',
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
  const { stats: xpStats, legacyXP, tasks, selectors, dateKey, startSession, stopSession } = useXP();
  const { settings } = useXtationSettings();
  const { theme } = useTheme();
  const adminConsole = useOptionalAdminConsole();
  const { user } = useAuth();
  const { emitEvent } = usePresentationEvents();
  const creativeState = useMemo(
    () => readCreativeOpsStateSnapshot(user?.id || null),
    [settings.unlocks.activeThemeId, settings.unlocks.activeSoundPackId, user?.id]
  );
  const resolvedCreativeSkin = useMemo(
    () =>
      resolvePublishedCreativeSkin(
        creativeState,
        settings.unlocks.activeThemeId?.startsWith('creative:')
          ? settings.unlocks.activeThemeId.slice('creative:'.length)
          : undefined,
        settings.unlocks.activeSoundPackId
      ),
    [creativeState, settings.unlocks.activeSoundPackId, settings.unlocks.activeThemeId]
  );
  const activeAvatarPreset = useMemo(
    () =>
      resolveCreativeSceneAvatarPreset(
        creativeState,
        resolvedCreativeSkin?.avatarProfile,
        resolvedCreativeSkin?.sceneProfile,
        'published'
      ),
    [creativeState, resolvedCreativeSkin?.avatarProfile, resolvedCreativeSkin?.sceneProfile]
  );
  const activeAvatarLoadoutSlots = useMemo(
    () =>
      activeAvatarPreset?.loadoutSlots?.length
        ? activeAvatarPreset.loadoutSlots
        : [
            { id: 'fallback-core', label: 'core', icon: '⚙', equipped: true, binding: 'theme' },
            { id: 'fallback-kit', label: 'kit', icon: '🧰', equipped: true, binding: 'module' },
            { id: 'fallback-relay', label: 'relay', icon: '📶', equipped: true, binding: 'sound' },
            { id: 'fallback-vault', label: 'vault', icon: '🗂', equipped: false, binding: 'any' },
            { id: 'fallback-signal', label: 'signal', icon: '✦', equipped: true, binding: 'widget' },
            { id: 'fallback-mod', label: 'mod', icon: '🔌', equipped: false, binding: 'any' },
          ],
    [activeAvatarPreset]
  );
  const activeAvatarIdentityBadge = activeAvatarPreset?.identityBadge || 'Station Shell';
  const activeCapabilityItems = useMemo(
    () => getActiveCapabilityItems(settings, theme).slice(0, 4),
    [settings, theme]
  );
  const activeAvatarLoadoutAssignments = useMemo(
    () => assignCapabilityItemsToLoadoutSlots(activeAvatarLoadoutSlots, activeCapabilityItems),
    [activeAvatarLoadoutSlots, activeCapabilityItems]
  );
  const activeAvatarLoadoutSummary = useMemo(
    () => summarizeCapabilityLoadoutAssignments(activeAvatarLoadoutAssignments),
    [activeAvatarLoadoutAssignments]
  );
  const activeAvatarPresencePreset = useMemo(
    () => resolveCreativeAvatarPresencePreset(activeAvatarPreset, activeAvatarLoadoutSummary.state),
    [activeAvatarLoadoutSummary.state, activeAvatarPreset]
  );
  const currentStationLabel = adminConsole?.currentStation.label ?? 'Local Station';
  const currentStationPlan = adminConsole?.currentStation.plan ?? 'free';

  useEffect(() => {
    try {
      window.sessionStorage.setItem('profileActiveTab', activeTab);
    } catch {}
  }, [activeTab]);
  useEffect(() => {
    emitEvent(`profile.tab.${activeTab.toLowerCase()}.open`, {
      source: 'profile',
      metadata: {
        tab: activeTab,
        calendarSubView,
      },
    });
  }, [activeTab, calendarSubView, emitEvent]);
  useEffect(() => {
    emitEvent(`profile.avatar.loadout.${activeAvatarLoadoutSummary.state}`, {
      source: 'profile',
      metadata: {
        state: activeAvatarLoadoutSummary.state,
        occupiedSlots: activeAvatarLoadoutSummary.occupiedSlots,
        totalSlots: activeAvatarLoadoutSummary.totalSlots,
        missingBindings: activeAvatarLoadoutSummary.missingBindings,
        matchedBindings: activeAvatarLoadoutSummary.matchedBindings,
        avatarProfile: resolvedCreativeSkin?.avatarProfile || null,
        sceneProfile: resolvedCreativeSkin?.sceneProfile || null,
        identityBadge: activeAvatarIdentityBadge,
      },
    });
  }, [
    activeAvatarIdentityBadge,
    activeAvatarLoadoutSummary,
    emitEvent,
    resolvedCreativeSkin?.avatarProfile,
    resolvedCreativeSkin?.sceneProfile,
  ]);
  useEffect(() => localStorage.setItem('profileName', stationName), [stationName]);
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
    script.src = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
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
  const stageState: 'active' | 'productive' | 'idle' =
    activeSession ? 'active' : completedToday > 0 ? 'productive' : 'idle';

  // ── Lobby state ────────────────────────────────────────────────────────
  type LobbyPanelKey = 'identity' | 'stats' | 'loadout' | 'skills' | 'titles' | 'links' | 'notes' | 'privacy';
  const [lobbyOpenPanel, setLobbyOpenPanel] = useState<LobbyPanelKey | null>(null);
  const [lobbyNotes, setLobbyNotes] = useState(() => {
    try { return localStorage.getItem('xtation_profile_notes_v1') || ''; } catch { return ''; }
  });
  const [lobbyNotesSaved, setLobbyNotesSaved] = useState(true);
  const [lobbyVisibility, setLobbyVisibility] = useState<'Private' | 'Circles' | 'Community'>('Private');
  const [lobbySkills, setLobbySkills] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('xtation_profile_skills_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return ['Deep Work', 'Writing', 'Code', 'Design', 'Planning'];
  });
  const [newSkillInput, setNewSkillInput] = useState('');
  const [lobbyLinks, setLobbyLinks] = useState<{ label: string; url: string }[]>(() => {
    try {
      const raw = localStorage.getItem('xtation_profile_links_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  useEffect(() => {
    try { localStorage.setItem('xtation_profile_skills_v1', JSON.stringify(lobbySkills)); } catch {}
  }, [lobbySkills]);
  useEffect(() => {
    try { localStorage.setItem('xtation_profile_links_v1', JSON.stringify(lobbyLinks)); } catch {}
  }, [lobbyLinks]);

  const [sceneLobbyExpanded, setSceneLobbyExpanded] = useState(false);
  const [starterWorkspaceCue, setStarterWorkspaceCue] = useState<XtationStarterWorkspaceCue | null>(null);
  const [starterWorkspaceActionNotice, setStarterWorkspaceActionNotice] = useState<{
    title: string;
    detail: string;
  } | null>(null);
  const applyStarterWorkspaceAction = useCallback((target: XtationStarterWorkspaceActionTarget) => {
    if (target === 'profile:stats') {
      setLobbyOpenPanel('stats');
      return;
    }

    if (target === 'profile:loadout') {
      setLobbyOpenPanel('loadout');
      return;
    }

    setLobbyOpenPanel(null);
  }, []);
  useEffect(() => {
    setSceneLobbyExpanded(false);
  }, []);
  useEffect(() => {
    const consumeCue = (cue?: XtationStarterWorkspaceCue | null) => {
      if (!cue || cue.workspaceView !== ClientView.PROFILE) return;
      setStarterWorkspaceCue(cue);
      setLobbyOpenPanel(null);
      setSceneLobbyExpanded(true);
      clearPendingStarterWorkspaceCue();
    };

    consumeCue(readPendingStarterWorkspaceCue());

    const handleStarterWorkspaceCue = (event: Event) => {
      consumeCue((event as CustomEvent<XtationStarterWorkspaceCue>).detail);
    };

    window.addEventListener(STARTER_WORKSPACE_CUE_EVENT, handleStarterWorkspaceCue as EventListener);
    return () => window.removeEventListener(STARTER_WORKSPACE_CUE_EVENT, handleStarterWorkspaceCue as EventListener);
  }, []);
  useEffect(() => {
    const consumeAction = (
      action?: { workspaceView: ClientView.PROFILE | ClientView.LAB; target: XtationStarterWorkspaceActionTarget } | null
    ) => {
      if (!action || action.workspaceView !== ClientView.PROFILE) return;
      const actionDescriptor = describeStarterWorkspaceAction(starterWorkspaceCue, action.target);
      applyStarterWorkspaceAction(action.target);
      setStarterWorkspaceActionNotice(actionDescriptor);
      clearPendingStarterWorkspaceAction();
    };

    consumeAction(readPendingStarterWorkspaceAction());

    const handleStarterWorkspaceAction = (event: Event) => {
      consumeAction(
        (event as CustomEvent<{
          workspaceView: ClientView.PROFILE | ClientView.LAB;
          target: XtationStarterWorkspaceActionTarget;
        }>).detail
      );
    };

    window.addEventListener(STARTER_WORKSPACE_ACTION_EVENT, handleStarterWorkspaceAction as EventListener);
    return () =>
      window.removeEventListener(STARTER_WORKSPACE_ACTION_EVENT, handleStarterWorkspaceAction as EventListener);
  }, [applyStarterWorkspaceAction, starterWorkspaceCue]);
  useEffect(() => {
    const handleStarterWorkspaceDismiss = () => {
      setStarterWorkspaceCue(null);
      setStarterWorkspaceActionNotice(null);
    };

    window.addEventListener(STARTER_WORKSPACE_DISMISS_EVENT, handleStarterWorkspaceDismiss as EventListener);
    return () =>
      window.removeEventListener(STARTER_WORKSPACE_DISMISS_EVENT, handleStarterWorkspaceDismiss as EventListener);
  }, []);
  useEffect(() => {
    emitEvent(sceneLobbyExpanded ? 'profile.deck.open' : 'profile.deck.close', {
      source: 'profile',
      metadata: {
        panel: lobbyOpenPanel,
      },
    });
  }, [emitEvent, lobbyOpenPanel, sceneLobbyExpanded]);
  useEffect(() => {
    if (!lobbyOpenPanel) {
      emitEvent('profile.panel.close', {
        source: 'profile',
        metadata: {
          expanded: sceneLobbyExpanded,
        },
      });
      return;
    }
    emitEvent(`profile.panel.${lobbyOpenPanel}.open`, {
      source: 'profile',
      metadata: {
        expanded: sceneLobbyExpanded,
      },
    });
  }, [emitEvent, lobbyOpenPanel, sceneLobbyExpanded]);
  useEffect(() => {
    try {
      [
        'xtation_stage_img_v1',
        'xtation_stage_glb_key_v1',
        'xtation_stage_glb_name_v1',
        'xtation_profile_stage_mode_v1',
      ].forEach((key) => localStorage.removeItem(key));
    } catch {}
  }, []);

  const addSkill = () => {
    const v = newSkillInput.trim();
    if (!v || lobbySkills.includes(v)) return;
    setLobbySkills(prev => [...prev, v]);
    setNewSkillInput('');
  };
  const addLink = () => {
    setLobbyLinks(prev => [...prev, { label: '', url: '' }]);
  };
  const removeLink = (idx: number) => {
    setLobbyLinks(prev => prev.filter((_, i) => i !== idx));
  };
  const updateLink = (idx: number, field: 'label' | 'url', val: string) => {
    setLobbyLinks(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };

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

  const startEditingName = () => { playClickSound(); setTempName(stationName); setIsEditingName(true); };
  const saveName = () => { if (tempName.trim()) { setStationName(tempName.trim()); playSuccessSound(); } setIsEditingName(false); };
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
      data-active={activeTab === value}
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
              setStationName(e.target.value || 'Station Pilot');
            }}
            className="w-full border border-[var(--app-border)] rounded px-3 py-2 text-sm text-[var(--app-text)] bg-[var(--app-panel)] focus:outline-none focus:border-[var(--app-accent)]"
          />
        </label>

        <label className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-muted)] flex flex-col gap-1">
          <span>ID</span>
          <input
            type="text"
            value={profileId}
            placeholder="#LOCAL // ACTIVE"
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

  const renderLobbyPanelContent = (panel: LobbyPanelKey) => {
    const inputCls = 'w-full border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] rounded-lg px-[11px] py-[9px] text-[13px] text-[var(--app-text)] bg-[rgba(255,255,255,0.03)] focus:outline-none focus:border-[var(--app-accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--app-accent)_10%,transparent)] transition-[border-color,box-shadow]';
    const fieldLabel = 'text-[9px] uppercase tracking-[1.5px] text-[var(--app-muted)] mb-[5px]';

    switch (panel) {
      case 'identity':
        return (
          <div className="space-y-[14px]">
            {/* Avatar upload */}
            <div>
              <div className={fieldLabel}>Avatar</div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-[72px] h-[72px] rounded-[14px] border-2 border-dashed border-[rgba(255,255,255,0.1)] flex flex-col items-center justify-center gap-[3px] cursor-pointer text-[var(--app-muted)] text-[9px] transition-all hover:border-[var(--app-accent)] hover:bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)] hover:text-[var(--app-accent)]"
                style={{ background: 'color-mix(in_srgb,var(--app-accent)_6%,var(--app-panel))' }}
              >
                <Upload size={20} className="opacity-50" />
                upload
              </div>
            </div>
            <div>
              <div className={fieldLabel}>Display Name</div>
              <input className={inputCls} value={stationName} placeholder="Your name" onChange={e => { setStationName(e.target.value || 'Station Pilot'); setBioStats(p => ({ ...p, name: e.target.value })); }} />
            </div>
            <div>
              <div className={fieldLabel}>Role / Title</div>
              <input className={inputCls} value={roleText} placeholder="e.g. Designer" onChange={e => setRoleText(e.target.value)} />
            </div>
            <div>
              <div className={fieldLabel}>Bio</div>
              <textarea className={`${inputCls} resize-none`} rows={3} placeholder="A few words about yourself..." />
            </div>
          </div>
        );
      case 'stats': {
        const statBars = [
          { label: 'Focus',       val: Math.min(100, Math.round((completedToday / Math.max(activeMissions + completedToday, 1)) * 100)) || 72, grad: 'linear-gradient(90deg,color-mix(in_srgb,var(--app-accent)_60%,black),var(--app-accent))', delay: '0.08s' },
          { label: 'Consistency', val: Math.min(100, levelProgress),                                                                          grad: 'linear-gradient(90deg,color-mix(in_srgb,var(--app-accent)_70%,black),#a78bfa)',                   delay: '0.16s' },
          { label: 'Output',      val: Math.min(100, Math.round((totalXP / Math.max(nextConfig?.threshold ?? totalXP, 1)) * 100)) || 91,      grad: 'linear-gradient(90deg,color-mix(in_srgb,var(--app-accent)_60%,black),#c4b5fd)',                   delay: '0.24s' },
          { label: 'Endurance',   val: Math.min(100, completedToday * 12 + 10),                                                               grad: 'linear-gradient(90deg,color-mix(in_srgb,var(--app-accent)_40%,black),var(--app-accent))',         delay: '0.32s' },
          { label: 'Willpower',   val: Math.min(100, activeMissions * 15 + 25),                                                               grad: 'linear-gradient(90deg,color-mix(in_srgb,var(--app-accent)_60%,black),#a78bfa)',                   delay: '0.40s' },
        ];
        return (
          <div className="space-y-[16px]">
            {statBars.map(({ label, val, grad, delay }) => (
              <div key={label}>
                <div className="flex justify-between mb-[5px]">
                  <span className="text-[12px] font-medium text-[var(--app-text)]">{label}</span>
                  <span className="font-mono text-[11px] text-[var(--app-accent)]">{val}</span>
                </div>
                <div className="h-[7px] rounded overflow-hidden" style={{ background: 'color-mix(in_srgb,var(--app-accent)_8%,var(--app-panel))' }}>
                  <div
                    className="h-full rounded transition-[width] duration-[1400ms]"
                    style={{ width: `${val}%`, background: grad, transitionDelay: delay, position: 'relative' }}
                  >
                    <div className="absolute inset-0 rounded" style={{ background: 'linear-gradient(90deg,transparent 30%,rgba(255,255,255,0.12))' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }
      case 'loadout':
        return (
          <div className="space-y-[14px]">
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
              <div>
                <div className="text-[9px] uppercase tracking-[1.5px] text-[var(--app-muted)]">Identity Badge</div>
                <div className="mt-1 text-[12px] font-semibold text-[var(--app-text)]">{activeAvatarIdentityBadge}</div>
                {activeAvatarPresencePreset?.label ? (
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    {activeAvatarPresencePreset.label}
                  </div>
                ) : null}
              </div>
              <div className="rounded-full border border-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] px-2.5 py-1 text-[8px] uppercase tracking-[1.2px] text-[var(--app-accent)]">
                {activeAvatarPreset?.relayLabel || 'Profile Relay'}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {activeAvatarLoadoutAssignments.map(({ slot, item }) => (
                <div
                  key={slot.id}
                  className="aspect-square rounded-[10px] flex flex-col items-center justify-center gap-[5px] cursor-pointer transition-all hover:-translate-y-[3px] hover:shadow-[0_8px_20px_color-mix(in_srgb,var(--app-accent)_20%,transparent)]"
                  style={{
                    background: slot.equipped ? 'color-mix(in_srgb,var(--app-accent)_8%,var(--app-panel))' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${slot.equipped ? 'color-mix(in_srgb,var(--app-accent)_40%,transparent)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <span className="text-[22px]" style={{ opacity: slot.equipped ? 1 : 0.5 }}>{slot.icon}</span>
                  <span className="text-[8px] uppercase tracking-[1px] text-[var(--app-muted)]">{slot.label}</span>
                  <span className="max-w-[68px] truncate text-[7px] uppercase tracking-[0.12em] text-[var(--app-accent)]">
                    {item?.kind || slot.binding}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-[var(--app-muted)] text-center mt-3">
              Avatar pack controls this slot layout. Inventory equip wiring follows the authored shell.
            </div>

            <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[rgba(255,255,255,0.02)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] uppercase tracking-[1.5px] text-[var(--app-muted)]">
                    {activeAvatarPreset?.loadoutTitle || 'System Loadout'}
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--app-text)]">
                    {activeAvatarPresencePreset?.deckPrompt ||
                      activeAvatarPreset?.loadoutDescription ||
                      'Active XTATION capabilities currently shaping this station.'}
                  </div>
                </div>
                <div className="rounded-full border border-[color-mix(in_srgb,var(--app-accent)_34%,transparent)] px-2.5 py-1 text-[9px] uppercase tracking-[1.4px] text-[var(--app-accent)]">
                  {activeCapabilityItems.length} {activeAvatarPreset?.capabilityLabel || 'active'}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {activeAvatarLoadoutAssignments.map(({ slot, item }) => (
                  <div
                    key={`${slot.id}:${item?.id || 'empty'}`}
                    className="rounded-[12px] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_84%,transparent)] px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[var(--app-text)]">
                          {slot.icon} {slot.label}
                          {item ? ` • ${item.title}` : ''}
                        </div>
                        <div className="mt-1 text-[9px] uppercase tracking-[1.4px] text-[var(--app-muted)]">
                          {slot.binding} slot{item ? ` • ${item.kind} • ${item.sourceLabel}` : ' • unassigned'}
                        </div>
                      </div>
                      <div className="rounded-full border border-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] px-2 py-1 text-[8px] uppercase tracking-[1.3px] text-[var(--app-accent)]">
                        {item ? 'equipped' : 'standby'}
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                      {item
                        ? item.description
                        : `This ${slot.binding} slot is authored by the active avatar pack and will light up when a matching XTATION capability is available.`}
                    </div>
                    {item?.highlights.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.highlights.slice(0, 3).map((highlight) => (
                          <span
                            key={highlight}
                            className="rounded-full border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] px-2 py-[3px] text-[8px] uppercase tracking-[1.2px] text-[var(--app-muted)]"
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'skills':
        return (
          <div className="space-y-[14px]">
            <div className="flex flex-wrap gap-[7px]">
              {lobbySkills.map(skill => (
                <div
                  key={skill}
                  className="flex items-center gap-1.5 px-3 py-[5px] rounded-[18px] text-[11px] font-medium transition-all hover:border-[var(--app-accent)]"
                  style={{
                    color: 'var(--app-accent)',
                    background: 'color-mix(in_srgb,var(--app-accent)_15%,transparent)',
                    border: '1px solid color-mix(in_srgb,var(--app-accent)_30%,transparent)',
                  }}
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => setLobbySkills(prev => prev.filter(s => s !== skill))}
                    className="w-[14px] h-[14px] rounded-full flex items-center justify-center text-[10px] leading-none transition-colors hover:bg-red-500 hover:text-white"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-[7px]">
              <input
                type="text"
                value={newSkillInput}
                onChange={e => setNewSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSkill(); }}
                placeholder="New skill..."
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-3 py-[7px] rounded-lg text-white text-[11px] font-semibold cursor-pointer transition-colors"
                style={{ background: 'color-mix(in_srgb,var(--app-accent)_60%,black)' }}
              >
                Add
              </button>
            </div>
          </div>
        );
      case 'titles':
        return (
          <div className="space-y-2">
            {[
              { icon: '🌄', name: 'Early Bird',    desc: '10 sessions before 8 AM',     locked: false },
              { icon: '🔥', name: '100 Sessions',  desc: 'Complete 100 focus sessions',  locked: false },
              { icon: '⚡', name: 'Streak Master', desc: 'Maintain a 30-day streak',     locked: false },
              { icon: '👑', name: 'Grandmaster',   desc: 'Reach 10,000 XP total',        locked: totalXP < 10000 },
              { icon: '🌟', name: 'Night Owl',     desc: '50 sessions after midnight',   locked: true },
            ].map(t => (
              <div
                key={t.name}
                className="flex items-center gap-[10px] p-[10px] rounded-[9px] transition-all"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  opacity: t.locked ? 0.3 : 1,
                  filter: t.locked ? 'grayscale(1)' : 'none',
                }}
              >
                <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[16px] shrink-0"
                  style={{ background: 'color-mix(in_srgb,var(--app-accent)_15%,transparent)' }}>
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--app-text)] truncate">{t.name}</div>
                  <div className="text-[10px] text-[var(--app-muted)] truncate">{t.desc}</div>
                </div>
                <div className="text-[14px] shrink-0 text-[var(--app-accent)]">{t.locked ? '🔒' : '✓'}</div>
              </div>
            ))}
          </div>
        );
      case 'links':
        return (
          <div className="space-y-2">
            {lobbyLinks.map((link, idx) => (
              <div key={idx} className="flex gap-1.5">
                <input
                  value={link.label}
                  onChange={e => updateLink(idx, 'label', e.target.value)}
                  placeholder="Label"
                  className={`${inputCls} flex-[0.35]`}
                />
                <input
                  value={link.url}
                  onChange={e => updateLink(idx, 'url', e.target.value)}
                  placeholder="URL"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeLink(idx)}
                  className="w-8 h-8 shrink-0 rounded-[8px] flex items-center justify-center text-[13px] text-[var(--app-muted)] transition-all hover:bg-[rgba(239,68,68,0.12)] hover:text-red-400 hover:border-red-400"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLink}
              className="w-full py-[7px] mt-1 rounded-[8px] text-[var(--app-accent)] text-[11px] cursor-pointer transition-all hover:border-[var(--app-accent)]"
              style={{ background: 'color-mix(in_srgb,var(--app-accent)_8%,transparent)', border: '1px dashed color-mix(in_srgb,var(--app-accent)_25%,transparent)' }}
            >
              + Add Link
            </button>
          </div>
        );
      case 'notes':
        return (
          <div className="flex flex-col gap-[6px]">
            <textarea
              value={lobbyNotes}
              onChange={e => { setLobbyNotes(e.target.value); setLobbyNotesSaved(false); }}
              onBlur={() => {
                try { localStorage.setItem('xtation_profile_notes_v1', lobbyNotes); setLobbyNotesSaved(true); } catch {}
              }}
              placeholder="Personal notes, ideas, reminders..."
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '9px', color: 'var(--app-text)', fontFamily: 'inherit', fontSize: '13px', lineHeight: '1.7', outline: 'none', resize: 'none', width: '100%', minHeight: '280px', padding: '12px' }}
              className="focus:border-[var(--app-accent)] transition-[border-color]"
            />
            <div className="flex items-center gap-[5px] text-[10px] transition-colors" style={{ color: lobbyNotesSaved ? 'var(--app-accent)' : 'var(--app-muted)' }}>
              <span className="w-[5px] h-[5px] rounded-full inline-block" style={{ background: 'currentColor' }} />
              <span>{lobbyNotesSaved ? 'autosaved' : 'saving...'}</span>
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-2">
            {([
              { key: 'Private',   name: 'Private',   desc: 'Only you can see your profile. No data is shared with anyone.' },
              { key: 'Circles',   name: 'Circles',   desc: 'People in your circles can view your profile and basic stats.' },
              { key: 'Community', name: 'Community', desc: 'Your profile is visible to everyone. Stats and titles are public.' },
            ] as const).map(opt => {
              const sel = lobbyVisibility === opt.key;
              return (
                <div
                  key={opt.key}
                  onClick={() => setLobbyVisibility(opt.key)}
                  className="flex items-start gap-[10px] p-3 rounded-[9px] cursor-pointer transition-all hover:border-[color-mix(in_srgb,var(--app-accent)_25%,transparent)]"
                  style={{
                    background: sel ? 'color-mix(in_srgb,var(--app-accent)_8%,var(--app-panel))' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${sel ? 'var(--app-accent)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div
                    className="w-[18px] h-[18px] rounded-full shrink-0 mt-0.5 flex items-center justify-center transition-[border-color]"
                    style={{ border: `2px solid ${sel ? 'var(--app-accent)' : 'rgba(255,255,255,0.15)'}` }}
                  >
                    <div
                      className="w-[9px] h-[9px] rounded-full transition-transform"
                      style={{ background: 'var(--app-accent)', transform: sel ? 'scale(1)' : 'scale(0)' }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-[var(--app-text)] mb-0.5">{opt.name}</div>
                    <div className="text-[11px] text-[var(--app-muted)] leading-[1.5]">{opt.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'PROFILE': {
        type BtnDef = { key: LobbyPanelKey; label: string; icon: React.ReactNode };
        const allBtns: BtnDef[] = [
          { key: 'identity', label: 'identity', icon: <User size={16} /> },
          { key: 'stats',    label: 'stats',    icon: <BarChart2 size={16} /> },
          { key: 'loadout',  label: 'loadout',  icon: <Sword size={16} /> },
          { key: 'skills',   label: 'skills',   icon: <Zap size={16} /> },
          { key: 'titles',   label: 'titles',   icon: <Award size={16} /> },
          { key: 'links',    label: 'links',    icon: <Link2 size={16} /> },
          { key: 'notes',    label: 'notes',    icon: <FileText size={16} /> },
          { key: 'privacy',  label: 'privacy',  icon: <Shield size={16} /> },
        ];

        const DockBtn = ({ btn }: { btn: BtnDef }) => {
          const active = lobbyOpenPanel === btn.key;
          return (
            <button
              type="button"
              onClick={() => setLobbyOpenPanel(p => p === btn.key ? null : btn.key)}
              data-active={active}
              className="xt-dock-btn"
            >
              <span className="xt-dock-btn-icon">
                {btn.icon}
              </span>
              <span className="xt-dock-btn-label">
                {btn.label}
              </span>
            </button>
          );
        };

        const bgCfg = {
          active:     { glowOpacity: 1,    animDuration: '3.5s', glowStrength: '32%' },
          productive: { glowOpacity: 0.85, animDuration: '6s',   glowStrength: '22%' },
          idle:       { glowOpacity: 0.3,  animDuration: '11s',  glowStrength: '10%' },
        }[stageState];

        const currentDeckPrompt =
          (() => {
            const prompt =
              currentMission?.title ??
              activeAvatarPresencePreset?.deckPrompt ??
              activeAvatarPreset?.deckPrompt ??
              'Open deck for identity and loadout.';
            return prompt.length > 64 ? `${prompt.slice(0, 63).trimEnd()}…` : prompt;
          })();

        const currentCreativeSkinName = resolvedCreativeSkin?.name || 'Bureau Station';
        const currentSceneProfile = resolvedCreativeSkin?.sceneProfile || 'bureau';
        const currentMotionProfile = resolvedCreativeSkin?.motionProfile || 'calm';
        const currentScreenProfile = resolvedCreativeSkin?.screenProfile || 'bureau';
        const currentAvatarProfile = resolvedCreativeSkin?.avatarProfile || 'station';
        const profileRuntimeCards = [
          {
            key: 'station',
            icon: <Box size={16} />,
            label: 'station lane',
            value: currentStationLabel,
            detail: `${currentStationPlan.toUpperCase()} • ${activeAvatarLoadoutSummary.state.toUpperCase()} loadout`,
          },
          {
            key: 'skin',
            icon: <Activity size={16} />,
            label: 'skin package',
            value: currentCreativeSkinName,
            detail: `${currentSceneProfile.toUpperCase()} scene • ${currentMotionProfile.toUpperCase()} motion`,
          },
          {
            key: 'avatar',
            icon: <User size={16} />,
            label: 'avatar shell',
            value: activeAvatarIdentityBadge,
            detail: `${activeAvatarPreset?.shellLabel || 'Profile deck'} • ${currentAvatarProfile.toUpperCase()} avatar`,
          },
          {
            key: 'loadout',
            icon: <Zap size={16} />,
            label: 'loadout sync',
            value: `${activeAvatarLoadoutSummary.occupiedSlots}/${activeAvatarLoadoutSummary.totalSlots} slots`,
            detail: activeAvatarLoadoutSummary.missingBindings.length
              ? `${activeAvatarLoadoutSummary.missingBindings.length} bindings missing`
              : 'All bindings mapped',
          },
        ] as const;

        return (
          <div className="xt-profile-stage-wrapper h-full relative overflow-hidden">
            {/* dotPulse keyframe */}
            <style>{`
              @keyframes dotPulse {
                0%, 100% { transform: scale(1); box-shadow: 0 0 16px rgba(255,255,255,.35); }
                50% { transform: scale(1.08); box-shadow: 0 0 26px rgba(255,255,255,.5); }
              }
            `}</style>

            {/* ── Stage background (full area) ── */}
            <div className="xt-profile-stage-bg absolute inset-0 overflow-hidden">
              {/* Layer 1: base bg */}
              <div className="absolute inset-0 bg-[var(--app-bg)]" />
              {/* Layer 2: reactive accent glow */}
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
              {stageState === 'active' && (
                <div
                  className="absolute inset-x-0 bottom-0 pointer-events-none stage-active-pulse"
                  style={{ height: '35%', background: 'radial-gradient(ellipse 90% 100% at 50% 100%, color-mix(in_srgb,var(--app-accent)_14%,transparent) 0%, transparent 70%)' }}
                />
              )}
              {stageState === 'idle' && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'rgba(4,6,20,0.22)' }}
                />
              )}

              <ProfileLobbyScene
                displayName={stationName}
                roleText={roleText}
                theme={theme}
                stageState={stageState}
                totalXP={totalXP}
                completedToday={completedToday}
                currentMissionTitle={currentMission?.title ?? null}
                activeSessionLabel={activeSession ? 'Session live now' : null}
                stationLabel={currentStationLabel}
                plan={currentStationPlan}
                capabilityHighlights={activeCapabilityItems.flatMap((item) => item.highlights).slice(0, 4)}
                loadoutOccupancyState={activeAvatarLoadoutSummary.state}
                occupiedLoadoutSlots={activeAvatarLoadoutSummary.occupiedSlots}
                totalLoadoutSlots={activeAvatarLoadoutSummary.totalSlots}
                missingLoadoutBindings={activeAvatarLoadoutSummary.missingBindings}
              />

              {/* Hidden profile/cover inputs (kept in DOM) */}
              <input ref={fileInputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/gif,image/jpg" onChange={handleFileChange} />
              <input ref={coverInputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,video/mp4" onChange={handleCoverChange} />
            </div>

            {!sceneLobbyExpanded ? (
              <div className="xt-profile-compact-anchor z-30">
                <button
                  type="button"
                  onClick={() => setSceneLobbyExpanded(true)}
                  className="xt-profile-compact-card group"
                >
                  <div className="xt-profile-compact-portrait">
                    {profileImage && profileImage !== ASSETS.PROFILE_ICON ? (
                      <img src={profileImage} alt="Profile" className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className="xt-profile-compact-portrait-fallback">
                        <User size={20} />
                      </div>
                    )}
                  </div>
                  <div className="xt-profile-compact-copy">
                    <div className="xt-profile-compact-kicker">
                      {activeAvatarPreset?.shellLabel || 'Profile deck'}
                    </div>
                    <div className="xt-profile-compact-title">{stationName}</div>
                    <div className="xt-profile-compact-detail">
                      {currentDeckPrompt}
                    </div>
                    <div className="xt-profile-compact-tags">
                      <span className="xt-runtime-relay-badge">{activeAvatarIdentityBadge}</span>
                      <span className="xt-runtime-relay-tag">{currentCreativeSkinName}</span>
                      <span className="xt-runtime-relay-tag">{activeAvatarLoadoutSummary.state.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="xt-profile-compact-open">
                    Deck
                  </div>
                </button>
              </div>
            ) : null}

            {/* ── Floating lobby card — left side ── */}
            {sceneLobbyExpanded ? (
            <div className="xt-profile-lobby-outer z-30">
              {/* Card shell */}
              <div className="xt-profile-lobby-card xt-profile-lobby-card--scene relative flex shrink-0">
                {/* Card inner */}
                <div
                  className="xt-profile-lobby-inner flex-1 flex overflow-hidden relative"
                >
                  {/* Corner cut accent */}
                  <div
                    className="absolute bottom-0 right-0 z-20 pointer-events-none"
                    style={{
                      width: 26, height: 26,
                      background: 'var(--app-accent)',
                      clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                    }}
                  />

                  {/* ── Dock ── */}
                  <div
                    className="xt-profile-dock shrink-0 flex flex-col items-center gap-[6px] relative z-10"
                    style={{ width: 58, padding: '10px 5px 12px' }}
                  >
                    {/* Home / avatar button */}
                    <button
                      type="button"
                      onClick={() => setLobbyOpenPanel(null)}
                      title="Home"
                      data-active={lobbyOpenPanel === null}
                      className="xt-profile-dock-home"
                    >
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" style={{ display: profileImage && profileImage !== ASSETS.PROFILE_ICON ? 'block' : 'none' }} />
                      {(!profileImage || profileImage === ASSETS.PROFILE_ICON) && (
                        <User size={18} className="xt-profile-dock-home-icon" />
                      )}
                    </button>

                    {/* 8 dock buttons */}
                    {allBtns.map(btn => <DockBtn key={btn.key} btn={btn} />)}

                    {/* Spacer */}
                    <div className="flex-1" />

                    <button
                      type="button"
                      onClick={() => setSceneLobbyExpanded(false)}
                      title="Collapse profile deck"
                      className="xt-profile-dock-collapse"
                    >
                      Min
                    </button>

                    {/* Hex logo */}
                    <div className="xt-profile-dock-mark">
                      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="color-mix(in_srgb,var(--app-accent)_90%,white)" strokeWidth="1.2" strokeLinejoin="round">
                        <path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z"/>
                        <path d="M12 2v7.5M12 22v-7.5M3.5 7l8.5 5M20.5 7l-8.5 5M3.5 17l8.5-5M20.5 17l-8.5-5" opacity=".6"/>
                      </svg>
                    </div>
                  </div>

                  {/* ── Main area ── */}
                  <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">

                    {/* Home view */}
                    <div
                      className="xt-profile-lobby-home flex-1 flex flex-col overflow-y-auto xt-scroll"
                      style={{
                        opacity: lobbyOpenPanel !== null ? 0 : 1,
                        pointerEvents: lobbyOpenPanel !== null ? 'none' : 'auto',
                        transition: 'opacity 0.25s ease',
                      }}
                    >
                      {starterWorkspaceCue ? (
                        <div className="xt-workspace-cue xt-runtime-console xt-runtime-console--profile-command mb-4">
                          <div className="xt-runtime-console-head">
                            <div className="xt-runtime-console-copy">
                              <div className="xt-runtime-console-kicker">{formatStarterWorkspaceCueEyebrow(starterWorkspaceCue)}</div>
                              <div className="xt-runtime-relay-title">{starterWorkspaceCue.title}</div>
                              <div className="xt-runtime-relay-copy">{starterWorkspaceCue.detail}</div>
                            </div>
                            <button
                              type="button"
                              className="xt-runtime-action"
                              onClick={() => dismissStarterWorkspaceCue()}
                            >
                              Dismiss
                            </button>
                          </div>
                          <div className="xt-runtime-toolbar mt-4">
                            <span className="xt-runtime-relay-badge">{starterWorkspaceCue.questTitle}</span>
                            {starterWorkspaceCue.chips.map((chip) => (
                              <span key={`profile-starter-${chip}`} className="xt-runtime-relay-tag">
                                {chip}
                              </span>
                            ))}
                          </div>
                          <div className="xt-runtime-summary-card mt-4">
                            <div className="xt-runtime-summary-label">Recommended next move</div>
                            <div className="xt-runtime-summary-value">{starterWorkspaceCue.recommendedLabel}</div>
                            <div className="xt-runtime-summary-detail">{starterWorkspaceCue.recommendedDetail}</div>
                            <div className="xt-runtime-toolbar mt-4">
                              <button
                                type="button"
                                className="xt-runtime-action"
                                onClick={() =>
                                  openStarterWorkspaceAction({
                                    workspaceView: ClientView.PROFILE,
                                    target: starterWorkspaceCue.recommendedActionTarget,
                                    source: 'profile',
                                  })
                                }
                              >
                                {starterWorkspaceCue.recommendedActionLabel}
                              </button>
                            </div>
                          </div>
                          {starterWorkspaceCue.mode === 'checkpoint' && starterWorkspaceCue.checkpointLabel ? (
                            <div className="xt-runtime-summary-card xt-workspace-cue__checkpoint mt-4">
                              <div className="xt-runtime-summary-head">
                                <div>
                                  <div className="xt-runtime-summary-label">Checkpoint status</div>
                                  <div className="xt-runtime-summary-value">{starterWorkspaceCue.checkpointLabel}</div>
                                </div>
                                {starterWorkspaceCue.checkpointTrackedLabel ? (
                                  <div className="xt-workspace-cue__checkpoint-meta">
                                    {starterWorkspaceCue.checkpointTrackedLabel}
                                  </div>
                                ) : null}
                              </div>
                              {starterWorkspaceCue.checkpointDetail ? (
                                <div className="xt-runtime-summary-detail">{starterWorkspaceCue.checkpointDetail}</div>
                              ) : null}
                              {starterWorkspaceCue.checkpointOutcomeLabel ? (
                                <div className="xt-workspace-cue__checkpoint-outcome">
                                  <div className="xt-workspace-cue__checkpoint-outcome-label">
                                    {starterWorkspaceCue.checkpointOutcomeLabel}
                                  </div>
                                  {starterWorkspaceCue.checkpointOutcomeDetail ? (
                                    <div className="xt-workspace-cue__checkpoint-outcome-detail">
                                      {starterWorkspaceCue.checkpointOutcomeDetail}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="xt-workspace-cue__checkpoint-bar">
                                <div
                                  className="xt-workspace-cue__checkpoint-fill"
                                  style={{ width: `${Math.round((starterWorkspaceCue.checkpointProgress ?? 0) * 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : null}
                          <div className="xt-runtime-toolbar mt-4">
                            <button
                              type="button"
                              className="xt-runtime-action"
                              onClick={() => openPlayNavigation({ taskId: starterWorkspaceCue.questId, requestedBy: 'profile' })}
                            >
                              Open Quest
                            </button>
                            <button
                              type="button"
                              className="xt-runtime-action"
                              onClick={() =>
                                openDuskBrief({
                                  title: `Starter handoff: ${starterWorkspaceCue.questTitle}`,
                                  body: `${starterWorkspaceCue.detail}\n\nRoute steps:\n${starterWorkspaceCue.steps
                                    .map((step, index) => `${index + 1}. ${step}`)
                                    .join('\n')}`,
                                  source: 'profile',
                                  tags: ['starter-handoff', starterWorkspaceCue.track, starterWorkspaceCue.branch.toLowerCase()],
                                  linkedQuestIds: [starterWorkspaceCue.questId],
                                  createdAt: starterWorkspaceCue.createdAt,
                                })
                              }
                            >
                              Brief Dusk
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {starterWorkspaceActionNotice ? (
                        <div className="xt-runtime-summary-card xt-workspace-cue__action-confirmation mb-4">
                          <div className="xt-runtime-summary-label">Starter action confirmed</div>
                          <div className="xt-runtime-summary-value">{starterWorkspaceActionNotice.title}</div>
                          <div className="xt-runtime-summary-detail">{starterWorkspaceActionNotice.detail}</div>
                        </div>
                      ) : null}
                      <div className="xt-profile-lobby-command xt-runtime-console xt-runtime-console--profile-command">
                        <div className="xt-profile-lobby-command-head">
                          <div className="xt-profile-lobby-command-copy">
                            <div className="xt-profile-lobby-command-kicker">
                              {activeAvatarPreset?.shellLabel || 'Profile deck'}
                            </div>
                            <div className="xt-profile-lobby-command-title">{stationName}</div>
                            <div className="xt-profile-lobby-command-detail">{currentDeckPrompt}</div>
                          </div>
                          <div className="xt-runtime-package-badge">{activeAvatarIdentityBadge}</div>
                        </div>
                        <div className="xt-profile-lobby-command-tags">
                          <span className="xt-runtime-relay-tag">{currentCreativeSkinName}</span>
                          <span className="xt-runtime-relay-tag">{currentSceneProfile.toUpperCase()}</span>
                          <span className="xt-runtime-relay-tag">{currentStationPlan.toUpperCase()}</span>
                          <span className="xt-runtime-relay-tag">{activeAvatarLoadoutSummary.state.toUpperCase()}</span>
                        </div>
                      </div>

                      {/* Profile picture box */}
                      <div
                        className="xt-profile-lobby-portrait relative shrink-0 overflow-hidden cursor-pointer group"
                        onClick={handleImageClick}
                        title="Change profile picture"
                      >
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{ background: 'radial-gradient(circle at 50% 50%, color-mix(in_srgb,var(--app-accent)_8%,transparent), transparent 70%)' }}
                        />
                        {profileImage && profileImage !== ASSETS.PROFILE_ICON ? (
                          <img src={profileImage} alt="Profile" className="w-full h-full object-cover block" draggable={false} />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 0.25 }}>
                            <div className="relative w-9 h-9">
                              <div className="absolute left-1/2 top-0 bottom-0 w-[4px] rounded-sm -translate-x-1/2" style={{ background: 'var(--app-accent)' }} />
                              <div className="absolute top-1/2 left-0 right-0 h-[4px] rounded-sm -translate-y-1/2" style={{ background: 'var(--app-accent)' }} />
                            </div>
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Camera size={20} className="text-white/80" />
                        </div>
                      </div>

                      <div className="xt-profile-runtime-grid">
                        {profileRuntimeCards.map((card) => (
                          <div key={card.key} className="xt-runtime-summary-card xt-profile-runtime-card">
                            <div className="xt-runtime-summary-head">
                              <div className="xt-runtime-summary-icon">{card.icon}</div>
                              <div className="min-w-0">
                                <div className="xt-runtime-summary-label">{card.label}</div>
                                <div className="xt-runtime-summary-value xt-profile-runtime-value">{card.value}</div>
                              </div>
                            </div>
                            <div className="xt-runtime-summary-detail xt-profile-runtime-detail">{card.detail}</div>
                          </div>
                        ))}
                      </div>

                      <div className="xt-profile-runtime-meta">
                        {([
                          { label: 'role', value: roleText },
                          { label: 'id', value: profileId.split('//')[0].trim() },
                          { label: 'email', value: bioStats.email || '—' },
                        ] as { label: string; value: string }[]).map(({ label, value }) => (
                          <div key={label} className="xt-profile-runtime-meta-row">
                            <span className="xt-profile-runtime-meta-label">{label}</span>
                            <span className="xt-profile-runtime-meta-value">{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Circular timer ring */}
                      <div className="xt-profile-runtime-block xt-profile-runtime-block--timer">
                        {(() => {
                        const now = new Date();
                        const currentHour = now.getHours();
                        const minutesLeft = 24 * 60 - (now.getHours() * 60 + now.getMinutes());
                        const h = Math.floor(minutesLeft / 60);
                        const m = minutesLeft % 60;
                        const ARC_CIRC = 408;
                        const arcOffset = ARC_CIRC - (levelProgress / 100) * ARC_CIRC;
                        const cx = 99, cy = 99, r = 85;
                        const totalSegs = 24;
                        const segAngle = 360 / totalSegs;
                        const gap = 1.5;
                        const segPaths = Array.from({ length: totalSegs }, (_, i) => {
                          const a1 = ((i * segAngle - 90 + gap / 2) * Math.PI) / 180;
                          const a2 = ((i * segAngle - 90 + segAngle - gap / 2) * Math.PI) / 180;
                          const x1 = cx + r * Math.cos(a1);
                          const y1 = cy + r * Math.sin(a1);
                          const x2 = cx + r * Math.cos(a2);
                          const y2 = cy + r * Math.sin(a2);
                          const bright = i === currentHour;
                          const color = i < currentHour
                            ? 'color-mix(in_srgb,var(--app-accent)_55%,var(--app-bg))'
                            : bright
                            ? 'var(--app-accent)'
                            : 'rgba(255,255,255,0.07)';
                          return { x1, y1, x2, y2, color, bright };
                        });
                        return (
                          <div className="xt-profile-lobby-timer shrink-0">
                            <div className="xt-profile-lobby-timer-visual relative">
                              {/* Outer segment ring */}
                              <div className="absolute" style={{ inset: -11, width: 'calc(100% + 22px)', height: 'calc(100% + 22px)' }}>
                                <svg viewBox="0 0 198 198" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                  {segPaths.map(({ x1, y1, x2, y2, color, bright }, idx) => (
                                    <path
                                      key={idx}
                                      d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`}
                                      fill="none"
                                      stroke={color}
                                      strokeWidth="7"
                                      strokeLinecap="butt"
                                      style={bright ? { filter: 'drop-shadow(0 0 5px var(--app-accent))' } : undefined}
                                    />
                                  ))}
                                </svg>
                              </div>
                              {/* Inner progress arc */}
                              <div className="absolute inset-0">
                                <svg viewBox="0 0 160 160" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                  <circle fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" cx="80" cy="80" r="65" />
                                  <circle
                                    fill="none"
                                    stroke="rgba(255,255,255,0.88)"
                                    strokeWidth="10"
                                    strokeLinecap="round"
                                    cx="80" cy="80" r="65"
                                    strokeDasharray={ARC_CIRC}
                                    strokeDashoffset={arcOffset}
                                    style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,.25))', transition: 'stroke-dashoffset 2.2s ease' }}
                                  />
                                </svg>
                              </div>
                              {/* Pulsing center dot */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div
                                  style={{
                                    width: 16, height: 16,
                                    borderRadius: '50%',
                                    background: '#fff',
                                    boxShadow: '0 0 16px rgba(255,255,255,.35)',
                                    animation: 'dotPulse 3.5s ease-in-out infinite',
                                  }}
                                />
                              </div>
                            </div>
                            <div className="xt-profile-lobby-timer-label">
                              {h}:{String(m).padStart(2, '0')} left for the day
                            </div>
                          </div>
                        );
                        })()}
                      </div>

                      {/* Stats row */}
                      <div className="xt-profile-lobby-stats shrink-0">
                        <div className="xt-profile-lobby-stat">
                          <div className="xt-profile-lobby-stat-label">XP</div>
                          <div className="xt-profile-lobby-stat-value">{totalXP}</div>
                        </div>
                        <div className="xt-profile-lobby-stat">
                          <div className="xt-profile-lobby-stat-label">Done Today</div>
                          <div className="xt-profile-lobby-stat-value">{completedToday}</div>
                        </div>
                      </div>

                      {/* Session bar */}
                      <div className="xt-profile-lobby-session shrink-0 mt-auto">
                        <div className="xt-profile-lobby-session-head">
                          <div className="xt-profile-lobby-session-label">
                            {activeSession ? 'Session running' : 'No active session'}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              if (activeSession) { stopSession(); } else { startSession({ title: 'Quick session', tag: 'stage', source: 'timer', linkedTaskIds: [] }); }
                            }}
                            data-running={activeSession ? 'true' : 'false'}
                            className="xt-profile-lobby-session-toggle"
                          >
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke={activeSession ? '#fff' : 'var(--app-accent)'} strokeWidth="2.2">
                              {activeSession
                                ? <rect x="6" y="6" width="12" height="12" rx="2" />
                                : <polygon points="5,3 19,12 5,21" />
                              }
                            </svg>
                          </button>
                        </div>
                        <div className="xt-profile-lobby-session-bar">
                          <div
                            className="xt-profile-lobby-session-fill transition-[width] duration-[1800ms]"
                            style={{ width: `${levelProgress}%` }}
                          />
                        </div>
                        <div className="xt-profile-lobby-session-progress">{levelProgress}%</div>
                      </div>
                    </div>

                    {/* ── Panel overlay ── */}
                    <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
                      {(['identity', 'stats', 'loadout', 'skills', 'titles', 'links', 'notes', 'privacy'] as LobbyPanelKey[]).map(key => (
                        <div
                          key={key}
                          className="xt-profile-lobby-panel absolute inset-0 overflow-y-auto xt-scroll"
                          style={{
                            opacity: lobbyOpenPanel === key ? 1 : 0,
                            visibility: lobbyOpenPanel === key ? 'visible' : 'hidden',
                            pointerEvents: lobbyOpenPanel === key ? 'auto' : 'none',
                            transition: lobbyOpenPanel === key
                              ? 'opacity 0.25s ease, visibility 0s 0s'
                              : 'opacity 0.25s ease, visibility 0s 0.25s',
                            scrollbarWidth: 'thin' as const,
                            scrollbarColor: 'color-mix(in_srgb,var(--app-accent)_40%,transparent) transparent',
                          }}
                        >
                          {/* Panel header */}
                          <div className="xt-profile-lobby-panel-header">
                            <div className="xt-profile-lobby-panel-title">
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                            </div>
                            <button
                              type="button"
                              onClick={() => setLobbyOpenPanel(null)}
                              className="xt-profile-lobby-panel-close"
                              aria-label="Close panel"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          {renderLobbyPanelContent(key)}
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              </div>
            </div>
            ) : null}
          </div>
        );
      }
      case 'HEALTH':
        return (
          <div className="absolute inset-0 overflow-y-auto xt-scroll p-4">
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
          </div>
        );
      case 'LOG':
        return (
          <div className="absolute inset-0 overflow-hidden flex flex-col">
            {/* Calendar sub-tab bar */}
            <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-[var(--app-border)]">
              {(['day', 'log'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setCalendarSubView(view)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-[0.16em] transition-colors ${
                    calendarSubView === view
                      ? 'bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] text-[var(--app-accent)]'
                      : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  {view === 'day' ? 'Day' : 'W / M / Y'}
                </button>
              ))}
            </div>
            {/* Calendar content */}
            <div className="flex-1 overflow-hidden relative">
              {calendarSubView === 'day' ? <DayTimeline /> : <LogCalendar />}
            </div>
          </div>
        );
      case 'ACTIVITY':
        return (
          <div className="absolute inset-0 overflow-hidden">
            <ProfileActivity />
          </div>
        );
      case 'ACHIEVEMENTS':
        return (
          <div className="absolute inset-0 overflow-y-auto xt-scroll p-4">
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
          </div>
        );
    }
  };

  return (
    <div className="xt-profile-wrapper h-full overflow-hidden flex bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Main area */}
      <div className="xt-profile-main flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Game HUD tab bar */}
        <div className="xt-profile-tabs-bar flex items-center justify-center py-2 shrink-0 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] px-4 gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[color-mix(in_srgb,var(--app-accent)_30%,transparent)]" />
          <div className="flex items-center gap-1 bg-[var(--app-panel)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] rounded-xl px-1.5 py-1">
            <TabButton label="PROFILE" value="PROFILE" icon={<User size={12} />} />
            <TabButton label="HEALTH" value="HEALTH" icon={<Activity size={12} />} />
            <TabButton label="ACHIEVEMENTS" value="ACHIEVEMENTS" icon={<Award size={12} />} />
            <TabButton label="ACTIVITY" value="ACTIVITY" icon={<Activity size={12} />} />
            <TabButton label="LOG" value="LOG" icon={<Box size={12} />} />
          </div>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[color-mix(in_srgb,var(--app-accent)_30%,transparent)]" />
        </div>

        {/* Fixed content area — each tab manages its own scroll */}
        <div className="xt-profile-content-frame flex-1 overflow-hidden relative">
          {renderTabContent()}
        </div>
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
