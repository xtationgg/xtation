import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface StageSize {
  width: number;
  height: number;
}

export interface StageLayer {
  id?: string;
  src: string;
  opacity?: number;
  visible?: boolean;
}

interface StageProps {
  stageSize: StageSize;
  referenceImage?: string;
  layers?: StageLayer[];
  children?: React.ReactNode;
  className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const Stage: React.FC<StageProps> = ({ stageSize, referenceImage, layers = [], children, className = '' }) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const hasAutoFittedRef = useRef(false);

  const [zoomPct, setZoomPct] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showReference, setShowReference] = useState(true);
  const [referenceOpacity, setReferenceOpacity] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const scale = zoomPct / 100;

  const fitToScreen = useCallback(() => {
    const { width: viewportWidth, height: viewportHeight } = viewportSize;
    if (!viewportWidth || !viewportHeight) return;

    const nextScale = clamp(
      Math.min(viewportWidth / stageSize.width, viewportHeight / stageSize.height),
      0.25,
      2
    );

    setZoomPct(Math.round(nextScale * 100));
    setOffset({
      x: Math.round((viewportWidth - stageSize.width * nextScale) / 2),
      y: Math.round((viewportHeight - stageSize.height * nextScale) / 2),
    });
  }, [viewportSize, stageSize.width, stageSize.height]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setViewportSize({
        width: Math.max(0, Math.floor(entry.contentRect.width)),
        height: Math.max(0, Math.floor(entry.contentRect.height)),
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hasAutoFittedRef.current) return;
    if (!viewportSize.width || !viewportSize.height) return;
    fitToScreen();
    hasAutoFittedRef.current = true;
  }, [viewportSize, fitToScreen]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setOffset({
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
      });
    };

    const onMouseUp = () => {
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  const handleViewportMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    setIsDragging(true);
    event.preventDefault();
  };

  const visibleLayers = useMemo(
    () => layers.filter((layer) => layer.visible !== false),
    [layers]
  );

  return (
    <div className={`grid gap-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={fitToScreen}
          className="ui-pressable chamfer-all border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] hover:border-[var(--ui-accent)]"
        >
          Fit To Screen
        </button>

        <div className="flex items-center gap-2 rounded-[12px] border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Zoom</span>
          <input
            type="range"
            min={25}
            max={200}
            value={zoomPct}
            onChange={(event) => setZoomPct(Number(event.target.value))}
            className="accent-[var(--ui-accent)]"
          />
          <span className="min-w-[42px] text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)]">{zoomPct}%</span>
        </div>

        <button
          type="button"
          onClick={() => setShowReference((prev) => !prev)}
          className={`ui-pressable chamfer-all border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
            showReference
              ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[var(--ui-text)] ui-glow'
              : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
          }`}
        >
          SHOW REFERENCE {showReference ? 'ON' : 'OFF'}
        </button>

        <div className="flex items-center gap-2 rounded-[12px] border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-muted)]">Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={referenceOpacity}
            onChange={(event) => setReferenceOpacity(Number(event.target.value))}
            disabled={!showReference}
            className="accent-[var(--ui-accent)] disabled:opacity-40"
          />
          <span className="min-w-[36px] text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)]">{referenceOpacity}%</span>
        </div>
      </div>

      <div
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
        className={`relative h-[720px] overflow-hidden rounded-[10px] border border-[var(--ui-border)] bg-[var(--ui-panel-2)] ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: stageSize.width,
            height: stageSize.height,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {showReference && referenceImage ? (
            <img
              src={referenceImage}
              alt="Stage reference"
              className="pointer-events-none absolute inset-0 select-none"
              style={{ width: stageSize.width, height: stageSize.height, opacity: referenceOpacity / 100 }}
              draggable={false}
            />
          ) : null}

          {visibleLayers.map((layer, index) => (
            <img
              key={layer.id || `${layer.src}-${index}`}
              src={layer.src}
              alt={layer.id || `Layer ${index + 1}`}
              className="pointer-events-none absolute inset-0 select-none"
              style={{
                width: stageSize.width,
                height: stageSize.height,
                opacity: layer.opacity ?? 1,
              }}
              draggable={false}
            />
          ))}

          {children}
        </div>
      </div>
    </div>
  );
};

export default Stage;
