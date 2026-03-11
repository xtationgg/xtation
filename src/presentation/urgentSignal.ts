import type { Task } from '../../components/XP/xpTypes';

export type UrgentPresentationReason = 'urgent_priority' | 'overdue_schedule' | 'urgent_overdue';

export interface UrgentPresentationSignal {
  taskId: string;
  title: string;
  priority: Task['priority'];
  reason: UrgentPresentationReason;
  scheduledAt?: number;
  latenessMinutes: number;
  signalKey: string;
}

const isOpenTask = (task: Task) => task.status !== 'done' && task.status !== 'dropped' && !task.completedAt;

export const resolveUrgentPresentationSignal = (
  tasks: Task[],
  now: number
): UrgentPresentationSignal | null => {
  const candidates = tasks
    .filter(isOpenTask)
    .map((task) => {
      const hasSchedule = typeof task.scheduledAt === 'number';
      const isOverdue = hasSchedule && (task.scheduledAt as number) <= now;
      const hasUrgentPriority = task.priority === 'urgent';
      if (!isOverdue && !hasUrgentPriority) return null;

      const latenessMinutes = hasSchedule
        ? Math.max(0, Math.round((now - (task.scheduledAt as number)) / 60000))
        : 0;

      const reason: UrgentPresentationReason = isOverdue
        ? hasUrgentPriority
          ? 'urgent_overdue'
          : 'overdue_schedule'
        : 'urgent_priority';

      return {
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        reason,
        scheduledAt: task.scheduledAt,
        latenessMinutes,
        updatedAt: task.updatedAt || task.createdAt,
        reasonScore: reason === 'urgent_overdue' ? 0 : reason === 'overdue_schedule' ? 1 : 2,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const a = left!;
      const b = right!;
      if (a.reasonScore !== b.reasonScore) return a.reasonScore - b.reasonScore;
      if (a.latenessMinutes !== b.latenessMinutes) return b.latenessMinutes - a.latenessMinutes;
      return b.updatedAt - a.updatedAt;
    });

  const lead = candidates[0];
  if (!lead) return null;

  const bucketMinutes = lead.reason === 'urgent_priority' ? 30 : 10;
  const bucket = Math.floor(now / (bucketMinutes * 60000));
  return {
    taskId: lead.taskId,
    title: lead.title,
    priority: lead.priority,
    reason: lead.reason,
    scheduledAt: lead.scheduledAt,
    latenessMinutes: lead.latenessMinutes,
    signalKey: `${lead.taskId}:${lead.reason}:${bucket}`,
  };
};
