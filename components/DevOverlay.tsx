/**
 * DevOverlay — Reference image overlay for pixel-perfect design matching.
 *
 * Usage: <DevOverlay src="/ui-reference/inventory-target.png" />
 *
 * Controls:
 *   Ctrl+Shift+O  → toggle overlay on/off
 *   Slider        → adjust opacity (0–100%)
 *   Drag handle   → reposition overlay
 *   Offset X/Y    → nudge overlay ±1px at a time
 *
 * The overlay image is ALWAYS click-through (pointer-events: none).
 * Only the control bar is interactive.
 */

import React, { useEffect, useRef, useState } from 'react';

interface Props {
    src: string;
    initialOpacity?: number;
}

export const DevOverlay: React.FC<Props> = ({ src, initialOpacity = 0.4 }) => {
    const [visible, setVisible] = useState(false);
    const [opacity, setOpacity] = useState(initialOpacity);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [minimized, setMinimized] = useState(false);
    const dragRef = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number }>({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

    // Ctrl+Shift+O toggle — works on macOS (no Option key weirdness)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyO') {
                e.preventDefault();
                setVisible(v => !v);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Drag via handle
    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            if (!dragRef.current.active) return;
            setOffset({
                x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
                y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
            });
        };
        const onUp = () => { dragRef.current.active = false; };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    }, []);

    const startDrag = (e: React.PointerEvent) => {
        dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    };

    const nudge = (dx: number, dy: number) => setOffset(o => ({ x: o.x + dx, y: o.y + dy }));

    // Hint badge when hidden
    if (!visible) {
        return (
            <div style={{
                position: 'fixed', bottom: 8, right: 8, zIndex: 99999,
                padding: '5px 12px', borderRadius: 4,
                background: 'rgba(0,0,0,0.75)', color: '#555',
                fontSize: 10, fontFamily: 'monospace', pointerEvents: 'none',
                letterSpacing: '0.06em',
            }}>
                Ctrl+Shift+O → overlay
            </div>
        );
    }

    return (
        <>
            {/* ── Overlay image — ALWAYS click-through ─────────────────── */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 99990,
                pointerEvents: 'none',
                transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}>
                <img
                    src={src}
                    alt=""
                    draggable={false}
                    style={{
                        width: '100%', height: '100%',
                        objectFit: 'fill',
                        opacity,
                        pointerEvents: 'none',
                        userSelect: 'none',
                    }}
                />
            </div>

            {/* ── Control bar ──────────────────────────────────────────── */}
            <div style={{
                position: 'fixed',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                gap: minimized ? 8 : 10,
                padding: minimized ? '5px 12px' : '7px 16px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.92)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
                fontFamily: 'ui-monospace, "SF Mono", monospace',
                fontSize: 10,
                color: '#888',
                userSelect: 'none',
                whiteSpace: 'nowrap',
            }}>
                {/* Drag handle */}
                <div
                    onPointerDown={startDrag}
                    style={{
                        cursor: 'grab', padding: '2px 4px',
                        color: '#555', fontSize: 12, lineHeight: 1,
                    }}
                    title="Drag to reposition overlay"
                >⠿</div>

                {minimized ? (
                    <>
                        <span style={{ color: '#666' }}>overlay {Math.round(opacity * 100)}%</span>
                        <Btn onClick={() => setMinimized(false)}>expand</Btn>
                        <Btn onClick={() => setVisible(false)} danger>✕</Btn>
                    </>
                ) : (
                    <>
                        {/* Opacity */}
                        <Label>opacity</Label>
                        <input
                            type="range" min={0} max={100}
                            value={Math.round(opacity * 100)}
                            onChange={e => setOpacity(Number(e.target.value) / 100)}
                            style={{ width: 120, accentColor: '#942f76', cursor: 'pointer' }}
                        />
                        <span style={{ minWidth: 30, textAlign: 'right', color: '#bcbab3', fontWeight: 700, fontSize: 11 }}>
                            {Math.round(opacity * 100)}%
                        </span>

                        <Sep />

                        {/* Nudge buttons */}
                        <Label>offset</Label>
                        <Btn onClick={() => nudge(-1, 0)}>←</Btn>
                        <Btn onClick={() => nudge(1, 0)}>→</Btn>
                        <Btn onClick={() => nudge(0, -1)}>↑</Btn>
                        <Btn onClick={() => nudge(0, 1)}>↓</Btn>
                        <span style={{ color: '#666', fontSize: 9 }}>{offset.x},{offset.y}</span>

                        <Sep />

                        <Btn onClick={() => setOffset({ x: 0, y: 0 })}>reset</Btn>
                        <Btn onClick={() => setMinimized(true)}>minimize</Btn>
                        <Btn onClick={() => setVisible(false)} danger>hide</Btn>
                    </>
                )}
            </div>
        </>
    );
};

/* ── Tiny helpers ──────────────────────────────────────────────────────── */
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span style={{ color: '#555', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {children}
    </span>
);

const Sep = () => <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.07)' }} />;

const Btn: React.FC<{ onClick: () => void; children: React.ReactNode; danger?: boolean }> = ({ onClick, children, danger }) => (
    <button
        onClick={onClick}
        style={{
            background: 'transparent',
            border: `1px solid ${danger ? 'rgba(255,42,58,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 3,
            padding: '2px 8px',
            color: danger ? '#FF2A3A' : '#777',
            fontSize: 9,
            fontFamily: 'inherit',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            lineHeight: '14px',
        }}
    >
        {children}
    </button>
);
