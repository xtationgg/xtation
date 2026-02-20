import React from 'react';
import { PlaySection } from '../Play';
import { ClientView } from '../../types';

interface LobbyProps {
  onBack: () => void;
  setBackground: (url: string | null) => void;
  onNavigateStage?: (view: ClientView.LOBBY | ClientView.MATCH_FOUND | ClientView.CHAMP_SELECT) => void;
}

export const Lobby: React.FC<LobbyProps> = () => {
  return (
    <div className="h-full w-full flex items-start justify-center font-mono overflow-y-auto">
      {/* TODO: PLAY section integrated here. Hook backend data for Challenge + quests in components/Play. */}
      <PlaySection />
    </div>
  );
};
