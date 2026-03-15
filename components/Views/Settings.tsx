
import React, { useEffect, useRef, useState } from 'react';
import { RewardConfig } from '../../types';
import { HexPanel } from '../UI/HextechUI';
import { Hint } from '../UI/Hint';
import { Settings as SettingsIcon, Activity, Upload, CheckCircle, Monitor, Shield, DatabaseBackup, HardDriveDownload, Volume2, Gamepad2, Bell, Trophy } from 'lucide-react';
import { AuthDrawer } from '../UI/AuthDrawer';
import { playClickSound, playPanelOpenSound, playHoverSound } from '../../utils/SoundEffects';
import { readFileAsDataUrl } from '../../utils/fileUtils';
import { useAuth } from '../../src/auth/AuthProvider';
import { writeUserScopedString } from '../../src/lib/userScopedStorage';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ThemeSwitcher } from '../UI/ThemeSwitcher';
import { useXP } from '../XP/xpStore';
import { useAdminConsole } from '../../src/admin/AdminConsoleProvider';
import {
    CREATIVE_OPS_SYNC_EVENT,
    getCreativeSkinRuntimeLabel,
    getCreativeSoundPackLabel,
    listPublishedCreativeSoundSkins,
    readCreativeOpsStateSnapshot,
    resolvePublishedCreativeSkin,
} from '../../src/admin/creativeOps';
import { buildXtationExportStamp, downloadJsonPayload } from '../../src/backup/export';
import {
    clearXtationStationRestoreRecoverySnapshot,
    parseXtationStationImport,
    readXtationStationRestoreRecoverySnapshot,
    writeXtationStationRestoreRecoverySnapshot,
    type XtationStationExportPayload,
    type XtationStationRestoreRecoverySnapshot,
} from '../../src/backup/station';
import {
    buildGuestStationSummary,
    clearGuestStationRecoverySnapshot,
    readGuestStationRecoverySnapshot,
    type GuestStationRecoverySnapshot,
} from '../../src/auth/guestStation';
import {
    defaultXtationOnboardingState,
    readXtationOnboardingHandoff,
    readXtationOnboardingState,
    writeXtationOnboardingHandoff,
    writeXtationOnboardingState,
} from '../../src/onboarding/storage';
import { readStoredXtationLastView, resolveXtationLastView, writeStoredXtationLastView } from '../../src/navigation/lastView';
import { XTATION_AUDIO_MIX_GROUPS, XTATION_AUDIO_MIX_LABELS } from '../../src/presentation/audioMix';
import { usePresentationEvents } from '../../src/presentation/PresentationEventsProvider';
import { buildStationContinuityContext } from '../../src/station/continuityContext';
import { buildStationIdentitySummary } from '../../src/station/stationIdentity';
import {
    readStationActivity,
    XTATION_STATION_ACTIVITY_EVENT,
    type StationActivityEntry,
} from '../../src/station/stationActivity';
import { resolveGuestStationEntryState } from '../../src/welcome/guestContinuity';
import { resolveGuidedSetupResumeActionLabel } from '../../src/onboarding/guidedSetupResume';

interface SettingsProps {
    rewardConfigs: RewardConfig[];
    onUpdateConfig: (config: RewardConfig) => void;
    currentXP: number;
    onOpenGuidedSetup?: () => void;
}

const sectionCard = 'xt-settings-card';
const panelButton = 'xt-settings-pill';
const panelClassName = 'xt-settings-panel transition-all duration-300';

