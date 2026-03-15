import React from 'react';

type DotStatus = 'running' | 'armed' | 'paused' | 'complete' | 'failed' | 'active' | 'todo' | 'done' | 'dropped';

export const StatusDot: React.FC<{ status: DotStatus; size?: number }> = ({ status, size = 8 }) => (
  <span className={`play-status-dot play-status-dot--${status}`} style={{ width: size, height: size }} />
);
