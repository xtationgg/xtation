import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, actions }) => (
  <div className="play-empty-state">
    {icon ? <div className="play-empty-state__icon">{icon}</div> : null}
    <div className="play-empty-state__title">{title}</div>
    {subtitle ? <div className="play-empty-state__subtitle">{subtitle}</div> : null}
    {actions ? <div className="play-empty-state__actions">{actions}</div> : null}
  </div>
);
