/**
 * DesignMode — Live visual CSS editor for XTATION.
 *
 * Toggle: Ctrl+Shift+D (or Cmd+Shift+D on Mac)
 *
 * When active:
 *   - Click any element to select it
 *   - Edit CSS properties in the floating panel
 *   - Changes apply live on screen
 *   - "Copy Diff" exports all changes so Claude can apply them permanently
 *
 * All changes are tracked in a diff map and persisted in localStorage
 * so they survive hot reload.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

/* ── Types ─────────────────────────────────────────────────────────────── */
type CSSChange = Record<string, string>; // property → value
type DiffMap = Record<string, CSSChange>; // selector → changes

interface PropDef {
    key: string;
    label: string;
    type: 'px' | 'color' | 'text' | 'select';
    options?: string[];
    min?: number;
    max?: number;
}

const EDITABLE_PROPS: PropDef[] = [
    { key: 'width', label: 'Width', type: 'px', min: 0, max: 2000 },
    { key: 'height', label: 'Height', type: 'px', min: 0, max: 2000 },
    { key: 'padding', label: 'Padding', type: 'text' },
    { key: 'paddingTop', label: 'Pad Top', type: 'px', min: 0, max: 200 },
    { key: 'paddingRight', label: 'Pad Right', type: 'px', min: 0, max: 200 },
    { key: 'paddingBottom', label: 'Pad Bottom', type: 'px', min: 0, max: 200 },
    { key: 'paddingLeft', label: 'Pad Left', type: 'px', min: 0, max: 200 },
    { key: 'margin', label: 'Margin', type: 'text' },
    { key: 'marginTop', label: 'Mrg Top', type: 'px', min: -100, max: 200 },
    { key: 'marginRight', label: 'Mrg Right', type: 'px', min: -100, max: 200 },
    { key: 'marginBottom', label: 'Mrg Bottom', type: 'px', min: -100, max: 200 },
    { key: 'marginLeft', label: 'Mrg Left', type: 'px', min: -100, max: 200 },
    { key: 'gap', label: 'Gap', type: 'px', min: 0, max: 100 },
    { key: 'fontSize', label: 'Font Size', type: 'px', min: 6, max: 72 },
    { key: 'fontWeight', label: 'Weight', type: 'select', options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
    { key: 'letterSpacing', label: 'Tracking', type: 'text' },
    { key: 'lineHeight', label: 'Line H', type: 'text' },
    { key: 'color', label: 'Color', type: 'color' },
    { key: 'backgroundColor', label: 'BG Color', type: 'color' },
    { key: 'borderColor', label: 'Border Color', type: 'color' },
    { key: 'borderWidth', label: 'Border W', type: 'px', min: 0, max: 20 },
    { key: 'borderRadius', label: 'Radius', type: 'px', min: 0, max: 100 },
    { key: 'opacity', label: 'Opacity', type: 'text' },
    { key: 'display', label: 'Display', type: 'select', options: ['flex', 'grid', 'block', 'inline-flex', 'none'] },
    { key: 'flexDirection', label: 'Flex Dir', type: 'select', options: ['row', 'row-reverse', 'column', 'column-reverse'] },
    { key: 'alignItems', label: 'Align', type: 'select', options: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'] },
    { key: 'justifyContent', label: 'Justify', type: 'select', options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] },
    { key: 'overflow', label: 'Overflow', type: 'select', options: ['visible', 'hidden', 'auto', 'scroll'] },
];

const STORAGE_KEY = 'xt-design-mode-diff';

/* ── Helpers ────────────────────────────────────────────────────────────── */
function getBestSelector(el: HTMLElement): string {
    // Try className first (most useful for CSS)
    if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(/\s+/).filter(c => c && !c.startsWith('is-'));
        if (classes.length > 0) return '.' + classes[0];
    }
    if (el.id) return '#' + el.id;
    // Fallback: tag + nth-child
    const parent = el.parentElement;
    if (parent) {
        const idx = Array.from(parent.children).indexOf(el) + 1;
        return `${getBestSelector(parent)} > ${el.tagName.toLowerCase()}:nth-child(${idx})`;
    }
    return el.tagName.toLowerCase();
}

