import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

// ─── Constants & helpers ────────────────────────────────────────────────────
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function monthIdx(y: number, m: number) { return y * 12 + m; }
function fromIdx(i: number) { return { y: Math.floor(i / 12), m: i % 12 }; }
function buildCells(y: number, m: number): (number | null)[] {
  const first = getFirstDay(y, m), total = getDaysInMonth(y, m);
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);
  return cells;
}

interface Sel { d: number; m: number; y: number; }
interface ViewState { m: number; y: number; }

function parseValue(value: string): { sel: Sel; hour: number; min: number; ampm: 'AM' | 'PM' } | null {
  if (!value) return null;
  const [datePart, timePart] = value.split('T');
  if (!datePart) return null;
  const [y, mo, d] = datePart.split('-').map(Number);
  if (!y || !mo || !d) return null;
  let hour = 12, min = 0;
  let ampm: 'AM' | 'PM' = 'AM';
  if (timePart) {
    const [h, mi] = timePart.split(':').map(Number);
    ampm = h >= 12 ? 'PM' : 'AM';
    hour = h % 12 || 12;
    min = mi || 0;
  }
  return { sel: { d, m: mo - 1, y }, hour, min, ampm };
}

function buildValue(sel: Sel | null, hour: number, min: number, ampm: 'AM' | 'PM'): string {
  if (!sel) return '';
  const h24 = ampm === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${sel.y}-${pad(sel.m + 1)}-${pad(sel.d)}T${pad(h24)}:${pad(min)}`;
}

function formatDisplay(sel: Sel | null, hour: number, min: number, ampm: 'AM' | 'PM'): string {
  if (!sel) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${MONTHS[sel.m].slice(0, 3)} ${sel.d}, ${sel.y}  ·  ${pad(hour)}:${pad(min)} ${ampm}`;
}

// ─── MonthBlock ─────────────────────────────────────────────────────────────
interface MonthBlockProps {
  y: number; m: number;
  sel: Sel | null; now: Date; height: number;
  hovDay: Sel | null; setHovDay: (v: Sel | null) => void;
  pendingDay: Sel | null;
}

