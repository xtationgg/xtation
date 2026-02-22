import React, { useState } from 'react';
import { Play, Volume2 } from 'lucide-react';

const TYPE_ITEMS = ['Alarm', 'Challenge', 'Timer', 'Countdown'];

export const MissionComposerUI: React.FC = () => {
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-2">
        <button
          type="button"
          onClick={() => setOverlayEnabled((prev) => !prev)}
          className={`ui-pressable chamfer-all border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
            overlayEnabled
              ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[var(--ui-text)] ui-glow'
              : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]'
          }`}
        >
          Overlay Compare
        </button>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Opacity</label>
          <input
            type="range"
            min={0}
            max={100}
            value={overlayOpacity}
            onChange={(event) => setOverlayOpacity(Number(event.target.value))}
            className="accent-[var(--ui-accent)]"
          />
          <span className="min-w-[34px] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)]">
            {overlayOpacity}%
          </span>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[1460px]">
        <div className="ui-panel-surface chamfer-card relative aspect-[286/164] overflow-hidden border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3">
          <div className="grid h-full grid-rows-[42%_58%] gap-2">
            {/* Top Row */}
            <div className="grid grid-cols-[2.25fr_1fr_0.86fr] gap-2">
              {/* A: Big left title panel */}
              <section className="ui-panel-surface chamfer-card relative border border-[var(--ui-border)] bg-[var(--ui-panel)]">
                <div className="absolute left-5 top-4 text-[12px] font-semibold uppercase tracking-[0.24em] text-[var(--ui-text)]">
                  TITLE HERE
                </div>
                <div className="absolute bottom-5 left-5 text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">
                  Mission Composer
                </div>
                <div className="absolute right-4 top-4 h-[74%] w-11 rounded-[10px] bg-[rgba(149,161,195,0.45)]" />
              </section>

              {/* B: Middle block */}
              <section className="grid grid-rows-[36%_64%] gap-2">
                <div className="ui-panel-surface chamfer-card flex items-center justify-between border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3">
                  <span className="chamfer-all border border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)]">
                    Alarm
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">TYPE</span>
                </div>
                <button
                  type="button"
                  className="ui-pressable ui-panel-surface chamfer-card flex items-center justify-center gap-2 border border-[var(--ui-border)] bg-[rgba(143,99,255,0.55)] text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--ui-text)]"
                >
                  <Play size={15} />
                  PLAY
                </button>
              </section>

              {/* C: Right vertical type list */}
              <section className="ui-panel-surface chamfer-card flex flex-col gap-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] p-2">
                {TYPE_ITEMS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`ui-pressable chamfer-right flex h-10 items-center justify-between border px-3 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                      type === 'Alarm'
                        ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[var(--ui-text)] ui-glow'
                        : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]'
                    }`}
                  >
                    <span>{type}</span>
                    <span className="text-[var(--ui-muted)]">&lt;</span>
                  </button>
                ))}
              </section>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-[2.25fr_1fr_0.86fr] gap-2">
              {/* D: Bottom left info panel */}
              <section className="ui-panel-surface chamfer-card relative border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
                <div className="grid h-full grid-cols-[43%_57%]">
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[var(--ui-text)]">TITLE HERE</div>
                      <p className="mt-2 max-w-[30ch] text-[10px] uppercase tracking-[0.18em] text-[var(--ui-muted)]">
                        DESCRIPTION HERE
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ui-pressable chamfer-all h-9 w-24 border border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)]"
                    >
                      DELETE
                    </button>
                  </div>

                  <div className="relative pl-5">
                    <div className="absolute inset-y-0 left-0 w-px bg-[rgba(143,99,255,0.6)]" />
                    <div className="flex h-full items-center justify-center">
                      <div className="text-[44px] font-black tracking-[0.16em] text-[var(--ui-text)]">08:19</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* E: Bottom middle timer panel */}
              <section className="ui-panel-surface chamfer-card flex flex-col border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
                <div className="flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">
                  <span>Hours</span>
                  <span>Minute</span>
                  <span>Seconds</span>
                </div>
                <div className="mt-4 flex-1 self-center text-[54px] font-black tracking-[0.14em] text-[var(--ui-text)]">12:47:32</div>
                <div className="mt-auto grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className="ui-pressable chamfer-all h-9 border border-[var(--ui-border)] bg-[rgba(143,99,255,0.55)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)]"
                  >
                    05:00
                  </button>
                  <button
                    type="button"
                    className="ui-pressable chamfer-all h-9 border border-[var(--ui-border)] bg-[rgba(143,99,255,0.55)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)]"
                  >
                    15:00
                  </button>
                  <button
                    type="button"
                    className="ui-pressable chamfer-all h-9 border border-[var(--ui-border)] bg-[rgba(143,99,255,0.55)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)]"
                  >
                    30:00
                  </button>
                </div>
              </section>

              {/* F: Bottom right tall panel */}
              <section className="ui-panel-surface chamfer-card relative border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">started at 08:19 PM</div>
                <div className="absolute bottom-4 left-4">
                  <button
                    type="button"
                    className="ui-pressable chamfer-card flex h-16 w-20 items-center justify-center border border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-text)]"
                    title="Sound"
                  >
                    <Volume2 size={18} />
                  </button>
                </div>
              </section>
            </div>
          </div>

          {overlayEnabled ? (
            <img
              src="/ui/mission-composer/reference.png"
              alt="Mission Composer reference overlay"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              style={{ opacity: overlayOpacity / 100 }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MissionComposerUI;

