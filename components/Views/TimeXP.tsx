import React from 'react';
import { ProgressPanel } from '../XP/ProgressPanel';

export const TimeXP: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8">
        <ProgressPanel />
      </div>
    </div>
  );
};
