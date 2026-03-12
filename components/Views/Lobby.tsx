import React from 'react';
import { Play } from './Play';
import { ClientView } from '../../types';
import type { XtationOnboardingHandoff } from '../../src/onboarding/storage';
import type { StationIdentitySummary } from '../../src/station/stationIdentity';
import type { XtationStarterSessionLiveTransition } from '../../src/onboarding/workspaceCue';

interface LobbyProps {
  onBack: () => void;
  setBackground: (url: string | null) => void;
  onNavigateStage?: (view: ClientView.LOBBY | ClientView.MATCH_FOUND | ClientView.CHAMP_SELECT) => void;
  onOpenWorkspace?: (view: ClientView) => void;
  onOpenGuidedSetup?: () => void;
  onboardingHandoff?: XtationOnboardingHandoff | null;
  onDismissOnboardingHandoff?: () => void;
  stationIdentity?: StationIdentitySummary | null;
  onStarterSessionLive?: (transition: XtationStarterSessionLiveTransition) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  onOpenWorkspace,
  onOpenGuidedSetup,
  onboardingHandoff,
  onDismissOnboardingHandoff,
  stationIdentity,
  onStarterSessionLive,
}) => {
  return (
    <div className="min-h-full w-full font-mono">
      <Play
        onOpenWorkspace={onOpenWorkspace}
        onOpenGuidedSetup={onOpenGuidedSetup}
        onboardingHandoff={onboardingHandoff}
        onDismissOnboardingHandoff={onDismissOnboardingHandoff}
        stationIdentity={stationIdentity}
        onStarterSessionLive={onStarterSessionLive}
      />
    </div>
  );
};
