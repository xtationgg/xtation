import React from 'react';
import { Panel } from '../../../UI/Panel';
import type { UiLabPrototypeRenderProps } from '../../registry';

const Proto03Placeholder: React.FC<UiLabPrototypeRenderProps> = ({ title }) => {
  return (
    <Panel title={title} subtitle="Empty slot for next prototype" className="min-h-[260px]">
      <p className="text-sm text-[var(--ui-muted)]">Ready for next design.</p>
    </Panel>
  );
};

export default Proto03Placeholder;