function cssPropToKebab(prop: string): string {
    return prop.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

function parsePx(val: string): number {
    return parseFloat(val) || 0;
}

/* ── Component ──────────────────────────────────────────────────────────── */
export const DesignMode: React.FC = () => {
    const [active, setActive] = useState(false);
    const [selected, setSelected] = useState<HTMLElement | null>(null);
    const [selector, setSelector] = useState('');
    const [computed, setComputed] = useState<Record<string, string>>({});
    const [diff, setDiff] = useState<DiffMap>(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
    });
    const [panelPos, setPanelPos] = useState<'right' | 'left'>('right');
    const [copied, setCopied] = useState(false);
    const [highlight, setHighlight] = useState<DOMRect | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Persist diff
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(diff));
    }, [diff]);

    // Re-apply saved changes on mount
    useEffect(() => {
        Object.entries(diff).forEach(([sel, changes]) => {
            try {
                const el = document.querySelector(sel) as HTMLElement | null;
                if (el) Object.entries(changes).forEach(([prop, val]) => { (el.style as any)[prop] = val; });
            } catch { /* selector might be invalid */ }
        });
    }, [active]);

    // Toggle hotkey: Ctrl+Shift+D
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyD') {
                e.preventDefault();
                setActive(v => {
                    if (v) { setSelected(null); setHighlight(null); }
                    return !v;
                });
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Click handler to select elements
    useEffect(() => {
        if (!active) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Don't select our own panel
            if (overlayRef.current?.contains(target)) return;
            e.preventDefault();
            e.stopPropagation();

            setSelected(target);
            const sel = getBestSelector(target);
            setSelector(sel);
            const cs = window.getComputedStyle(target);
            const vals: Record<string, string> = {};
            EDITABLE_PROPS.forEach(p => { vals[p.key] = cs.getPropertyValue(cssPropToKebab(p.key)) || (cs as any)[p.key] || ''; });
            setComputed(vals);
            setHighlight(target.getBoundingClientRect());
        };
        // Use capture to intercept before normal handlers
        document.addEventListener('click', handler, true);
        return () => document.removeEventListener('click', handler, true);
    }, [active]);

    // Hover highlight
    useEffect(() => {
        if (!active || selected) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (overlayRef.current?.contains(target)) { setHighlight(null); return; }
            setHighlight(target.getBoundingClientRect());
        };
        document.addEventListener('mousemove', handler);
        return () => document.removeEventListener('mousemove', handler);
    }, [active, selected]);

    // Update highlight position on scroll/resize
    useEffect(() => {
        if (!selected) return;
        const update = () => setHighlight(selected.getBoundingClientRect());
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
    }, [selected]);

    // Apply a CSS change
    const applyChange = useCallback((prop: string, value: string) => {
        if (!selected || !selector) return;
        (selected.style as any)[prop] = value;
        setComputed(prev => ({ ...prev, [prop]: value }));
        setDiff(prev => ({
            ...prev,
            [selector]: { ...(prev[selector] || {}), [prop]: value },
        }));
        // Update highlight
        setHighlight(selected.getBoundingClientRect());
    }, [selected, selector]);

    // Generate CSS diff text
    const generateDiff = useCallback((): string => {
        const lines: string[] = ['/* DesignMode CSS Changes */', '/* Apply these to index.css */\n'];
        for (const [sel, changes] of Object.entries(diff)) {
            lines.push(`${sel} {`);
            for (const [prop, val] of Object.entries(changes)) {
                lines.push(`  ${cssPropToKebab(prop)}: ${val};`);
            }
            lines.push('}\n');
        }
        return lines.join('\n');
    }, [diff]);

    const copyDiff = useCallback(async () => {
        const text = generateDiff();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [generateDiff]);

    const clearDiff = useCallback(() => {
        // Remove applied inline styles
        Object.entries(diff).forEach(([sel, changes]) => {
            try {
                const el = document.querySelector(sel) as HTMLElement | null;
                if (el) Object.keys(changes).forEach(prop => { (el.style as any)[prop] = ''; });
            } catch { /* */ }
        });
        setDiff({});
        localStorage.removeItem(STORAGE_KEY);
        setSelected(null);
        setHighlight(null);
    }, [diff]);

    // Badge when inactive
    if (!active) {
        const changeCount = Object.values(diff).reduce((n, c) => n + Object.keys(c).length, 0);
        return (
            <div style={{
                position: 'fixed', bottom: 8, left: 8, zIndex: 99998,
                padding: '5px 12px', borderRadius: 4,
                background: 'rgba(0,0,0,0.75)',
                color: changeCount > 0 ? '#d8ac61' : '#555',
                fontSize: 10, fontFamily: 'monospace', pointerEvents: 'none',
                letterSpacing: '0.06em',
            }}>
                Ctrl+Shift+D → design{changeCount > 0 ? ` (${changeCount} changes)` : ''}
            </div>
        );
    }

    return (
        <>
            {/* ── Selection highlight ──────────────────────────────────── */}
            {highlight && (
                <div style={{
                    position: 'fixed',
                    top: highlight.top - 1,
                    left: highlight.left - 1,
                    width: highlight.width + 2,
                    height: highlight.height + 2,
                    border: selected ? '2px solid #942f76' : '1px dashed rgba(148,47,118,0.5)',
                    borderRadius: 2,
                    pointerEvents: 'none',
                    zIndex: 99995,
                    transition: 'all 80ms ease-out',
                }}>
                    {/* Size label */}
                    <div style={{
                        position: 'absolute', top: -18, left: 0,
                        padding: '1px 6px', borderRadius: 2,
                        background: '#942f76', color: '#fff',
                        fontSize: 9, fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                    }}>
                        {Math.round(highlight.width)}×{Math.round(highlight.height)}
                    </div>
                </div>
            )}

            {/* ── Top bar indicator ────────────────────────────────────── */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: 3,
                background: 'linear-gradient(90deg, #942f76, #d8ac61, #942f76)',
                zIndex: 99999, pointerEvents: 'none',
            }} />

            {/* ── Property Panel ───────────────────────────────────────── */}
            <div
                ref={overlayRef}
                style={{
                    position: 'fixed',
                    top: 40,
                    [panelPos]: 8,
                    width: 260,
                    maxHeight: 'calc(100vh - 60px)',
                    overflowY: 'auto',
                    zIndex: 99998,
                    background: 'rgba(8,8,6,0.96)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6,
                    backdropFilter: 'blur(20px)',
                    fontFamily: 'ui-monospace, "SF Mono", monospace',
                    fontSize: 10,
                    color: '#aaa',
                    userSelect: 'none',
                }}
            >
                {/* Panel header */}
                <div style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <span style={{ color: '#942f76', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em' }}>
                        DESIGN MODE
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <MiniBtn onClick={() => setPanelPos(p => p === 'right' ? 'left' : 'right')}>⇄</MiniBtn>
                        <MiniBtn onClick={() => { setActive(false); setSelected(null); setHighlight(null); }}>✕</MiniBtn>
                    </div>
                </div>

                {/* Selected element info */}
                {selected ? (
                    <>
                        <div style={{
                            padding: '6px 12px',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            color: '#d8ac61', fontSize: 10, wordBreak: 'break-all',
                        }}>
                            {selector}
                            <span style={{ color: '#555', marginLeft: 6 }}>
                                {selected.tagName.toLowerCase()}
                            </span>
                        </div>

                        {/* Deselect button */}
                        <div style={{ padding: '4px 12px' }}>
                            <MiniBtn onClick={() => { setSelected(null); setHighlight(null); }}>
                                Deselect (click another element)
                            </MiniBtn>
                        </div>

                        {/* Properties */}
                        <div style={{ padding: '4px 0' }}>
                            {EDITABLE_PROPS.map(prop => (
                                <PropRow
                                    key={prop.key}
                                    def={prop}
                                    value={computed[prop.key] || ''}
                                    changed={!!diff[selector]?.[prop.key]}
                                    onChange={val => applyChange(prop.key, val)}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <div style={{ padding: '20px 12px', color: '#555', textAlign: 'center' }}>
                        Click any element to select it
                    </div>
                )}

                {/* Actions */}
                <div style={{
                    padding: '8px 12px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', gap: 6, flexWrap: 'wrap',
                }}>
                    <ActionBtn onClick={copyDiff} accent>
                        {copied ? '✓ Copied!' : `Copy Diff (${Object.values(diff).reduce((n, c) => n + Object.keys(c).length, 0)})`}
                    </ActionBtn>
                    <ActionBtn onClick={clearDiff} danger>Clear All</ActionBtn>
                </div>
            </div>
        </>
    );
};

/* ── Sub-components ────────────────────────────────────────────────────── */
const PropRow: React.FC<{
    def: PropDef;
    value: string;
    changed: boolean;
    onChange: (val: string) => void;
}> = ({ def, value, changed, onChange }) => {
    const displayVal = value;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 12px',
            background: changed ? 'rgba(148,47,118,0.08)' : 'transparent',
        }}>
            <span style={{
                width: 64, flexShrink: 0, fontSize: 9,
                color: changed ? '#d8ac61' : '#555',
                textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
                {def.label}
            </span>

            {def.type === 'px' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                    <input
                        type="range"
                        min={def.min ?? 0}
                        max={def.max ?? 100}
                        value={parsePx(displayVal)}
                        onChange={e => onChange(e.target.value + 'px')}
                        style={{ flex: 1, accentColor: '#942f76', height: 12 }}
                    />
                    <input
                        type="text"
                        value={displayVal}
                        onChange={e => onChange(e.target.value)}
                        style={{
                            width: 52, padding: '2px 4px', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 2, background: 'rgba(255,255,255,0.03)', color: '#bcbab3',
                            fontSize: 9, fontFamily: 'inherit', textAlign: 'right', outline: 'none',
                        }}
                    />
                </div>
            )}

            {def.type === 'color' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                    <input
                        type="color"
                        value={rgbToHex(displayVal)}
                        onChange={e => onChange(e.target.value)}
                        style={{ width: 20, height: 16, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                        type="text"
                        value={displayVal}
                        onChange={e => onChange(e.target.value)}
                        style={{
                            flex: 1, padding: '2px 4px', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 2, background: 'rgba(255,255,255,0.03)', color: '#bcbab3',
                            fontSize: 9, fontFamily: 'inherit', outline: 'none',
                        }}
                    />
                </div>
            )}

            {def.type === 'text' && (
                <input
                    type="text"
                    value={displayVal}
                    onChange={e => onChange(e.target.value)}
                    style={{
                        flex: 1, padding: '2px 4px', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 2, background: 'rgba(255,255,255,0.03)', color: '#bcbab3',
                        fontSize: 9, fontFamily: 'inherit', outline: 'none',
                    }}
                />
            )}

            {def.type === 'select' && (
                <select
                    value={displayVal}
                    onChange={e => onChange(e.target.value)}
                    style={{
                        flex: 1, padding: '2px 4px', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 2, background: '#0a0a08', color: '#bcbab3',
                        fontSize: 9, fontFamily: 'inherit', outline: 'none',
                    }}
                >
                    {!def.options?.includes(displayVal) && <option value={displayVal}>{displayVal}</option>}
                    {def.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            )}
        </div>
    );
};

const MiniBtn: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <button onClick={onClick} style={{
        background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 3, padding: '2px 8px', color: '#777', fontSize: 9,
        fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '0.04em',
    }}>
        {children}
    </button>
);

const ActionBtn: React.FC<{ onClick: () => void; children: React.ReactNode; accent?: boolean; danger?: boolean }> = ({ onClick, children, accent, danger }) => (
    <button onClick={onClick} style={{
        flex: 1, padding: '5px 8px', borderRadius: 3,
        border: `1px solid ${accent ? '#942f76' : danger ? 'rgba(255,42,58,0.3)' : 'rgba(255,255,255,0.08)'}`,
        background: accent ? 'rgba(148,47,118,0.15)' : 'transparent',
        color: accent ? '#d4a0c8' : danger ? '#FF2A3A' : '#777',
        fontSize: 9, fontFamily: 'inherit', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
    }}>
        {children}
    </button>
);

/* ── Color util ────────────────────────────────────────────────────────── */
function rgbToHex(rgb: string): string {
    if (rgb.startsWith('#')) return rgb.length > 7 ? rgb.slice(0, 7) : rgb;
    const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!match) return '#000000';
    return '#' + [match[1], match[2], match[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}