function MonthBlock({ y, m, sel, now, height, hovDay, setHovDay, pendingDay }: MonthBlockProps) {
  const cells = buildCells(y, m);
  return (
    <div style={{ height, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '0 0 4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, color: 'var(--app-muted)', padding: '2px 0', letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, flex: 1 }}>
        {cells.map((d, i) => {
          const isToday = d !== null && d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
          const isSel = d !== null && sel !== null && d === sel.d && m === sel.m && y === sel.y;
          const isHov = d !== null && hovDay !== null && hovDay.d === d && hovDay.m === m && hovDay.y === y;
          const isPending = d !== null && pendingDay !== null && pendingDay.d === d && pendingDay.m === m && pendingDay.y === y;
          return (
            <div
              key={i}
              data-day={d ? `${y}-${m}-${d}` : undefined}
              onMouseEnter={() => d && setHovDay({ d, m, y })}
              onMouseLeave={() => setHovDay(null)}
              style={{
                height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11,
                color: isSel ? 'var(--app-bg)' : isToday ? 'var(--app-accent)' : 'var(--app-muted)',
                fontWeight: isSel || isToday ? 600 : 400,
                borderRadius: 6,
                background: isSel
                  ? 'var(--app-accent)'
                  : (isHov || isPending) ? 'color-mix(in srgb, var(--app-text) 8%, transparent)' : 'transparent',
                cursor: d ? 'pointer' : 'default',
                transition: 'background 0.08s',
                position: 'relative',
                userSelect: 'none',
              }}
            >
              {d || ''}
              {isToday && !isSel && (
                <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: 'var(--app-accent)' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DraggableCalendar ───────────────────────────────────────────────────────
interface DraggableCalendarProps {
  view: ViewState; setView: (v: ViewState) => void;
  sel: Sel | null; setSel: (v: Sel) => void;
  now: Date;
}

function DraggableCalendar({ view, setView, sel, setSel, now }: DraggableCalendarProps) {
  const MONTH_H = 200;
  const DRAG_THRESHOLD = 8;
  const [renderOffset, setRenderOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [hovDay, setHovDay] = useState<Sel | null>(null);
  const [pendingDay, setPendingDay] = useState<Sel | null>(null);
  const drag = useRef({ active: false, startY: 0, moved: false, lastOffset: 0, startDay: null as Sel | null });

  const base = monthIdx(view.y, view.m);
  const slots = [-1, 0, 1].map(d => fromIdx(base + d));

  const commit = useCallback((targetOffset: number, newBase: number | null) => {
    setIsSnapping(true);
    setRenderOffset(targetOffset);
    setTimeout(() => {
      if (newBase !== null) setView(fromIdx(newBase));
      setRenderOffset(0);
      setIsSnapping(false);
    }, 360);
  }, [setView]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dy = e.clientY - drag.current.startY;
      if (Math.abs(dy) > DRAG_THRESHOLD) { drag.current.moved = true; setPendingDay(null); }
      if (drag.current.moved) { drag.current.lastOffset = dy; setRenderOffset(dy); }
    };
    const onUp = () => {
      if (!drag.current.active) return;
      const wasMoved = drag.current.moved;
      const startDay = drag.current.startDay;
      drag.current.active = false;
      setPendingDay(null);
      if (!wasMoved && startDay) {
        setSel(startDay);
      } else if (wasMoved) {
        const off = drag.current.lastOffset;
        const T = MONTH_H * 0.28;
        if (off < -T) commit(-MONTH_H, base + 1);
        else if (off > T) commit(MONTH_H, base - 1);
        else commit(0, null);
      } else {
        setRenderOffset(0);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [base, commit, setSel]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (isSnapping) return;
    const dayEl = (e.target as Element).closest('[data-day]');
    let startDay: Sel | null = null;
    if (dayEl) {
      const [y, m, d] = dayEl.getAttribute('data-day')!.split('-').map(Number);
      startDay = { d, m, y };
      setPendingDay(startDay);
    }
    drag.current = { active: true, startY: e.clientY, moved: false, lastOffset: 0, startDay };
  };

  return (
    <div onPointerDown={onPointerDown}
      style={{ height: MONTH_H, overflow: 'hidden', cursor: isSnapping ? 'default' : 'ns-resize', userSelect: 'none', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, background: 'linear-gradient(to bottom, var(--app-panel), transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 22, background: 'linear-gradient(to top, var(--app-panel), transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{
        transform: `translateY(${-MONTH_H + renderOffset}px)`,
        transition: drag.current.moved || isSnapping ? (isSnapping ? 'transform 0.36s cubic-bezier(0.22,1,0.36,1)' : 'none') : 'transform 0.36s cubic-bezier(0.22,1,0.36,1)',
        willChange: 'transform',
      }}>
        {slots.map(({ y, m }) => (
          <MonthBlock key={`${y}-${m}`} y={y} m={m} sel={sel} now={now} height={MONTH_H}
            hovDay={hovDay} setHovDay={setHovDay} pendingDay={pendingDay} />
        ))}
      </div>
    </div>
  );
}

// ─── DrumColumn ──────────────────────────────────────────────────────────────
interface DrumColumnProps {
  values: number[];
  selected: number;
  onSelect: (v: number) => void;
  label: string;
  min: number;
  max: number;
  format?: (v: number) => string;
}

function DrumColumn({ values, selected, onSelect, label, min, max, format = v => String(v).padStart(2, '0') }: DrumColumnProps) {
  const ITEM_H = 36, PAD = 2;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Use ref so window listeners always see latest values without re-attaching
  const dragRef = useRef({ active: false, startY: 0, startScroll: 0, moved: false });
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const editingRef = useRef(editing);
  useEffect(() => { editingRef.current = editing; }, [editing]);

  const scrollTo = useCallback((val: number, smooth = false) => {
    const idx = values.indexOf(val);
    if (scrollRef.current && idx !== -1)
      scrollRef.current.scrollTo({ top: idx * ITEM_H, behavior: smooth ? 'smooth' : 'instant' });
  }, [values]);

  useEffect(() => { if (!editing) scrollTo(selected); }, [selected, editing, scrollTo]);

  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScroll = () => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      if (!scrollRef.current) return;
      const idx = Math.round(scrollRef.current.scrollTop / ITEM_H);
      const v = values[Math.max(0, Math.min(idx, values.length - 1))];
      if (v !== selectedRef.current) onSelect(v);
      scrollRef.current.scrollTo({ top: Math.max(0, Math.min(idx, values.length - 1)) * ITEM_H, behavior: 'smooth' });
    }, 80);
  };

  // Native window listeners — identical pattern to DraggableCalendar so drag
  // works reliably even inside a portal where synthetic pointer capture fails.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dy = dragRef.current.startY - e.clientY;
      if (Math.abs(dy) > 3) dragRef.current.moved = true;
      el.scrollTop = dragRef.current.startScroll + dy;
    };

    const onUp = () => {
      if (!dragRef.current.active) return;
      const wasMoved = dragRef.current.moved;
      dragRef.current.active = false;
      if (!wasMoved) {
        setDraft(String(selectedRef.current).padStart(2, '0'));
        setEditing(true);
        requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []); // Attach once — uses refs for latest state

  const onPointerDown = (e: React.PointerEvent) => {
    if (editingRef.current || !scrollRef.current) return;
    e.preventDefault();
    dragRef.current = { active: true, startY: e.clientY, startScroll: scrollRef.current.scrollTop, moved: false };
  };

  const commitDraft = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n)) onSelect(Math.max(min, Math.min(max, n)));
    setEditing(false);
  };
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitDraft(); }
    if (e.key === 'Escape') setEditing(false);
    if (e.key === 'ArrowUp') { onSelect(selected + 1 > max ? min : selected + 1); e.preventDefault(); }
    if (e.key === 'ArrowDown') { onSelect(selected - 1 < min ? max : selected - 1); e.preventDefault(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 4px' }}>
      <div style={{ fontSize: 9, color: 'var(--app-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</div>
      <div style={{ position: 'relative', width: 44, height: ITEM_H * (PAD * 2 + 1), overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * PAD, background: 'linear-gradient(to bottom, var(--app-panel) 30%, transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * PAD, background: 'linear-gradient(to top, var(--app-panel) 30%, transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: ITEM_H * PAD, left: 3, right: 3, height: ITEM_H, borderRadius: 8, background: 'color-mix(in srgb, var(--app-text) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-text) 12%, transparent)', zIndex: 0, pointerEvents: 'none' }} />
        {editing && (
          <div style={{ position: 'absolute', top: ITEM_H * PAD, left: 3, right: 3, height: ITEM_H, borderRadius: 8, background: 'color-mix(in srgb, var(--app-text) 5%, transparent)', border: '1.5px solid color-mix(in srgb, var(--app-accent) 60%, transparent)', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commitDraft} onKeyDown={handleKey}
              style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: 15, fontWeight: 600, color: 'var(--app-text)', outline: 'none', padding: 0 }}
              maxLength={2} />
          </div>
        )}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          style={{ position: 'relative', zIndex: 1, height: '100%', overflowY: 'scroll', scrollbarWidth: 'none', paddingTop: ITEM_H * PAD, paddingBottom: ITEM_H * PAD, userSelect: 'none', touchAction: 'none', cursor: 'ns-resize' }}
        >
          {values.map(v => (
            <div key={v} style={{ height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: v === selected ? 15 : 12, fontWeight: v === selected ? 600 : 400, color: v === selected ? 'var(--app-text)' : 'var(--app-muted)', userSelect: 'none', transition: 'color 0.1s, font-size 0.1s' }}>
              {format(v)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Public component ────────────────────────────────────────────────────────
interface DateTimePickerProps {
  value: string; // "YYYY-MM-DDTHH:mm" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({ value, onChange, placeholder = 'Set schedule...', className }: DateTimePickerProps) {
  const now = new Date();
  const parsed = parseValue(value);

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Sel | null>(parsed?.sel ?? null);
  const [view, setView] = useState<ViewState>(
    parsed?.sel ? { m: parsed.sel.m, y: parsed.sel.y } : { m: now.getMonth(), y: now.getFullYear() }
  );
  const [hour, setHour] = useState(parsed?.hour ?? (now.getHours() % 12 || 12));
  const [min, setMin] = useState(parsed?.min ?? now.getMinutes());
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed?.ampm ?? (now.getHours() < 12 ? 'AM' : 'PM'));

  // dropStyle: initial position computed before render
  // dropReady: false = invisible (opacity 0) while we measure & clamp
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const [dropReady, setDropReady] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const emittingRef = useRef(false);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  // Compute an initial position estimate from trigger's viewport rect.
  // useLayoutEffect will clamp to actual rendered bounds afterward.
  const computeInitialStyle = useCallback((): React.CSSProperties => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    // Align left edge with trigger, but keep at least 8px from each side
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 220 && rect.top > spaceBelow) {
      // Not enough room below — anchor bottom of dropdown to above trigger
      return { bottom: window.innerHeight - rect.top + 6, left };
    }
    return { top: rect.bottom + 6, left };
  }, []);

  // After the portal renders, measure actual size and clamp to viewport.
  // Runs sync before paint so there's no visual jump.
  useLayoutEffect(() => {
    if (!open || dropReady || !dropdownRef.current || !triggerRef.current) return;
    const drop = dropdownRef.current.getBoundingClientRect();
    const trigger = triggerRef.current.getBoundingClientRect();
    const updates: React.CSSProperties = {};

    // Clamp right overflow
    if (drop.right > window.innerWidth - 8) {
      updates.left = Math.max(8, window.innerWidth - drop.width - 8);
    }
    // Clamp left overflow (shouldn't happen but be safe)
    if (drop.left < 8) {
      updates.left = 8;
    }
    // Clamp bottom overflow: flip to above if possible
    if (drop.bottom > window.innerHeight - 8) {
      const aboveTop = trigger.top - drop.height - 6;
      if (aboveTop >= 8) {
        updates.top = aboveTop;
        updates.bottom = undefined;
      } else {
        // Not enough room above either — pin to visible area
        updates.top = Math.max(8, window.innerHeight - drop.height - 8);
        updates.bottom = undefined;
      }
    }

    if (Object.keys(updates).length > 0) {
      setDropStyle(prev => ({ ...prev, ...updates }));
    }
    setDropReady(true);
  }, [open, dropReady]);

  // Re-initialize internal state when picker opens
  useEffect(() => {
    if (!open) return;
    const p = parseValue(value);
    if (p) {
      setSel(p.sel);
      setView({ m: p.sel.m, y: p.sel.y });
      setHour(p.hour);
      setMin(p.min);
      setAmpm(p.ampm);
    } else {
      setSel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Emit on interaction
  const emit = (newSel: Sel | null, newHour: number, newMin: number, newAmpm: 'AM' | 'PM') => {
    emittingRef.current = true;
    onChange(buildValue(newSel, newHour, newMin, newAmpm));
    requestAnimationFrame(() => { emittingRef.current = false; });
  };

  const handleSel = (s: Sel) => { setSel(s); emit(s, hour, min, ampm); };
  const handleHour = (h: number) => { setHour(h); emit(sel, h, min, ampm); };
  const handleMin = (m: number) => { setMin(m); emit(sel, hour, m, ampm); };
  const handleAmpm = (p: 'AM' | 'PM') => { setAmpm(p); emit(sel, hour, min, p); };

  const handleClear = () => { setSel(null); onChange(''); };
  const goToday = () => {
    const s = { d: now.getDate(), m: now.getMonth(), y: now.getFullYear() };
    setSel(s); setView({ m: s.m, y: s.y }); emit(s, hour, min, ampm);
  };
  const goNow = () => {
    const h = now.getHours() % 12 || 12, mi = now.getMinutes(), ap: 'AM' | 'PM' = now.getHours() < 12 ? 'AM' : 'PM';
    setHour(h); setMin(mi); setAmpm(ap); emit(sel, h, mi, ap);
  };

  const prevMonth = () => setView(v => v.m === 0 ? { m: 11, y: v.y - 1 } : { ...v, m: v.m - 1 });
  const nextMonth = () => setView(v => v.m === 11 ? { m: 0, y: v.y + 1 } : { ...v, m: v.m + 1 });

  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    setDropStyle(computeInitialStyle());
    setDropReady(false);
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Reposition on scroll/resize (no opacity animation — picker is already visible)
  useEffect(() => {
    if (!open) return;
    const update = () => {
      setDropStyle(computeInitialStyle());
      // Allow useLayoutEffect to re-clamp on next render
      setDropReady(false);
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, computeInitialStyle]);

  const display = formatDisplay(sel, hour, min, ampm);

  const footBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 10, color: 'var(--app-muted)', fontFamily: 'inherit',
    fontWeight: 500, letterSpacing: '0.06em', padding: '2px 4px',
    textTransform: 'uppercase', transition: 'color 0.12s', borderRadius: 4,
  };

  const dropdownPanel = open && (
    <div
      ref={dropdownRef}
      data-portal-ignore-outside-click="true"
      style={{
        position: 'fixed',
        ...dropStyle,
        zIndex: 99999,
        background: 'var(--app-panel)',
        borderRadius: 14,
        border: '1px solid color-mix(in srgb, var(--app-text) 10%, transparent)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px color-mix(in srgb, var(--app-text) 5%, transparent)',
        overflow: 'hidden',
        display: 'inline-flex',
        // Hidden until useLayoutEffect clamps position — prevents flash at wrong position
        opacity: dropReady ? 1 : 0,
        transition: dropReady ? 'opacity 0.12s ease' : 'none',
        pointerEvents: dropReady ? 'auto' : 'none',
      }}
    >
      {/* Calendar column */}
      <div style={{ padding: '16px 14px 10px', width: 240 }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--app-text)', letterSpacing: '0.02em' }}>
            {MONTHS[view.m]}{' '}
            <span style={{ color: 'var(--app-muted)', fontWeight: 400 }}>{view.y}</span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {[
              { onClick: prevMonth, d: 'M7.5 2L4 6l3.5 4' },
              { onClick: nextMonth, d: 'M4.5 2L8 6l-3.5 4' },
            ].map(({ onClick, d }, idx) => (
              <button key={idx} type="button" onClick={onClick}
                style={{ background: 'none', border: 'none', cursor: 'pointer', width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--app-muted)', padding: 0, transition: 'background 0.1s, color 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--app-text) 8%, transparent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--app-text)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--app-muted)'; }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
              </button>
            ))}
          </div>
        </div>

        <DraggableCalendar view={view} setView={setView} sel={sel} setSel={handleSel} now={now} />

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid color-mix(in srgb, var(--app-text) 7%, transparent)' }}>
          <button type="button" onClick={handleClear} style={footBtnStyle}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--app-text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--app-muted)')}
          >Clear</button>
          <button type="button" onClick={goToday} style={footBtnStyle}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--app-accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--app-muted)')}
          >Today</button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, background: 'color-mix(in srgb, var(--app-text) 7%, transparent)', alignSelf: 'stretch' }} />

      {/* Time column */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
        <DrumColumn values={hours} selected={hour} onSelect={handleHour} label="HR" min={1} max={12} />
        <div style={{ fontSize: 18, color: 'color-mix(in srgb, var(--app-text) 18%, transparent)', fontWeight: 300, marginTop: 8, padding: '0 1px' }}>:</div>
        <DrumColumn values={minutes} selected={min} onSelect={handleMin} label="MIN" min={0} max={59} />

        {/* AM/PM + Now */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, paddingLeft: 10, marginLeft: 4, borderLeft: '1px solid color-mix(in srgb, var(--app-text) 7%, transparent)', alignSelf: 'stretch' }}>
          {(['AM', 'PM'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => handleAmpm(p)}
              style={{
                background: ampm === p ? 'var(--app-accent)' : 'none',
                border: `1.5px solid ${ampm === p ? 'var(--app-accent)' : 'color-mix(in srgb, var(--app-text) 14%, transparent)'}`,
                borderRadius: 7,
                color: ampm === p ? 'var(--app-bg)' : 'var(--app-muted)',
                fontSize: 10, fontWeight: 600, width: 38, height: 28,
                cursor: 'pointer', letterSpacing: '0.06em', transition: 'all 0.15s',
              }}
            >{p}</button>
          ))}
          <div style={{ width: '100%', height: 1, background: 'color-mix(in srgb, var(--app-text) 7%, transparent)' }} />
          <button type="button" onClick={goNow} style={footBtnStyle}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--app-accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--app-muted)')}
          >Now</button>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }} className={className}>
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`w-full bg-[var(--app-panel-2)] border text-[9px] text-left p-2 outline-none uppercase transition-colors ${
          open
            ? 'border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)]'
            : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] hover:border-[color-mix(in_srgb,var(--app-text)_25%,transparent)]'
        }`}
        style={{ color: display ? 'var(--app-text)' : undefined }}
      >
        {display || <span style={{ color: 'var(--app-muted)' }}>{placeholder}</span>}
      </button>

      {/* ── Dropdown portal — renders at document.body, escapes all overflow/stacking contexts ── */}
      {typeof document !== 'undefined' && createPortal(dropdownPanel, document.body)}
    </div>
  );
}
