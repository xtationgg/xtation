import React from 'react';

interface SignalBarProps {
  activeProjects: number;
  enabledAutomations: number;
  notesCount: number;
  playMinutesToday: number;
  knowledgeEdges: number;
}

const cells: Array<{ key: keyof SignalBarProps; label: string }> = [
  { key: 'activeProjects', label: 'PROJECTS' },
  { key: 'enabledAutomations', label: 'CIRCUITS' },
  { key: 'notesCount', label: 'NOTES' },
  { key: 'playMinutesToday', label: 'PLAY MIN' },
  { key: 'knowledgeEdges', label: 'EDGES' },
];

export const SignalBar: React.FC<SignalBarProps> = (props) => (
  <div className="xt-cabinet-signal-bar">
    {cells.map((cell) => (
      <div key={cell.key} className="xt-cabinet-signal-cell">
        <div className="xt-cabinet-signal-value">{props[cell.key]}</div>
        <div className="xt-cabinet-signal-label">{cell.label}</div>
      </div>
    ))}
  </div>
);
