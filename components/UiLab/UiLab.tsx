import React, { Suspense, useMemo, useState } from 'react';
import { Panel } from '../UI/Panel';
import { uiLabRegistry } from './registry';

export const UiLab: React.FC = () => {
  const [activePrototypeId, setActivePrototypeId] = useState(uiLabRegistry[0]?.id ?? '');

  const activePrototype = useMemo(
    () => uiLabRegistry.find((prototype) => prototype.id === activePrototypeId) ?? uiLabRegistry[0],
    [activePrototypeId]
  );

  if (!activePrototype) {
    return (
      <div className="h-full bg-[var(--ui-bg)] px-8 py-6 text-[var(--ui-text)]">
        <Panel title="UI Lab" subtitle="prototype registry">
          <p className="text-sm text-[var(--ui-muted)]">No prototypes registered.</p>
        </Panel>
      </div>
    );
  }

  const ActivePrototypeComponent = activePrototype.component;

  return (
    <div className="h-full overflow-hidden bg-[var(--ui-bg)] px-8 py-6 text-[var(--ui-text)]">
      <div className="mx-auto h-full max-w-[1800px]">
        <div className="grid h-full grid-cols-[280px_minmax(0,1fr)] gap-4">
          <Panel title="UI Lab" subtitle="prototype list" className="h-fit">
            <div className="grid gap-2">
              {uiLabRegistry.map((prototype) => {
                const selected = prototype.id === activePrototype.id;
                return (
                  <button
                    key={prototype.id}
                    type="button"
                    onClick={() => setActivePrototypeId(prototype.id)}
                    className={`ui-pressable chamfer-card border px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.22em] ${
                      selected
                        ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-white ui-glow'
                        : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)] hover:border-[var(--ui-accent)] hover:text-[var(--ui-text)]'
                    }`}
                  >
                    {prototype.title}
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="min-h-0 overflow-y-auto">
            <Suspense
              fallback={
                <Panel title="Loading Prototype" subtitle={activePrototype.title} className="min-h-[300px]">
                  <p className="text-sm text-[var(--ui-muted)]">Preparing stage...</p>
                </Panel>
              }
            >
              <ActivePrototypeComponent
                id={activePrototype.id}
                title={activePrototype.title}
                defaultStageSize={activePrototype.defaultStageSize}
                assetsPath={activePrototype.assetsPath}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UiLab;
