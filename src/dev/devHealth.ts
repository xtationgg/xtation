import { XPLedgerState } from '../../components/XP/xpTypes';
import { XPSelectors } from '../../components/XP/xpStore';

export interface Issue {
  id: string;
  severity: 'warn' | 'error';
  message: string;
  entityIds?: string[];
}

export interface DevLedgerForHealth extends XPLedgerState {
  dateKey?: string;
  reportedTodayXP?: number;
  reportedTodayTargetXP?: number;
}

const getDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const recomputeTodayXP = (ledger: XPLedgerState, dateKey: string) => {
  return XPSelectors.getTodayXP(ledger, dateKey);
};

export const runLedgerHealthChecks = (ledger: DevLedgerForHealth): { ok: boolean; issues: Issue[] } => {
  const issues: Issue[] = [];

  const running = ledger.sessions.filter((session) => session.status === 'running');
  if (running.length > 1) {
    issues.push({
      id: 'multiple-running-sessions',
      severity: 'error',
      message: `Found ${running.length} running sessions; expected at most one.`,
      entityIds: running.map((session) => session.id),
    });
  }

  const taskIdSet = new Set(ledger.tasks.map((task) => task.id));
  const sessionIdSet = new Set(ledger.sessions.map((session) => session.id));

  ledger.sessions.forEach((session) => {
    const brokenTaskRefs = (session.linkedTaskIds || []).filter((taskId) => !taskIdSet.has(taskId));
    if (!brokenTaskRefs.length) return;
    issues.push({
      id: `session-broken-task-links-${session.id}`,
      severity: 'error',
      message: `Session ${session.id} references missing tasks.`,
      entityIds: brokenTaskRefs,
    });
  });

  ledger.tasks.forEach((task) => {
    const brokenSessionRefs = (task.linkedSessionIds || []).filter((sessionId) => !sessionIdSet.has(sessionId));
    if (!brokenSessionRefs.length) return;
    issues.push({
      id: `task-broken-session-links-${task.id}`,
      severity: 'error',
      message: `Task ${task.id} references missing sessions.`,
      entityIds: brokenSessionRefs,
    });
  });

  ledger.sessions.forEach((session) => {
    if ((session.durationMs ?? 0) < 0) {
      issues.push({
        id: `negative-duration-${session.id}`,
        severity: 'error',
        message: `Session ${session.id} has negative durationMs.`,
        entityIds: [session.id],
      });
    }
    if ((session.accumulatedMs ?? 0) < 0) {
      issues.push({
        id: `negative-accumulated-${session.id}`,
        severity: 'error',
        message: `Session ${session.id} has negative accumulatedMs.`,
        entityIds: [session.id],
      });
    }
  });

  const dateKey = ledger.dateKey || getDateKey();
  const recomputedTodayXP = recomputeTodayXP(ledger, dateKey);
  if (typeof ledger.reportedTodayXP === 'number' && ledger.reportedTodayXP !== recomputedTodayXP) {
    issues.push({
      id: 'today-xp-drift',
      severity: 'error',
      message: `Today XP drift detected: reported ${ledger.reportedTodayXP}, recomputed ${recomputedTodayXP}.`,
    });
  }

  if (typeof ledger.reportedTodayTargetXP === 'number') {
    const targetFromDayConfig = ledger.dayConfigs[dateKey]?.targetXP;
    if (typeof targetFromDayConfig === 'number' && targetFromDayConfig !== ledger.reportedTodayTargetXP) {
      issues.push({
        id: 'today-target-drift',
        severity: 'warn',
        message: `Today target mismatch: reported ${ledger.reportedTodayTargetXP}, dayConfig ${targetFromDayConfig}.`,
      });
    }
  }

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
};
