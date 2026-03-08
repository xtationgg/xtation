import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useXP } from './xpStore';
import type { XPSession } from './xpTypes';

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT_PX = 64;
const HOURS_IN_DAY = 24;
const GRID_PAD = 20;
const TOTAL_GRID_PX = HOURS_IN_DAY * HOUR_HEIGHT_PX + GRID_PAD * 2; // 1576px

// Converts an hour index to its absolute top position inside the padded grid.
const hourTop = (h: number) => GRID_PAD + h * HOUR_HEIGHT_PX;

const NOW_SCROLL_OFFSET_H = 2;
const EMPTY_SCROLL_HOUR = 7;
const MIN_BLOCK_PX = 18; // minimum block height so every session is visible

// ─── Date helpers ─────────────────────────────────────────────────────────────

const parseKey = (dateKey: string): Date => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const offsetDay = (dateKey: string, delta: number): string => {
  const base = parseKey(dateKey);
  return toDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta));
};

const formatWeekday = (dateKey: string): string =>
  parseKey(dateKey).toLocaleDateString(undefined, { weekday: 'long' });

const formatShortDate = (dateKey: string): string =>
  parseKey(dateKey).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const formatHourLabel = (hour: number): string => {
  if (hour === 0) return '12AM';
  if (hour < 12) return `${hour}AM`;
  if (hour === 12) return '12PM';
  return `${hour - 12}PM`;
};

