import React from 'react';

export const TypeBadge: React.FC<{ type: string }> = ({ type }) => (
  <span className="play-type-badge">{type.toUpperCase()}</span>
);
