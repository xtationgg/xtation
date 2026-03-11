import type { ClientView } from '../../types';
import type { OperatorStationRecord } from '../admin/AdminConsoleProvider';
import type { GuestStationRecoverySnapshot } from '../auth/guestStation';
import { resolveLocalStationEntryView } from '../welcome/localEntryView';

export interface StationIdentitySummary {
  modeLabel: string;
  title: string;
  detail: string;
  workspaceLabel: string;
  chips: string[];
  tone: 'default' | 'accent';
}

const formatWorkspaceLabel = (view: ClientView | null | undefined) => {
  switch (view) {
    case 'LOBBY':
      return 'Play';
    case 'HOME':
    case 'LAB':
      return 'Lab';
    case 'PROFILE':
      return 'Profile';
    case 'MULTIPLAYER':
      return 'Multiplayer';
    case 'INVENTORY':
      return 'Inventory';
    case 'STORE':
      return 'Store';
    case 'SETTINGS':
      return 'Settings';
    case 'ADMIN':
      return 'Admin';
    case 'TFT':
      return 'Earth';
    case 'UI_KIT':
      return 'UI Kit';
    default:
      return 'Play';
  }
};

interface BuildStationIdentitySummaryOptions {
  currentStation?: OperatorStationRecord | null;
  activeUserId?: string | null;
  isGuestMode?: boolean;
  activeView?: ClientView | null;
  handoffRecoverySnapshot?: GuestStationRecoverySnapshot | null;
  access?: {
    canAccessAdmin?: boolean;
    featureVisibility?: {
      lab?: boolean;
      multiplayer?: boolean;
      store?: boolean;
    };
  };
}

export const buildStationIdentitySummary = ({
  currentStation,
  activeUserId,
  isGuestMode,
  activeView,
  handoffRecoverySnapshot,
  access,
}: BuildStationIdentitySummaryOptions): StationIdentitySummary => {
  const releaseChannel = currentStation?.releaseChannel ?? 'internal';
  const plan = currentStation?.plan ?? 'free';
  const resolvedImportedView = resolveLocalStationEntryView(
    handoffRecoverySnapshot?.guestContext?.importedView ?? null,
    access
  );
  const resolvedActiveView = resolveLocalStationEntryView(activeView ?? null, access);
  const workspaceLabel = formatWorkspaceLabel(resolvedImportedView ?? resolvedActiveView ?? null);

  if (activeUserId) {
    if (handoffRecoverySnapshot) {
      return {
        modeLabel: 'Imported Local',
        title: 'Imported local station active',
        detail:
          'This signed-in workspace is currently running the imported local station. A recovery snapshot of the previous account state is still available on this device.',
        workspaceLabel,
        chips: ['Recovery saved', releaseChannel, plan],
        tone: 'accent',
      };
    }

    return {
      modeLabel: 'Account',
      title: 'Account station active',
        detail:
          'The signed-in account is the active source of truth for this station. Local presentation and settings now follow the account profile.',
      workspaceLabel: formatWorkspaceLabel(resolvedActiveView ?? null),
      chips: [releaseChannel, plan, currentStation?.betaCohort || 'No beta cohort'],
      tone: 'default',
    };
  }

  if (isGuestMode) {
    return {
      modeLabel: 'Local',
      title: 'Local station active',
      detail:
        'This device is running the offline-first station. You can connect later and choose whether to keep it local or import it into an account.',
      workspaceLabel: formatWorkspaceLabel(resolvedActiveView ?? null),
      chips: ['Offline-first', 'No cloud account', plan],
      tone: 'default',
    };
  }

  return {
    modeLabel: 'Station',
    title: 'Station available',
    detail: 'XTATION is ready to open a local or account-backed station.',
    workspaceLabel: formatWorkspaceLabel(resolvedActiveView ?? null),
    chips: [releaseChannel, plan],
    tone: 'default',
  };
};