const formatDuration = (ms: number): string => {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const formatTimeLabel = (ts: number): string => {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
};

// ─── Session layout ───────────────────────────────────────────────────────────

interface SessionBlock {
  session: XPSession;
  topPx: number;
  heightPx: number;
  col: number;
  totalCols: number;
}

function buildSessionBlocks(
  sessions: XPSession[],
  selectedKey: string,
  now: number,
  getDisplayMs: (s: XPSession, n: number) => number,
): SessionBlock[] {
  // Midnight (ms) of the selected calendar day — used to clamp all positions.
  const dayStartMs = parseKey(selectedKey).getTime();
  const dayEndMs = dayStartMs + 86_400_000;

  const sorted = [...sessions].sort((a, b) => a.startAt - b.startAt);

  const blocks: SessionBlock[] = sorted.map((s) => {
    const sessionEndMs = s.startAt + getDisplayMs(s, now);

    // Clamp to this calendar day so cross-midnight sessions render correctly.
    const effectiveStart = Math.max(s.startAt, dayStartMs);
    const effectiveEnd = Math.min(sessionEndMs, dayEndMs);
    const overlapMs = Math.max(0, effectiveEnd - effectiveStart);

    // Position from midnight of the selected day (in hours).
    const offsetHours = (effectiveStart - dayStartMs) / 3_600_000;
    const topPx = GRID_PAD + offsetHours * HOUR_HEIGHT_PX;
    const heightPx = Math.max(MIN_BLOCK_PX, (overlapMs / 3_600_000) * HOUR_HEIGHT_PX);
    return { session: s, topPx, heightPx, col: 0, totalCols: 1 };
  });

  // Greedy column assignment — each session lands in the first free column.
  const colEndPx: number[] = [];
  blocks.forEach((b) => {
    let col = colEndPx.findIndex((end) => end <= b.topPx);
    if (col === -1) col = colEndPx.length;
    colEndPx[col] = b.topPx + b.heightPx;
    b.col = col;
  });

  // Determine totalCols per block = max col among all overlapping blocks + 1.
  blocks.forEach((a) => {
    const aEnd = a.topPx + a.heightPx;
    let maxCol = a.col;
    blocks.forEach((b) => {
      if (a === b) return;
      const bEnd = b.topPx + b.heightPx;
      if (a.topPx < bEnd && aEnd > b.topPx) maxCol = Math.max(maxCol, b.col);
    });
    a.totalCols = maxCol + 1;
  });

  return blocks;
}

// ─── Block style ──────────────────────────────────────────────────────────────

const IMPACT_BG: Record<string, number> = { normal: 18, medium: 26, hard: 36 };
const IMPACT_BORDER: Record<string, number> = { normal: 32, medium: 46, hard: 62 };

function blockColors(session: XPSession): React.CSSProperties {
  const isRunning = session.status === 'running';
  const bgPct = isRunning ? 28 : (IMPACT_BG[session.impactRating] ?? 18);
  const borderPct = isRunning ? 72 : (IMPACT_BORDER[session.impactRating] ?? 32);
  return {
    background: `color-mix(in srgb, var(--app-accent) ${bgPct}%, var(--app-bg))`,
    border: `1px solid color-mix(in srgb, var(--app-accent) ${borderPct}%, transparent)`,
  };
}

// ─── DayTimeline ─────────────────────────────────────────────────────────────

export const DayTimeline: React.FC = () => {
  const { selectors, tasks, dateKey: todayKey } = useXP();
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const scrolledKeyRef = useRef<string>('');
  const isToday = selectedKey === todayKey;

  // ── Activity data ─────────────────────────────────────────────────────────────

  const daySessions: XPSession[] = selectors.getTodaySessions(selectedKey);

  const dayScheduled = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.scheduledAt &&
          !t.completedAt &&
          toDateKey(new Date(t.scheduledAt)) === selectedKey,
      ),
    [tasks, selectedKey],
  );

  const isEmpty = daySessions.length === 0 && dayScheduled.length === 0;

  // ── Clock tick ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // ── Smart initial scroll ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!scrollRef.current) return;
    if (scrolledKeyRef.current === selectedKey) return;
    scrolledKeyRef.current = selectedKey;

    let target: number;
    if (isToday) {
      const h = new Date().getHours();
      target = Math.max(0, hourTop(h - NOW_SCROLL_OFFSET_H));
    } else if (!isEmpty) {
      const activityHours: number[] = [
        ...daySessions.map((s) => new Date(s.startAt).getHours()),
        ...dayScheduled
          .filter((t) => !!t.scheduledAt)
          .map((t) => new Date(t.scheduledAt!).getHours()),
      ];
      const earliest = activityHours.length ? Math.min(...activityHours) : EMPTY_SCROLL_HOUR;
      target = Math.max(0, hourTop(earliest - 1));
    } else {
      target = hourTop(EMPTY_SCROLL_HOUR);
    }

    scrollRef.current.scrollTop = target;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, isEmpty, daySessions, dayScheduled]);

  // ── NOW cursor position ───────────────────────────────────────────────────────

  const cursorTopPx = useMemo<number | null>(() => {
    if (!isToday) return null;
    const d = new Date(now);
    return GRID_PAD + ((d.getHours() * 60 + d.getMinutes()) / 60) * HOUR_HEIGHT_PX;
  }, [now, isToday]);

  // ── Session blocks layout ─────────────────────────────────────────────────────

  const sessionBlocks = useMemo(
    () => buildSessionBlocks(daySessions, selectedKey, now, selectors.getSessionDisplayMs),
    [daySessions, selectedKey, now, selectors],
  );

  // ── Grid hours array ──────────────────────────────────────────────────────────

  const hours = Array.from({ length: HOURS_IN_DAY }, (_, i) => i);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[var(--app-panel)]">

      {/* ── Day header ── */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[var(--app-border)] shrink-0">

        <button
          type="button"
          onClick={() => setSelectedKey(offsetDay(selectedKey, -1))}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--app-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-panel-2)] transition-colors shrink-0"
          aria-label="Previous day"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex flex-col items-center min-w-0">
          <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-[var(--app-muted)] leading-none mb-0.5">
            {formatWeekday(selectedKey)}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-bold text-[var(--app-text)] leading-tight tracking-tight">
              {formatShortDate(selectedKey)}
            </span>
            {isToday && (
              <span className="shrink-0 px-1.5 py-[3px] rounded text-[8px] font-bold uppercase tracking-[0.16em] bg-[color-mix(in_srgb,var(--app-accent)_15%,var(--app-panel))] text-[var(--app-accent)] border border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)]">
                Today
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSelectedKey(offsetDay(selectedKey, 1))}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--app-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-panel-2)] transition-colors shrink-0"
          aria-label="Next day"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Scrollable 24h time grid ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto xt-scroll">
        <div className="relative flex" style={{ height: TOTAL_GRID_PX }}>

          {/* Hour label rail */}
          <div className="shrink-0 w-14 relative select-none pointer-events-none bg-[var(--app-panel)]">
            {hours.map((h) => {
              const isNoon = h === 12;
              return (
                <div
                  key={h}
                  className={`absolute right-3 leading-none ${
                    isNoon
                      ? 'text-[10px] font-semibold text-[var(--app-text)]'
                      : h < 6
                        ? 'text-[10px] text-[var(--app-muted)] opacity-40'
                        : 'text-[10px] text-[var(--app-muted)]'
                  }`}
                  style={{ top: hourTop(h) - 6 }}
                >
                  {formatHourLabel(h)}
                </div>
              );
            })}
            {/* End-of-day midnight label */}
            <div
              className="absolute right-3 leading-none text-[10px] text-[var(--app-muted)]"
              style={{ top: hourTop(HOURS_IN_DAY) - 6 }}
            >
              12AM
            </div>
          </div>

          {/* Divider */}
          <div className="w-px shrink-0 bg-[var(--app-border)]" />

          {/* Grid track */}
          <div className="flex-1 relative bg-[var(--app-bg)]">

            {/* Full-hour lines */}
            {hours.map((h) => {
              const isNoon = h === 12;
              const isEarlyMorning = h > 0 && h < 6;
              return (
                <div
                  key={h}
                  className={`absolute inset-x-0 border-t ${
                    isNoon
                      ? 'border-[color-mix(in_srgb,var(--app-border)_90%,transparent)]'
                      : isEarlyMorning
                        ? 'border-[color-mix(in_srgb,var(--app-border)_30%,transparent)]'
                        : 'border-[color-mix(in_srgb,var(--app-border)_65%,transparent)]'
                  }`}
                  style={{ top: hourTop(h) }}
                />
              );
            })}

            {/* Closing line at end of day */}
            <div
              className="absolute inset-x-0 border-t border-[color-mix(in_srgb,var(--app-border)_65%,transparent)]"
              style={{ top: hourTop(HOURS_IN_DAY) }}
            />

            {/* Half-hour lines */}
            {hours.map((h) => (
              <div
                key={`${h}h`}
                className="absolute inset-x-0 border-t border-dashed border-[color-mix(in_srgb,var(--app-border)_35%,transparent)]"
                style={{ top: hourTop(h) + HOUR_HEIGHT_PX / 2 }}
              />
            ))}

            {/* ── Session blocks ── */}
            {sessionBlocks.map(({ session, topPx, heightPx, col, totalCols }) => {
              const colWidthPct = 100 / totalCols;
              const isRunning = session.status === 'running';
              const displayMs = selectors.getSessionDisplayMs(session, now);
              const showTitle = heightPx >= 30;
              const showMeta = heightPx >= 52;
              // Use day-clamped end so tooltip shows the correct time for cross-midnight sessions.
              const dayStartMs = parseKey(selectedKey).getTime();
              const endTs = Math.min(session.startAt + displayMs, dayStartMs + 86_400_000);
              const effectiveStartTs = Math.max(session.startAt, dayStartMs);

              return (
                <div
                  key={session.id}
                  className="absolute overflow-hidden"
                  style={{
                    top: topPx,
                    height: heightPx,
                    left: `calc(${col * colWidthPct}% + 2px)`,
                    width: `calc(${colWidthPct}% - 4px)`,
                    borderRadius: 4,
                    ...blockColors(session),
                  }}
                  title={`${session.title || 'Session'} · ${formatTimeLabel(effectiveStartTs)}–${formatTimeLabel(endTs)} · ${formatDuration(displayMs)}`}
                >
                  {/* Left accent bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{
                      background: `color-mix(in srgb, var(--app-accent) ${isRunning ? 90 : 55}%, transparent)`,
                      borderRadius: '4px 0 0 4px',
                    }}
                  />

                  {showTitle && (
                    <div className="pl-[7px] pr-1.5 pt-[3px] flex flex-col min-h-0">
                      <span
                        className="text-[9px] font-semibold leading-tight truncate"
                        style={{ color: `color-mix(in srgb, var(--app-accent) 90%, var(--app-text))` }}
                      >
                        {session.title || 'Session'}
                      </span>
                      {showMeta && (
                        <span
                          className="text-[8px] leading-tight mt-[2px] truncate"
                          style={{ color: `color-mix(in srgb, var(--app-accent) 65%, var(--app-text))` }}
                        >
                          {formatTimeLabel(effectiveStartTs)}–{formatTimeLabel(endTs)} · {formatDuration(displayMs)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Running pulse dot */}
                  {isRunning && (
                    <div
                      className="absolute bottom-[5px] right-[5px] w-[5px] h-[5px] rounded-full bg-[var(--app-accent)]"
                      style={{ boxShadow: '0 0 5px 1px color-mix(in srgb, var(--app-accent) 70%, transparent)' }}
                    />
                  )}
                </div>
              );
            })}

            {/* NOW cursor */}
            {cursorTopPx !== null && (
              <div
                ref={cursorRef}
                className="absolute inset-x-0 z-20 flex items-center pointer-events-none"
                style={{ top: cursorTopPx }}
              >
                <div
                  className="h-[9px] w-[9px] rounded-full bg-[var(--app-accent)] shrink-0 -ml-[5px]"
                  style={{ boxShadow: '0 0 8px 1px color-mix(in_srgb,var(--app-accent)_55%,transparent)' }}
                />
                <div className="flex-1 bg-[var(--app-accent)]" style={{ height: '1.5px' }} />
                <span className="shrink-0 ml-2 mr-3 px-1.5 py-[3px] rounded text-[8px] font-bold uppercase tracking-[0.18em] text-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-bg))] border border-[color-mix(in_srgb,var(--app-accent)_28%,transparent)]">
                  now
                </span>
              </div>
            )}

            {/* Empty state */}
            {isEmpty && cursorTopPx !== null && (
              <div
                className="absolute inset-x-0 flex justify-center pointer-events-none"
                style={{ top: cursorTopPx + 28 }}
              >
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)] opacity-60">
                  {isToday ? 'No activity yet today' : 'No activity on this day'}
                </p>
              </div>
            )}

            {isEmpty && cursorTopPx === null && (
              <div
                className="absolute inset-x-0 flex justify-center pointer-events-none"
                style={{ top: hourTop(EMPTY_SCROLL_HOUR) + 28 }}
              >
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)] opacity-60">
                  No activity on this day
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
