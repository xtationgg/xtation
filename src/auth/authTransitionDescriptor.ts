import type { LocalStationStatus } from '../welcome/localStationStatus';
import type { AuthTransitionMode } from './authTransitionSignal';

export interface AuthTransitionDescriptor {
  modeLabel: string;
  title: string;
  detail: string;
  chips: string[];
}

interface BuildAuthTransitionDescriptorOptions {
  mode: AuthTransitionMode;
  fromGuestMode: boolean;
  workspaceLabel: string;
  continuityStatus?: LocalStationStatus | null;
}

const getAuthModeLabel = (mode: AuthTransitionMode) => {
  switch (mode) {
    case 'signup':
      return 'Account creation';
    case 'oauth':
      return 'Google sign-in';
    case 'login':
    default:
      return 'Password sign-in';
  }
};

const buildGuestContinuityDetail = (
  workspaceLabel: string,
  continuityStatus?: LocalStationStatus | null
) => {
  if (continuityStatus?.connectHint) {
    return `Target workspace: ${workspaceLabel}. ${continuityStatus.connectHint}`;
  }
  return `Target workspace: ${workspaceLabel}. XTATION will reopen the signed-in shell and keep local continuity explicit before any import changes are made.`;
};

export const buildAuthTransitionPreviewDescriptor = ({
  mode,
  fromGuestMode,
  workspaceLabel,
  continuityStatus,
}: BuildAuthTransitionDescriptorOptions): AuthTransitionDescriptor => {
  const modeLabel = getAuthModeLabel(mode);
  const continuityChip = continuityStatus?.statusValue ?? 'Continuity review';

  if (fromGuestMode || continuityStatus) {
    return {
      modeLabel,
      title:
        mode === 'signup'
          ? 'Create account and keep local continuity'
          : mode === 'oauth'
            ? 'Connect Google and review local continuity'
            : 'Connect account and review local continuity',
      detail: buildGuestContinuityDetail(workspaceLabel, continuityStatus),
      chips: [modeLabel, `${workspaceLabel} target`, continuityChip],
    };
  }

  return {
    modeLabel,
    title: mode === 'signup' ? 'Create account and open the station' : 'Open the account station',
    detail: `Target workspace: ${workspaceLabel}. XTATION will resume the signed-in account station and load synced progress, settings, and unlocks.`,
    chips: [modeLabel, `${workspaceLabel} target`, 'Cloud station'],
  };
};

export const buildAuthTransitionResultDescriptor = ({
  mode,
  fromGuestMode,
  workspaceLabel,
  continuityStatus,
}: BuildAuthTransitionDescriptorOptions): AuthTransitionDescriptor => {
  const modeLabel = getAuthModeLabel(mode);

  if (mode === 'signup') {
    return {
      modeLabel,
      title: 'Account station created',
      detail: fromGuestMode || continuityStatus
        ? `Your XTATION account is active now. ${buildGuestContinuityDetail(workspaceLabel, continuityStatus)}`
        : `Your XTATION account is active now. ${workspaceLabel} is ready to resume on the signed-in station.`,
      chips: [modeLabel, fromGuestMode ? 'Guest continuity ready' : 'New account', `${workspaceLabel} resumed`],
    };
  }

  if (mode === 'oauth') {
    return {
      modeLabel,
      title: fromGuestMode || continuityStatus ? 'Google account connected' : 'Google account active',
      detail: fromGuestMode || continuityStatus
        ? buildGuestContinuityDetail(workspaceLabel, continuityStatus)
        : `Google sign-in completed. XTATION restored the signed-in account station and resumed ${workspaceLabel}.`,
      chips: [modeLabel, fromGuestMode ? 'Guest continuity ready' : 'Cloud station active', `${workspaceLabel} resumed`],
    };
  }

  return {
    modeLabel,
    title: fromGuestMode || continuityStatus ? 'Account station connected' : 'Account station active',
    detail: fromGuestMode || continuityStatus
      ? buildGuestContinuityDetail(workspaceLabel, continuityStatus)
      : `Password sign-in completed. XTATION restored the signed-in account station and resumed ${workspaceLabel}.`,
    chips: [modeLabel, fromGuestMode ? 'Guest continuity ready' : 'Cloud station active', `${workspaceLabel} resumed`],
  };
};