export const Settings: React.FC<SettingsProps> = ({
    rewardConfigs,
    onUpdateConfig,
    currentXP,
    onOpenGuidedSetup,
}) => {
  const { user } = useAuth();
  const {
    access: operatorAccess,
    currentStation,
    platformSyncStatus,
    platformSyncMessage,
    platformCloudUpdatedAt,
    platformCloudEnabled,
    restoreCurrentStationProfile,
  } = useAdminConsole();
  const { getLedgerSnapshot, authStatus, replaceLedger } = useXP();
  const { emitEvent } = usePresentationEvents();
  const {
    settings,
    setDensity,
    setMotionReduced,
    setAudioEnabled,
    setAudioVolume,
    setActiveSoundPackId,
    setAudioMixLevel,
    setPerformanceMode,
    setDevHudEnabled,
    setInterfaceHintMode,
    setFocusMode,
    setDefaultQuestVisibility,
    setPresenceMode,
    setPrivacySetting,
    setNotification,
    setFeatureEnabled,
    setExperimentalFlag,
    replaceSettingsSnapshot,
  } = useXtationSettings();
  const { theme, options, setTheme, accent, setAccent, accentOptions, resolution, setResolution, resolutionOptions } = useTheme();
  const activeUserId = user?.id || null;
  const activeThemeLabel = options.find((option) => option.value === theme)?.label ?? theme;
  const activeAccentLabel = accentOptions.find((option) => option.value === accent)?.label ?? accent;
  const activeResolutionLabel = resolutionOptions.find((option) => option.value === resolution)?.label ?? resolution;
  const { device, user: userSettings, notifications, privacy, features } = settings;
  const userSettingsLocked = !activeUserId;
    
  type SettingsCategory = 'display' | 'audio' | 'gameplay' | 'privacy' | 'notifications' | 'rewards' | 'station';
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('display');
  const [handoffRecoverySnapshot, setHandoffRecoverySnapshot] = useState<GuestStationRecoverySnapshot | null>(null);
  const [restoreRecoverySnapshot, setRestoreRecoverySnapshot] = useState<XtationStationRestoreRecoverySnapshot | null>(null);
  const [stationActivity, setStationActivity] = useState<StationActivityEntry[]>([]);
  const [pendingImport, setPendingImport] = useState<XtationStationExportPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImportReviewOpen, setIsImportReviewOpen] = useState(false);
  const stationImportInputRef = useRef<HTMLInputElement | null>(null);
  const [creativeState, setCreativeState] = useState(() => readCreativeOpsStateSnapshot(activeUserId));

    const audioPreviewEvents: Array<{ label: string; eventName: string }> = [
        { label: 'UI', eventName: 'nav.section.profile.open' },
        { label: 'Alert', eventName: 'notification.urgent' },
        { label: 'Quest', eventName: 'quest.completed' },
        { label: 'Dusk', eventName: 'dusk.brief.loaded' },
        { label: 'Scene', eventName: 'profile.deck.open' },
    ];

    const previewAudioCue = (eventName: string) => {
        emitEvent(eventName, {
            source: 'settings',
            metadata: {
                preview: true,
                previewMode: 'published',
            },
        });
    };

    useEffect(() => {
        setCreativeState(readCreativeOpsStateSnapshot(activeUserId));

        const handleCreativeSync = () => {
            setCreativeState(readCreativeOpsStateSnapshot(activeUserId));
        };

        window.addEventListener(CREATIVE_OPS_SYNC_EVENT, handleCreativeSync as EventListener);
        return () => {
            window.removeEventListener(CREATIVE_OPS_SYNC_EVENT, handleCreativeSync as EventListener);
        };
    }, [activeUserId]);

    const publishedSoundSkins = listPublishedCreativeSoundSkins(creativeState);
    const activeSoundSkin =
        publishedSoundSkins.find((pack) => pack.soundPackId === settings.unlocks.activeSoundPackId) || null;
    const activeRuntimeSkin = resolvePublishedCreativeSkin(
        creativeState,
        null,
        settings.unlocks.activeSoundPackId
    );
    const activeSoundPackLabel = getCreativeSoundPackLabel(creativeState, settings.unlocks.activeSoundPackId);

    const [resolvedVisuals, setResolvedVisuals] = useState<Record<number, string>>({});

    const openVisualDB = () => new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('RewardVisualDB', 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('visuals')) {
                db.createObjectStore('visuals');
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    const saveVisualToDB = async (level: number, file: File) => {
        const db = await openVisualDB();
        const tx = db.transaction('visuals', 'readwrite');
        tx.objectStore('visuals').put(file, `visual-${level}`);
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(null);
            tx.onerror = () => reject(tx.error);
        });
        const url = URL.createObjectURL(file);
        setResolvedVisuals(prev => ({ ...prev, [level]: url }));
        return `idb:${level}`;
    };

    const loadVisualFromDB = async (level: number) => {
        try {
            const db = await openVisualDB();
            const tx = db.transaction('visuals', 'readonly');
            const req = tx.objectStore('visuals').get(`visual-${level}`);
            const blob: Blob | undefined = await new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result as Blob | undefined);
                req.onerror = () => reject(req.error);
            });
            if (blob) {
                const url = URL.createObjectURL(blob);
                setResolvedVisuals(prev => ({ ...prev, [level]: url }));
            }
        } catch (err) {
            console.error('Failed to load visual from DB', err);
        }
    };

    useEffect(() => {
        rewardConfigs.forEach(config => {
            if (config.customVisualUrl?.startsWith('idb:') && !resolvedVisuals[config.level]) {
                loadVisualFromDB(config.level);
            }
        });
    }, [rewardConfigs, resolvedVisuals]);

    useEffect(() => {
        setHandoffRecoverySnapshot(activeUserId ? readGuestStationRecoverySnapshot(activeUserId) : null);
        setRestoreRecoverySnapshot(readXtationStationRestoreRecoverySnapshot(activeUserId));
        setStationActivity(readStationActivity(activeUserId));
    }, [activeUserId]);

    useEffect(() => {
        const handleStationActivity = () => {
            setStationActivity(readStationActivity(activeUserId));
        };

        window.addEventListener(XTATION_STATION_ACTIVITY_EVENT, handleStationActivity as EventListener);
        return () => {
            window.removeEventListener(XTATION_STATION_ACTIVITY_EVENT, handleStationActivity as EventListener);
        };
    }, [activeUserId]);

    const handleThresholdChange = (level: number, val: string) => {
        const num = parseInt(val) || 0;
        const config = rewardConfigs.find(r => r.level === level);
        if (config) {
            onUpdateConfig({ ...config, threshold: num });
        }
    };

    const handleFileUpload = async (level: number, type: 'visual' | 'audio', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const config = rewardConfigs.find(r => r.level === level);
        if (!config) return;

        playClickSound();

        try {
            const isVideo = file.type.startsWith('video');
            const dataUrl = await readFileAsDataUrl(file);
            const approxSize = dataUrl.length * 0.75;
            const localLimit = 4.5 * 1024 * 1024;
            let storedUrl = dataUrl;

            if (approxSize > localLimit) {
                storedUrl = await saveVisualToDB(level, file);
            } else {
                // Save inline to avoid object URL persistence issues
                writeUserScopedString(`rewardVisual-${level}`, storedUrl, activeUserId);
                // Clear any DB ref if switching back
                setResolvedVisuals(prev => {
                    if (prev[level]) {
                        URL.revokeObjectURL(prev[level]);
                        const next = { ...prev };
                        delete next[level];
                        return next;
                    }
                    return prev;
                });
            }

            onUpdateConfig({ 
                ...config, 
                animation: 'CUSTOM', 
                customVisualUrl: storedUrl,
                customVisualType: isVideo ? 'video' : 'image'
            });
        } catch (err) {
            console.error('Failed to load custom asset', err);
        } finally {
            e.target.value = '';
        }
    };

    const optionButtonClass = (selected: boolean, disabled = false) =>
        `${panelButton} ${
            disabled ? 'disabled:opacity-50 disabled:cursor-not-allowed ' : ''
        }${
            selected
                ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
        }`;

    const toggleChipClass = (enabled: boolean, disabled = false) =>
        `${panelButton} shrink-0 ${
            disabled ? 'disabled:opacity-50 disabled:cursor-not-allowed ' : ''
        }${
            enabled
                ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
        }`;

  const importedLocalSummary = handoffRecoverySnapshot ? buildGuestStationSummary(handoffRecoverySnapshot.guestSnapshot) : null;
    const preservedAccountSummary = handoffRecoverySnapshot ? buildGuestStationSummary(handoffRecoverySnapshot.accountSnapshot) : null;
    const restoreCurrentSummary = restoreRecoverySnapshot ? buildGuestStationSummary(restoreRecoverySnapshot.currentStation.ledger) : null;
    const restoreImportedSummary = restoreRecoverySnapshot ? buildGuestStationSummary(restoreRecoverySnapshot.importedStation.ledger) : null;
    const pendingImportSummary = pendingImport ? buildGuestStationSummary(pendingImport.ledger) : null;
    const currentStationSummary = buildGuestStationSummary(getLedgerSnapshot());
    const currentStationView = readStoredXtationLastView(activeUserId);
    const restoreCurrentView = restoreRecoverySnapshot?.currentStation.navigation?.lastView ?? null;
    const restoreImportedView = restoreRecoverySnapshot?.importedStation.navigation?.lastView ?? null;
    const pendingImportView = pendingImport?.navigation?.lastView ?? null;
    const resolveImportWorkspace = (view: typeof pendingImportView) =>
        view
            ? resolveXtationLastView(view, {
                canAccessAdmin: operatorAccess.allowed,
                featureVisibility: {
                    lab: features.labEnabled,
                    multiplayer: features.multiplayerEnabled,
                    store: features.storeEnabled,
                },
            })
            : null;
    const resolvedPendingImportView = resolveImportWorkspace(pendingImportView);
    const pendingImportWorkspaceLabel =
        pendingImportView && resolvedPendingImportView && pendingImportView !== resolvedPendingImportView
            ? `${pendingImportView} → ${resolvedPendingImportView}`
            : resolvedPendingImportView || 'unchanged';
    const stationTrialDays = currentStation.trialEndsAt
        ? Math.max(0, Math.ceil((currentStation.trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;
    const stationIdentity = buildStationIdentitySummary({
        currentStation,
        activeUserId,
        isGuestMode: !activeUserId,
        activeView: currentStationView,
        handoffRecoverySnapshot,
        access: {
            canAccessAdmin: operatorAccess.allowed,
            featureVisibility: {
                lab: features.labEnabled,
                multiplayer: features.multiplayerEnabled,
                store: features.storeEnabled,
            },
        },
    });
    const {
        starterFlowSummary,
        latestTransitionActivity,
        visibleRecentStationActivity,
    } = buildStationContinuityContext(
        stationActivity,
        currentStationView,
        {
            canAccessAdmin: operatorAccess.allowed,
            featureVisibility: {
                lab: features.labEnabled,
                multiplayer: features.multiplayerEnabled,
                store: features.storeEnabled,
            },
        },
        3
    );
    const guestEntry = !activeUserId
        ? resolveGuestStationEntryState(
            stationActivity,
            starterFlowSummary,
            latestTransitionActivity,
            {
                canAccessAdmin: operatorAccess.allowed,
                featureVisibility: {
                    lab: features.labEnabled,
                    multiplayer: features.multiplayerEnabled,
                    store: features.storeEnabled,
                },
            }
        )
        : null;
    const guidedSetupResumeActionLabel =
        !activeUserId && guestEntry
            ? resolveGuidedSetupResumeActionLabel(guestEntry.localStatus, latestTransitionActivity)
            : null;
    const exportStamp = () => buildXtationExportStamp(Date.now());

    const buildCurrentStationExport = (): XtationStationExportPayload => ({
        version: 'xtation-station-export-v1',
        exportedAt: Date.now(),
        scope: activeUserId ? 'account' : 'guest',
        authStatus,
        user: activeUserId
            ? {
                id: activeUserId,
                email: user?.email ?? null,
            }
            : null,
        platform: {
            releaseChannel: currentStation.releaseChannel,
            plan: currentStation.plan,
            trialEndsAt: currentStation.trialEndsAt,
            betaCohort: currentStation.betaCohort,
            featureFlags: currentStation.featureFlags,
        },
        theme: {
            theme,
            accent,
            resolution,
        },
        settings,
        onboarding: {
            state: readXtationOnboardingState(activeUserId),
            handoff: readXtationOnboardingHandoff(activeUserId),
        },
        navigation: {
            lastView: readStoredXtationLastView(activeUserId),
        },
        ledger: getLedgerSnapshot(),
    });

    const handleExportStation = async () => {
        playClickSound();
        await downloadJsonPayload(
            `xtation-station-${activeUserId ? 'account' : 'guest'}-${exportStamp()}.json`,
            buildCurrentStationExport()
        );
    };

    const handleExportRecoverySnapshot = async () => {
        if (!handoffRecoverySnapshot) return;
        playClickSound();
        await downloadJsonPayload(
            `xtation-recovery-snapshot-${activeUserId || 'guest'}-${exportStamp()}.json`,
            {
                version: 'xtation-station-recovery-v1',
                exportedAt: Date.now(),
                scope: activeUserId ? 'account' : 'guest',
                recoverySnapshot: handoffRecoverySnapshot,
            }
        );
    };

    const handleExportRestoreSnapshot = async () => {
        if (!restoreRecoverySnapshot) return;
        playClickSound();
        await downloadJsonPayload(
            `xtation-restore-snapshot-${activeUserId || 'guest'}-${exportStamp()}.json`,
            {
                version: 'xtation-station-restore-recovery-v1',
                exportedAt: Date.now(),
                scope: activeUserId ? 'account' : 'guest',
                restoreRecoverySnapshot,
            }
        );
    };

    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const parsed = parseXtationStationImport(await file.text());
            setPendingImport(parsed);
            setImportError(null);
            setIsImportReviewOpen(true);
        } catch (error) {
            setImportError(error instanceof Error ? error.message : 'Failed to parse station file.');
        } finally {
            event.target.value = '';
        }
    };

    const handleApplyImport = async () => {
        if (!pendingImport) return;
        const restoredView = resolveImportWorkspace(pendingImport.navigation?.lastView);
        const appliedImport: XtationStationExportPayload = restoredView
            ? {
                ...pendingImport,
                navigation: {
                    lastView: restoredView,
                },
            }
            : pendingImport;

        const currentStation = buildCurrentStationExport();
        const nextRestoreSnapshot: XtationStationRestoreRecoverySnapshot = {
            createdAt: Date.now(),
            restoredIntoScope: activeUserId ? 'account' : 'guest',
            currentStation,
            importedStation: appliedImport,
        };

        writeXtationStationRestoreRecoverySnapshot(nextRestoreSnapshot, activeUserId);
        setRestoreRecoverySnapshot(nextRestoreSnapshot);

        replaceLedger(appliedImport.ledger, true);

        if (appliedImport.settings) {
            replaceSettingsSnapshot(
                activeUserId
                    ? appliedImport.settings
                    : {
                        device: appliedImport.settings.device,
                    }
            );
        }

        if (appliedImport.platform) {
            restoreCurrentStationProfile(appliedImport.platform);
        }

        if (appliedImport.theme?.theme && options.some((option) => option.value === appliedImport.theme?.theme)) {
            setTheme(appliedImport.theme.theme);
        }
        if (appliedImport.theme?.accent && accentOptions.some((option) => option.value === appliedImport.theme?.accent)) {
            setAccent(appliedImport.theme.accent);
        }
        if (
            appliedImport.theme?.resolution &&
            resolutionOptions.some((option) => option.value === appliedImport.theme?.resolution)
        ) {
            setResolution(appliedImport.theme.resolution);
        }

        writeXtationOnboardingState(appliedImport.onboarding?.state ?? defaultXtationOnboardingState, activeUserId);
        writeXtationOnboardingHandoff(appliedImport.onboarding?.handoff ?? null, activeUserId);

        if (restoredView) {
            writeStoredXtationLastView(restoredView, activeUserId);
        }

        setPendingImport(null);
        setIsImportReviewOpen(false);
        setImportError(null);
    };

    const renderCategoryContent = (category: SettingsCategory) => {
        switch (category) {
            case 'display':
                return (
                    <div className="space-y-6">
                        <div className="xt-settings-section-title">Display</div>
                        <div className="space-y-5">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Skin</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Current: {activeThemeLabel}</span>
                            </div>
                            <div className="xt-settings-skin-grid">
                                {[
                                    { themeKey: 'obsidian' as const, label: 'Obsidian Dark', description: 'Warm dark, clean, content-focused. Inter font.', bg: '#1a1a1e', panel: '#222226', accent: '#4a9eff' },
                                    { themeKey: 'obsidian_light' as const, label: 'Obsidian Light', description: 'Clean white, warm surfaces. Inter font.', bg: '#ffffff', panel: '#f6f6f6', accent: '#2383e2' },
                                    { themeKey: 'xtation' as const, label: 'XTATION Black', description: 'True black, red accent, monospace. The original.', bg: '#000000', panel: '#0a0a0c', accent: '#d6453e' },
                                    { themeKey: 'control' as const, label: 'Control', description: 'Pure black, zero effects, brutalist government facility.', bg: '#000000', panel: '#000000', accent: '#d6453e' },
                                    { themeKey: 'bureau' as const, label: 'Bureau', description: 'Federal case files. Amber accent, grain texture.', bg: '#0b0d10', panel: '#12151a', accent: '#d6a45d' },
                                    { themeKey: 'dusk' as const, label: 'Dusk', description: 'Purple-tinted dark. Rounded corners, soft glow.', bg: '#0e1014', panel: '#1f162d', accent: '#573778' },
                                    { themeKey: 'void' as const, label: 'Void', description: 'Deep space. Indigo accent, chamfered edges, glass panels.', bg: '#07080f', panel: '#0d1019', accent: '#7c5ffa' },
                                    { themeKey: 'notion_dark' as const, label: 'Notion Dark', description: 'Notion-style dark mode. Warm surfaces, blue accent.', bg: '#191919', panel: '#202020', accent: '#3291ff' },
                                ].map((skin) => {
                                    const isActive = theme === skin.themeKey;
                                    return (
                                        <div
                                            key={skin.themeKey}
                                            className={`xt-settings-skin-card ${isActive ? 'is-active' : ''}`}
                                            onClick={() => setTheme(skin.themeKey)}
                                        >
                                            <div className="xt-settings-skin-preview">
                                                <div className="xt-settings-skin-swatch" style={{ background: skin.bg }} />
                                                <div className="xt-settings-skin-swatch" style={{ background: skin.panel }} />
                                                <div className="xt-settings-skin-swatch xt-settings-skin-swatch--accent" style={{ background: skin.accent }} />
                                            </div>
                                            <div className="xt-settings-skin-info">
                                                <div className="xt-settings-skin-name">{skin.label}</div>
                                                <div className="xt-settings-skin-desc">{skin.description}</div>
                                            </div>
                                            {isActive && <div className="xt-settings-skin-active">Active</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Resolution Mode</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{activeResolutionLabel}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {resolutionOptions.map((option) => {
                                    const selected = resolution === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setResolution(option.value)}
                                            className={`ui-pressable rounded-[var(--app-radius-sm)] border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                                selected
                                                    ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                                                    : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                                            }`}
                                            aria-pressed={selected}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <Hint>Changes global workspace scale to keep layouts readable on different screen sizes.</Hint>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">UI Density</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{device.density}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(['compact', 'comfortable', 'spacious'] as const).map((option) => {
                                    const selected = device.density === option;
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setDensity(option)}
                                            className={optionButtonClass(selected)}
                                            aria-pressed={selected}
                                        >
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>
                            <Hint>Compact tightens spacing throughout the interface. Spacious adds more breathing room.</Hint>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Reduce Motion</div>
                                    <Hint>Disables transitions and animations system-wide.</Hint>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMotionReduced(device.motion !== 'reduced')}
                                    className={toggleChipClass(device.motion === 'reduced')}
                                    aria-pressed={device.motion === 'reduced'}
                                >
                                    {device.motion === 'reduced' ? 'On' : 'Off'}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Interface Hints</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{device.interfaceHintMode ?? 'hover'}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {([
                                    { value: 'off',    label: 'Off' },
                                    { value: 'hover',  label: 'Hover' },
                                    { value: 'always', label: 'Always' },
                                ] as const).map((option) => {
                                    const selected = (device.interfaceHintMode ?? 'hover') === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setInterfaceHintMode(option.value)}
                                            className={optionButtonClass(selected)}
                                            aria-pressed={selected}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <Hint>Off hides all hints. Hover shows a ⓘ icon — tooltip on hover. Always shows inline text (current behaviour).</Hint>
                        </div>
                    </div>
                );

            case 'audio':
                return (
                    <div className="space-y-6">
                        <div className="xt-settings-section-title">Audio</div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Audio Protocol</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{device.audioVolume}%</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 rounded-[var(--app-radius-sm)]">
                                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)]">System Audio</span>
                                <button
                                    type="button"
                                    onClick={() => setAudioEnabled(!device.audioEnabled)}
                                    className={toggleChipClass(device.audioEnabled)}
                                    aria-pressed={device.audioEnabled}
                                >
                                    {device.audioEnabled ? 'On' : 'Off'}
                                </button>
                            </div>
                            <label className="flex items-center gap-4 border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-3 rounded-[var(--app-radius-sm)]">
                                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)] whitespace-nowrap">Volume</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={device.audioVolume}
                                    onChange={(event) => setAudioVolume(Number(event.target.value))}
                                    className="flex-1 accent-[var(--app-accent)]"
                                />
                            </label>
                            <div className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)]">Active Sound Pack</div>
                                        <div className="mt-1 text-sm text-[var(--app-text)]">{activeSoundPackLabel}</div>
                                        <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                                            {activeSoundSkin
                                                ? getCreativeSkinRuntimeLabel(activeSoundSkin)
                                                : 'Using the currently selected published sound route.'}
                                        </div>
                                    </div>
                                    <div className={`${toggleChipClass(device.audioEnabled)} pointer-events-none`}>
                                        {device.audioEnabled ? 'Live' : 'Muted'}
                                    </div>
                                </div>
                                {publishedSoundSkins.length ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {publishedSoundSkins.map((pack) => {
                                            const selected = settings.unlocks.activeSoundPackId === pack.soundPackId;
                                            return (
                                                <button
                                                    key={pack.id}
                                                    type="button"
                                                    onClick={() => pack.soundPackId && setActiveSoundPackId(pack.soundPackId)}
                                                    className={selected ? optionButtonClass(true) : optionButtonClass(false)}
                                                    aria-pressed={selected}
                                                >
                                                    {pack.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>
                            <div className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)]">Active Skin Runtime</div>
                                        <div className="mt-1 text-sm text-[var(--app-text)]">
                                            {activeRuntimeSkin ? activeRuntimeSkin.name : 'System runtime'}
                                        </div>
                                        <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                                            {activeRuntimeSkin
                                                ? getCreativeSkinRuntimeLabel(activeRuntimeSkin)
                                                : 'No published skin package is currently bound to the active route.'}
                                        </div>
                                    </div>
                                    <div className={`${toggleChipClass(!!activeRuntimeSkin)} pointer-events-none`}>
                                        {activeRuntimeSkin ? 'Linked' : 'Open'}
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)]">Mix Groups</span>
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Runtime balance</span>
                                </div>
                                <div className="mt-3 flex flex-col gap-3">
                                    {XTATION_AUDIO_MIX_GROUPS.map((group) => (
                                        <label
                                            key={group}
                                            className="flex items-center gap-3 rounded-[12px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_70%,transparent)] px-3 py-2"
                                        >
                                            <span className="min-w-[92px] text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                                {XTATION_AUDIO_MIX_LABELS[group]}
                                            </span>
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                step={5}
                                                value={device.audioMixLevels[group]}
                                                onChange={(event) => setAudioMixLevel(group, Number(event.target.value))}
                                                className="flex-1 accent-[var(--app-accent)]"
                                            />
                                            <span className="min-w-[34px] text-right text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                                {device.audioMixLevels[group]}%
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)]">Preview Cues</span>
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                                        {settings.unlocks.activeSoundPackId ?? 'default pack'}
                                    </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {audioPreviewEvents.map((cue) => (
                                        <button
                                            key={cue.eventName}
                                            type="button"
                                            onClick={() => previewAudioCue(cue.eventName)}
                                            className={panelButton}
                                        >
                                            {cue.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'gameplay':
                return (
                    <div className="space-y-6">
                        <div className="xt-settings-section-title">Gameplay</div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Focus Mode</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{userSettings.focusMode}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(['normal', 'reduced', 'deep'] as const).map((option) => {
                                    const selected = userSettings.focusMode === option;
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setFocusMode(option)}
                                            disabled={userSettingsLocked}
                                            className={optionButtonClass(selected, userSettingsLocked)}
                                            aria-pressed={selected}
                                        >
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-[var(--app-muted)] uppercase tracking-[0.14em]">
                                Focus mode is a native engine behavior, not an AI-only feature.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Workspace Modules</div>
                                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] mt-1">
                                    Choose which major station surfaces stay visible in this workspace.
                                </div>
                            </div>
                            {([
                                ['multiplayerEnabled', 'Multiplayer'],
                                ['labEnabled', 'Lab'],
                                ['storeEnabled', 'Store'],
                            ] as const).map(([key, label]) => (
                                <div key={key} className="flex items-center justify-between gap-3 border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 rounded-[var(--app-radius-sm)]">
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)]">{label}</span>
                                    <button
                                        type="button"
                                        onClick={() => setFeatureEnabled(key, !features[key])}
                                        disabled={userSettingsLocked}
                                        className={toggleChipClass(features[key], userSettingsLocked)}
                                        aria-pressed={features[key]}
                                    >
                                        {features[key] ? 'Enabled' : 'Disabled'}
                                    </button>
                                </div>
                            ))}
                            {operatorAccess.allowed ? (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setExperimentalFlag('labsV2', !features.experimentalFlags.labsV2)}
                                        disabled={userSettingsLocked}
                                        className={toggleChipClass(!!features.experimentalFlags.labsV2, userSettingsLocked)}
                                        aria-pressed={!!features.experimentalFlags.labsV2}
                                    >
                                        Labs V2 {features.experimentalFlags.labsV2 ? 'On' : 'Off'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExperimentalFlag('storeEntitlements', !features.experimentalFlags.storeEntitlements)}
                                        disabled={userSettingsLocked}
                                        className={toggleChipClass(!!features.experimentalFlags.storeEntitlements, userSettingsLocked)}
                                        aria-pressed={!!features.experimentalFlags.storeEntitlements}
                                    >
                                        Store Entitlements {features.experimentalFlags.storeEntitlements ? 'On' : 'Off'}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Performance Mode</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{device.performanceMode}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(['quality', 'balanced', 'performance'] as const).map((option) => {
                                    const selected = device.performanceMode === option;
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setPerformanceMode(option)}
                                            className={optionButtonClass(selected)}
                                            aria-pressed={selected}
                                        >
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>
                            {operatorAccess.allowed ? (
                                <div className="flex items-center justify-between gap-3 border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 rounded-[var(--app-radius-sm)]">
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)]">Developer HUD</span>
                                    <button
                                        type="button"
                                        onClick={() => setDevHudEnabled(!device.devHudEnabled)}
                                        className={toggleChipClass(device.devHudEnabled)}
                                        aria-pressed={device.devHudEnabled}
                                    >
                                        {device.devHudEnabled ? 'On' : 'Off'}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                );

            case 'privacy':
                return (
                    <div className="space-y-6">
                        <div className="xt-settings-section-title">Privacy</div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Default Task Visibility</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{userSettings.defaultQuestVisibility}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(['private', 'circles', 'community'] as const).map((option) => {
                                    const selected = userSettings.defaultQuestVisibility === option;
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setDefaultQuestVisibility(option)}
                                            disabled={userSettingsLocked}
                                            className={optionButtonClass(selected, userSettingsLocked)}
                                            aria-pressed={selected}
                                        >
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-[var(--app-muted)] uppercase tracking-[0.14em]">
                                {!activeUserId
                                    ? 'Sign in to save privacy preferences.'
                                    : 'New tasks will default to this visibility level.'}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Multiplayer Presence</div>
                                    <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] mt-0.5">
                                        Whether others can see you as online in the squad view.
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    {(['active', 'hidden'] as const).map((option) => {
                                        const selected = userSettings.presenceMode === option;
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setPresenceMode(option)}
                                                disabled={userSettingsLocked}
                                                className={optionButtonClass(selected, userSettingsLocked)}
                                                aria-pressed={selected}
                                            >
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Profile Detail Level</span>
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{privacy.profileDetailLevel}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(['basic', 'details'] as const).map((option) => {
                                        const selected = privacy.profileDetailLevel === option;
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setPrivacySetting('profileDetailLevel', option)}
                                                disabled={userSettingsLocked}
                                                className={optionButtonClass(selected, userSettingsLocked)}
                                                aria-pressed={selected}
                                            >
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-[var(--app-muted)] uppercase tracking-[0.14em]">
                                    Controls how much of your player card is visible to others.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Location Sharing</span>
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{privacy.locationMode}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(['off', 'city', 'live'] as const).map((option) => {
                                        const selected = privacy.locationMode === option;
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setPrivacySetting('locationMode', option)}
                                                disabled={userSettingsLocked}
                                                className={optionButtonClass(selected, userSettingsLocked)}
                                                aria-pressed={selected}
                                            >
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-[var(--app-muted)] uppercase tracking-[0.14em]">
                                    Defines whether multiplayer can expose city-level or live location data.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Pin Visibility</span>
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{privacy.pinVisibility}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(['none', 'close', 'specific'] as const).map((option) => {
                                        const selected = privacy.pinVisibility === option;
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setPrivacySetting('pinVisibility', option)}
                                                disabled={userSettingsLocked}
                                                className={optionButtonClass(selected, userSettingsLocked)}
                                                aria-pressed={selected}
                                            >
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPrivacySetting('rankVisibility', !privacy.rankVisibility)}
                                    disabled={userSettingsLocked}
                                    className={toggleChipClass(privacy.rankVisibility, userSettingsLocked)}
                                    aria-pressed={privacy.rankVisibility}
                                >
                                    Rank {privacy.rankVisibility ? 'Visible' : 'Hidden'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrivacySetting('appearsInRank', !privacy.appearsInRank)}
                                    disabled={userSettingsLocked}
                                    className={toggleChipClass(privacy.appearsInRank, userSettingsLocked)}
                                    aria-pressed={privacy.appearsInRank}
                                >
                                    Ranked Feed {privacy.appearsInRank ? 'On' : 'Off'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrivacySetting('closeCircle', !privacy.closeCircle)}
                                    disabled={userSettingsLocked}
                                    className={toggleChipClass(privacy.closeCircle, userSettingsLocked)}
                                    aria-pressed={privacy.closeCircle}
                                >
                                    Close Circle {privacy.closeCircle ? 'On' : 'Off'}
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case 'notifications':
                return (
                    <div className="space-y-6">
                        <div className="xt-settings-section-title">Alerts</div>
                        <div className="space-y-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Notifications</div>
                                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] mt-1">
                                    Control which engine events surface as alerts.
                                </div>
                            </div>
                            {([
                                ['scheduledQuestReminders', 'Scheduled Quests'],
                                ['focusSessionAlerts', 'Focus Sessions'],
                                ['rewardAlerts', 'Rewards'],
                                ['multiplayerAlerts', 'Multiplayer'],
                                ['labAlerts', 'Lab'],
                            ] as const).map(([key, label]) => (
                                <div key={key} className="flex items-center justify-between gap-3 border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 rounded-[var(--app-radius-sm)]">
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)]">{label}</span>
                                    <button
                                        type="button"
                                        onClick={() => setNotification(key, !notifications[key])}
                                        disabled={userSettingsLocked}
                                        className={toggleChipClass(notifications[key], userSettingsLocked)}
                                        aria-pressed={notifications[key]}
                                    >
                                        {notifications[key] ? 'On' : 'Off'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'rewards':
                return (
                    <div className="space-y-6">
                        <div className="xt-settings-section-title">Rewards</div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-[var(--app-accent)] animate-pulse"></div>
                            <div className="text-xs text-[var(--app-muted)] font-mono">LIVE SYNC ACTIVE</div>
                        </div>
                        <div className="space-y-4">
                            {rewardConfigs.map((config) => {
                                const isAchieved = currentXP >= config.threshold;
                                const progressPercent = Math.min(100, Math.max(0, (currentXP / config.threshold) * 100));
                                return (
                                    <div
                                        key={config.level}
                                        className={`
                                            grid grid-cols-1 md:grid-cols-12 gap-4 items-start p-4 border transition-colors group relative overflow-hidden
                                            ${isAchieved ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_5%,transparent)]' : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:border-[var(--app-muted)]'}
                                        `}
                                    >
                                        {isAchieved && (
                                            <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                                                <CheckCircle size={64} className="text-[var(--app-accent)]" />
                                            </div>
                                        )}
                                        <div className="md:col-span-1 text-center pt-2 relative z-10">
                                            <div className="text-[10px] text-[var(--app-muted)] uppercase font-bold mb-1">Level</div>
                                            <div className={`text-2xl font-black ${isAchieved ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'}`}>
                                                0{config.level}
                                            </div>
                                            {isAchieved ? (
                                                <div className="mt-1 text-[8px] font-bold text-[var(--app-accent)] border border-[var(--app-accent)] px-1 inline-block">ACQUIRED</div>
                                            ) : (
                                                <div className="mt-1 text-[8px] font-bold text-[var(--app-muted)] border border-[var(--app-border)] px-1 inline-block">LOCKED</div>
                                            )}
                                        </div>
                                        <div className="md:col-span-2 relative z-10">
                                            <label className="text-[10px] text-[var(--app-muted)] uppercase font-bold block mb-1">XP Threshold</label>
                                            <div className="relative mb-2">
                                                <input
                                                    type="number"
                                                    value={config.threshold}
                                                    onChange={(e) => handleThresholdChange(config.level, e.target.value)}
                                                    className={`w-full bg-[var(--app-bg)] border p-2 text-[var(--app-text)] font-mono outline-none transition-colors ${isAchieved ? 'border-[var(--app-accent)] text-[var(--app-accent)]' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'}`}
                                                />
                                                <div className="absolute right-2 top-2 text-[var(--app-muted)] text-xs font-bold">XP</div>
                                            </div>
                                            <div className="w-full h-20 bg-[var(--app-panel-2)] border border-[var(--app-border)] relative overflow-hidden rounded-sm">
                                                <div className="absolute inset-0 opacity-80">
                                                    {(() => {
                                                        const visualUrl = config.customVisualUrl?.startsWith('idb:')
                                                            ? resolvedVisuals[config.level]
                                                            : config.customVisualUrl;
                                                        if (visualUrl) {
                                                            if (config.customVisualType === 'video') {
                                                                return (
                                                                    <video
                                                                        key={visualUrl}
                                                                        src={visualUrl}
                                                                        className="w-full h-full object-cover"
                                                                        autoPlay
                                                                        loop
                                                                        muted
                                                                        playsInline
                                                                    />
                                                                );
                                                            }
                                                            return <img src={visualUrl} className="w-full h-full object-cover" />;
                                                        }
                                                        return (
                                                            <div className="w-full h-full bg-gradient-to-r from-[var(--app-panel)] via-[var(--app-panel-2)] to-[var(--app-panel-2)] flex items-center px-3 text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">
                                                                Custom Visual Preview
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 h-2 bg-[color-mix(in_srgb,var(--app-bg)_40%,transparent)] border-t border-[var(--app-border)]">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${isAchieved ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-muted)]'}`}
                                                        style={{ width: `${progressPercent}%` }}
                                                    ></div>
                                                </div>
                                                <div className="absolute inset-0 pointer-events-none border border-[color-mix(in_srgb,var(--app-border)_60%,transparent)]"></div>
                                            </div>
                                            <div className="flex justify-between mt-1 text-[8px] font-mono text-[var(--app-muted)]">
                                                <span>{currentXP} / {config.threshold}</span>
                                                <span>{Math.floor(progressPercent)}%</span>
                                            </div>
                                        </div>
                                        <div className="md:col-span-6 relative z-10 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] text-[var(--app-muted)] uppercase font-bold">Visual Effect</label>
                                                <label className="cursor-pointer flex items-center gap-1 text-[8px] uppercase text-[var(--app-accent)] hover:text-[var(--app-text)] transition-colors border border-[var(--app-border)] px-2 py-0.5 hover:border-[var(--app-accent)]">
                                                    <Upload size={8} /> Upload Visual
                                                    <input
                                                        type="file"
                                                        accept="image/gif,image/png,image/jpeg,video/mp4,video/webm"
                                                        className="hidden"
                                                        onChange={(e) => handleFileUpload(config.level, 'visual', e)}
                                                    />
                                                </label>
                                            </div>
                                            {config.animation === 'CUSTOM' && (
                                                <div className="text-[9px] text-[var(--app-muted)] truncate max-w-full bg-[var(--app-panel-2)] px-2 py-1 border border-[var(--app-border)]">
                                                    {config.customVisualUrl ? 'SRC: Custom Visual Loaded' : 'Upload a visual'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'station':
                return (
                    <div className="space-y-6">
                        <div className="xt-settings-section-title">Station</div>
                        <div>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="xt-settings-chip">{currentStation.kind.replace('-', ' ')}</span>
                                <span className="xt-settings-chip">{currentStation.releaseChannel}</span>
                                <span className="xt-settings-chip xt-settings-chip--accent">
                                    {currentStation.plan}{currentStation.plan === 'trial' && stationTrialDays !== null ? ` • ${stationTrialDays}d` : ''}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                                <div className={`${sectionCard} p-4`}>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-accent)]">{stationIdentity.modeLabel}</div>
                                    <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{stationIdentity.title}</div>
                                    <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{stationIdentity.workspaceLabel}</div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {stationIdentity.chips.map((chip) => (
                                            <span key={chip} className="xt-settings-chip">{chip}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className={`${sectionCard} p-4`}>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Station</div>
                                    <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{currentStation.label}</div>
                                    <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{currentStation.email || 'No cloud account linked'}</div>
                                </div>
                                <div className={`${sectionCard} p-4`}>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Rollout</div>
                                    <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{currentStation.betaCohort || 'No beta cohort'}</div>
                                    <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Last seen {new Date(currentStation.lastSeenAt).toLocaleString()}</div>
                                </div>
                                <div className={`${sectionCard} p-4`}>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Operator Access</div>
                                    <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{operatorAccess.label}</div>
                                    <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                        {operatorAccess.allowed ? operatorAccess.roles.join(' • ') : 'No operator privileges'}
                                    </div>
                                </div>
                                <div className={`${sectionCard} p-4 xl:col-span-4`}>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Platform Profile Sync</div>
                                            <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">
                                                {platformCloudEnabled ? platformSyncStatus.replace('_', ' ') : 'local fallback'}
                                            </div>
                                        </div>
                                        <div className="xt-settings-chip">
                                            {platformCloudEnabled ? `Cloud updated ${platformCloudUpdatedAt ? new Date(platformCloudUpdatedAt).toLocaleString() : 'pending'}` : 'No cloud profile table'}
                                        </div>
                                    </div>
                                    <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                        {platformSyncMessage
                                            ? platformSyncMessage
                                            : platformCloudEnabled
                                                ? 'Plan, release channel, beta cohort, rollout flags, theme, and active XTATION unlocks now sync with the signed-in account profile.'
                                                : 'Install the Supabase platform profile table to make signed-in platform state persist beyond this device.'}
                                    </div>
                                    <div className="mt-4 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">Continuity Readout</div>
                                        <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">{stationIdentity.detail}</div>
                                    </div>
                                    <div className="mt-4 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">Starter Loop Status</div>
                                                <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">
                                                    {starterFlowSummary ? starterFlowSummary.title : 'No starter loop milestone yet'}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {starterFlowSummary ? (
                                                    <>
                                                        <span className="xt-settings-chip xt-settings-chip--accent">{starterFlowSummary.statusLabel}</span>
                                                        {starterFlowSummary.workspaceLabel ? (
                                                            <span className="xt-settings-chip">{starterFlowSummary.workspaceLabel}</span>
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <span className="xt-settings-chip">Awaiting first routed action</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                            {starterFlowSummary
                                                ? starterFlowSummary.detail
                                                : 'The first starter route, checkpoint, and confirmed action will be surfaced here once the opening loop becomes real work.'}
                                        </div>
                                        {starterFlowSummary ? (
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className="xt-settings-chip">{new Date(starterFlowSummary.createdAt).toLocaleString()}</span>
                                                {starterFlowSummary.chips.map((chip) => (
                                                    <span key={`starter-flow-${chip}`} className="xt-settings-chip">{chip}</span>
                                                ))}
                                            </div>
                                        ) : null}
                                        <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                            {starterFlowSummary?.statusDetail ?? 'XTATION uses the same starter loop across Play, Profile, Lab, and the station continuity surfaces.'}
                                        </div>
                                    </div>
                                    <div className="mt-4 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">Latest Transition Outcome</div>
                                                <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">
                                                    {latestTransitionActivity ? latestTransitionActivity.title : 'No recent station transition'}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="xt-settings-chip">{activeUserId ? 'Account scope' : 'Local scope'}</span>
                                                {latestTransitionActivity?.workspaceLabel ? (
                                                    <span className="xt-settings-chip xt-settings-chip--accent">{latestTransitionActivity.workspaceLabel}</span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                            {latestTransitionActivity
                                                ? latestTransitionActivity.detail
                                                : 'The next account activation, import decision, or local return will be surfaced here so the active station state stays obvious.'}
                                        </div>
                                        {latestTransitionActivity ? (
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className="xt-settings-chip">{new Date(latestTransitionActivity.createdAt).toLocaleString()}</span>
                                                {latestTransitionActivity.chips?.slice(0, 3).map((chip) => (
                                                    <span key={`latest-transition-${chip}`} className="xt-settings-chip">{chip}</span>
                                                ))}
                                            </div>
                                        ) : null}
                                        {!activeUserId && guestEntry ? (
                                            <>
                                                <div className="mt-4 text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">Next Local Resume</div>
                                                <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{guestEntry.transitionDescriptor.title}</div>
                                                <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">{guestEntry.transitionDescriptor.detail}</div>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <span className="xt-settings-chip xt-settings-chip--accent">{guestEntry.transitionDescriptor.workspaceLabel}</span>
                                                    {guestEntry.transitionDescriptor.chips.map((chip) => (
                                                        <span key={`next-resume-${chip}`} className="xt-settings-chip">{chip}</span>
                                                    ))}
                                                </div>
                                                {guidedSetupResumeActionLabel && onOpenGuidedSetup ? (
                                                    <div className="mt-3">
                                                        <button
                                                            type="button"
                                                            className={`${panelButton} border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                                                            onClick={() => { playClickSound(); onOpenGuidedSetup(); }}
                                                        >
                                                            {guidedSetupResumeActionLabel}
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </>
                                        ) : null}
                                    </div>
                                    <div className="mt-4 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">Recent Station Activity</div>
                                            <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{activeUserId ? 'Account scope' : 'Local scope'}</div>
                                        </div>
                                        {visibleRecentStationActivity.length ? (
                                            <div className="mt-3 grid gap-2">
                                                {visibleRecentStationActivity.map((entry) => (
                                                    <div
                                                        key={entry.id}
                                                        className="rounded-[12px] border border-[color-mix(in_srgb,var(--app-border)_78%,transparent)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,var(--app-bg))] px-3 py-3"
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]">{entry.title}</div>
                                                            <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{new Date(entry.createdAt).toLocaleString()}</div>
                                                        </div>
                                                        <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">{entry.detail}</div>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {entry.workspaceLabel ? (<span className="xt-settings-chip">{entry.workspaceLabel}</span>) : null}
                                                            {entry.chips?.slice(0, 3).map((chip) => (
                                                                <span key={`${entry.id}-${chip}`} className="xt-settings-chip">{chip}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                                No station activity recorded yet for this scope on this device.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3 border border-[var(--app-border)] bg-[var(--app-panel-2)] px-4 py-4 rounded-[var(--app-radius-md)]">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Station Continuity</div>
                                    <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                        Export, restore, and review local safeguard snapshots for this station.
                                    </div>
                                </div>
                                <DatabaseBackup size={16} className="text-[var(--app-accent)]" />
                            </div>
                            {handoffRecoverySnapshot && importedLocalSummary && preservedAccountSummary ? (
                                <>
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <div className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3">
                                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
                                                <HardDriveDownload size={12} />
                                                Imported Local Station
                                            </div>
                                            <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                                                {importedLocalSummary.tasks} quests, {importedLocalSummary.sessions} sessions, {importedLocalSummary.activeDays} active days
                                            </div>
                                        </div>
                                        <div className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3">
                                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
                                                <DatabaseBackup size={12} />
                                                Preserved Account Snapshot
                                            </div>
                                            <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                                                {preservedAccountSummary.tasks} quests, {preservedAccountSummary.sessions} sessions, {preservedAccountSummary.activeDays} active days
                                            </div>
                                        </div>
                                    </div>
                                    {handoffRecoverySnapshot.guestContext ? (
                                        <div className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3">
                                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
                                                <Activity size={12} />
                                                Imported Working Context
                                            </div>
                                            <div className="mt-3 grid gap-2 text-sm leading-6 text-[var(--app-muted)] sm:grid-cols-3">
                                                <div>
                                                    <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Guest workspace</div>
                                                    <div className="mt-1 text-[var(--app-text)]">{handoffRecoverySnapshot.guestContext.lastView || 'LOBBY'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Imported into</div>
                                                    <div className="mt-1 text-[var(--app-text)]">{handoffRecoverySnapshot.guestContext.importedView || 'LOBBY'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Starter relay</div>
                                                    <div className="mt-1 text-[var(--app-text)]">{handoffRecoverySnapshot.guestContext.onboardingHandoff?.title || 'None'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                            Handoff snapshot created {new Date(handoffRecoverySnapshot.createdAt).toLocaleString()}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!activeUserId) return;
                                                playClickSound();
                                                clearGuestStationRecoverySnapshot(activeUserId);
                                                setHandoffRecoverySnapshot(null);
                                            }}
                                            className="ui-pressable rounded-[var(--app-radius-sm)] border border-[var(--app-border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
                                        >
                                            Clear Handoff Snapshot
                                        </button>
                                    </div>
                                </>
                            ) : null}
                            {restoreRecoverySnapshot && restoreCurrentSummary && restoreImportedSummary ? (
                                <>
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <div className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3">
                                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
                                                <DatabaseBackup size={12} />
                                                Pre-Restore Snapshot
                                            </div>
                                            <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                                                {restoreCurrentSummary.tasks} quests, {restoreCurrentSummary.sessions} sessions, {restoreCurrentSummary.activeDays} active days
                                            </div>
                                            <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Workspace: {restoreCurrentView || 'LOBBY'}</div>
                                        </div>
                                        <div className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3">
                                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
                                                <HardDriveDownload size={12} />
                                                Imported Station
                                            </div>
                                            <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                                                {restoreImportedSummary.tasks} quests, {restoreImportedSummary.sessions} sessions, {restoreImportedSummary.activeDays} active days
                                            </div>
                                            <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Workspace: {restoreImportedView || 'unchanged'}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                            Restore safeguard created {new Date(restoreRecoverySnapshot.createdAt).toLocaleString()}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { void handleExportRestoreSnapshot(); }}
                                                className="ui-pressable rounded-[var(--app-radius-sm)] border border-[var(--app-border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
                                            >
                                                Export Restore Snapshot
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    playClickSound();
                                                    clearXtationStationRestoreRecoverySnapshot(activeUserId);
                                                    setRestoreRecoverySnapshot(null);
                                                }}
                                                className="ui-pressable rounded-[var(--app-radius-sm)] border border-[var(--app-border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
                                            >
                                                Clear Restore Snapshot
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                            {!activeUserId && !restoreRecoverySnapshot ? (
                                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                    Local station mode can export and restore full station files. Sign in if you also want account handoff recovery tracking.
                                </div>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                                <input
                                    ref={stationImportInputRef}
                                    type="file"
                                    accept="application/json,.json"
                                    className="hidden"
                                    onChange={(event) => { void handleImportFile(event); }}
                                />
                                <button
                                    type="button"
                                    onClick={() => { void handleExportStation(); }}
                                    className="ui-pressable rounded-[var(--app-radius-sm)] border border-[var(--app-accent)] bg-[var(--app-accent-weak)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]"
                                >
                                    Export Current Station
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { playClickSound(); stationImportInputRef.current?.click(); }}
                                    className="ui-pressable rounded-[var(--app-radius-sm)] border border-[var(--app-border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
                                >
                                    Import Station File
                                </button>
                                {handoffRecoverySnapshot ? (
                                    <button
                                        type="button"
                                        onClick={() => { void handleExportRecoverySnapshot(); }}
                                        className="ui-pressable rounded-[var(--app-radius-sm)] border border-[var(--app-border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
                                    >
                                        Export Recovery Snapshot
                                    </button>
                                ) : null}
                            </div>
                            {importError ? (
                                <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] px-3 py-3 text-[11px] leading-6 text-[var(--app-muted)]">
                                    {importError}
                                </div>
                            ) : null}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="xt-settings-shell min-h-full custom-scrollbar">
            <div className="xt-settings-layout">
                <nav className="xt-settings-sidebar">
                    {([
                        { key: 'display' as SettingsCategory, label: 'Display', icon: <Monitor size={15} /> },
                        { key: 'audio' as SettingsCategory, label: 'Audio', icon: <Volume2 size={15} /> },
                        { key: 'gameplay' as SettingsCategory, label: 'Gameplay', icon: <Gamepad2 size={15} /> },
                        { key: 'privacy' as SettingsCategory, label: 'Privacy', icon: <Shield size={15} /> },
                        { key: 'notifications' as SettingsCategory, label: 'Alerts', icon: <Bell size={15} /> },
                        { key: 'rewards' as SettingsCategory, label: 'Rewards', icon: <Trophy size={15} /> },
                        { key: 'station' as SettingsCategory, label: 'Station', icon: <DatabaseBackup size={15} /> },
                    ]).map((cat) => (
                        <button
                            key={cat.key}
                            type="button"
                            onClick={() => { playClickSound(); setActiveCategory(cat.key); }}
                            data-active={activeCategory === cat.key}
                            className="xt-settings-nav-btn"
                        >
                            <span className="xt-settings-nav-icon">{cat.icon}</span>
                            <span className="xt-settings-nav-label">{cat.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="xt-settings-content custom-scrollbar">
                    {renderCategoryContent(activeCategory)}
                </div>
            </div>

            <AuthDrawer
                open={isImportReviewOpen && !!pendingImport}
                onClose={() => {
                    setIsImportReviewOpen(false);
                    setPendingImport(null);
                }}
                variant="center"
                panelClassName="!w-[min(94vw,980px)] !max-h-[88dvh] overflow-hidden rounded-[24px] border border-[color-mix(in_srgb,var(--app-border)_88%,transparent)] bg-[radial-gradient(circle_at_top_left,rgba(111,178,255,0.12),transparent_26%),linear-gradient(180deg,rgba(10,12,19,0.98),rgba(8,10,16,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.42)]"
            >
                {pendingImport && pendingImportSummary ? (
                    <div className="flex max-h-[88dvh] flex-col">
                        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-7">
                            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                                <section className="space-y-5">
                                    <div className="rounded-[20px] border border-[color-mix(in_srgb,var(--app-accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_84%,transparent)] p-5">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-accent)]">Restore Review</div>
                                        <h2 className="mt-3 text-2xl font-semibold text-[var(--app-text)]">Import station file into this {activeUserId ? 'account' : 'local station'}</h2>
                                        <p className="mt-3 text-sm leading-7 text-[var(--app-muted)]">
                                            XTATION will save a local restore safeguard of the current station before replacing the live ledger and synced preferences from this file.
                                        </p>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Current Station</div>
                                            <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                                                {currentStationSummary.tasks} quests, {currentStationSummary.sessions} sessions, {currentStationSummary.activeDays} active days
                                            </div>
                                            <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                                Workspace: {currentStationView || 'LOBBY'}
                                            </div>
                                        </div>
                                        <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Imported Station</div>
                                            <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                                                {pendingImportSummary.tasks} quests, {pendingImportSummary.sessions} sessions, {pendingImportSummary.activeDays} active days
                                            </div>
                                            <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                                Workspace: {pendingImportWorkspaceLabel}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">What gets restored</div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <span className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Ledger</span>
                                            <span className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Theme</span>
                                            <span className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Display</span>
                                            <span className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                                {activeUserId ? 'Account settings' : 'Device settings'}
                                            </span>
                                            {pendingImport.platform ? (
                                                <span className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                                    Station profile
                                                </span>
                                            ) : null}
                                            <span className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Onboarding state</span>
                                        </div>
                                    </div>
                                </section>

                                <aside className="space-y-5">
                                    <div className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel)] p-5">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Import metadata</div>
                                        <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--app-muted)]">
                                            <div>Exported {new Date(pendingImport.exportedAt).toLocaleString()}</div>
                                            <div>Source scope: {pendingImport.scope}</div>
                                            <div>Theme: {pendingImport.theme?.theme || 'unchanged'}</div>
                                            <div>Accent: {pendingImport.theme?.accent || 'unchanged'}</div>
                                            <div>Resolution: {pendingImport.theme?.resolution || 'unchanged'}</div>
                                            <div>Workspace: {pendingImportWorkspaceLabel}</div>
                                            {pendingImport.platform ? (
                                                <>
                                                    <div>Release channel: {pendingImport.platform.releaseChannel}</div>
                                                    <div>Plan: {pendingImport.platform.plan}</div>
                                                    <div>Beta cohort: {pendingImport.platform.betaCohort || 'none'}</div>
                                                    <div>Feature flags: {Object.keys(pendingImport.platform.featureFlags).length}</div>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel)] p-5 text-sm leading-7 text-[var(--app-muted)]">
                                        Restore is destructive for the live station, but XTATION stores a local safeguard first so you can export the pre-restore state later if needed.
                                    </div>
                                </aside>
                            </div>
                        </div>

                        <div className="border-t border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_92%,black)] px-5 py-4 md:px-7">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                    Review complete. Apply only if this file should become the current station.
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            playClickSound();
                                            setIsImportReviewOpen(false);
                                            setPendingImport(null);
                                        }}
                                        className="inline-flex h-11 items-center justify-center rounded-[14px] border border-[var(--app-border)] px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void handleApplyImport();
                                        }}
                                        className="ui-pressable inline-flex h-12 items-center justify-center rounded-[14px] border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text)]"
                                    >
                                        Restore This Station
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </AuthDrawer>
        </div>
    );
};
