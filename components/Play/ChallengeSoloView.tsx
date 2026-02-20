import React from 'react';
import { SoloTask, TaskPriority, TaskRuleType } from './challengeWidgetTypes';

interface ChallengeSoloViewProps {
  tasks: SoloTask[];
  suggestions: SoloTask[];
  activeTaskId: string | null;
  showSuggestions: boolean;
  onSelectTask: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<SoloTask>, list: 'tasks' | 'suggestions') => void;
  onAddTask: () => void;
  onStart: () => void;
  onClose: () => void;
  onToggleSuggestions: () => void;
  canStart: boolean;
}

const priorityOptions: TaskPriority[] = ['Normal', 'High', 'Urgent'];
const ruleOptions: TaskRuleType[] = ['countdown', 'anytime', 'scheduled'];

const RuleFields: React.FC<{
  task: SoloTask;
  onChange: (patch: Partial<SoloTask>) => void;
}> = ({ task, onChange }) => {
  if (task.ruleType === 'countdown') {
    return (
      <input
        type="number"
        min={1}
        value={task.countdownMin ?? 15}
        onChange={(e) => onChange({ countdownMin: Number(e.target.value) })}
        className="w-full bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
        placeholder="Minutes"
      />
    );
  }
  if (task.ruleType === 'scheduled') {
    return (
      <input
        type="datetime-local"
        value={task.scheduledAt || ''}
        onChange={(e) => onChange({ scheduledAt: e.target.value })}
        className="w-full bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
      />
    );
  }
  return <div className="text-[10px] text-[#8b847a]">Anytime</div>;
};

const TaskRow: React.FC<{
  task: SoloTask;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<SoloTask>) => void;
}> = ({ task, selected, onSelect, onChange }) => {
  return (
    <div className={`rounded-xl border ${selected ? 'border-[#f46a2e]/60 bg-[#221912]' : 'border-white/10 bg-[#141418]'} p-3 space-y-2`}>
      <div className="flex items-center gap-2">
        <input type="radio" checked={selected} onChange={onSelect} />
        <input
          value={task.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="flex-1 bg-transparent text-[12px] uppercase tracking-[0.2em] text-white outline-none"
          placeholder="Task title"
        />
      </div>
      <textarea
        value={task.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        className="w-full bg-[#111114] border border-white/10 rounded px-2 py-2 text-[11px] text-white"
        placeholder="Notes"
      />
      <div className="grid grid-cols-3 gap-2">
        <select
          value={task.priority}
          onChange={(e) => onChange({ priority: e.target.value as TaskPriority })}
          className="bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
        >
          {priorityOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <select
          value={task.ruleType}
          onChange={(e) => onChange({ ruleType: e.target.value as TaskRuleType })}
          className="bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
        >
          {ruleOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <RuleFields task={task} onChange={onChange} />
      </div>
    </div>
  );
};

export const ChallengeSoloView: React.FC<ChallengeSoloViewProps> = ({
  tasks,
  suggestions,
  activeTaskId,
  showSuggestions,
  onSelectTask,
  onUpdateTask,
  onAddTask,
  onStart,
  onClose,
  onToggleSuggestions,
  canStart,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-[0.35em] text-white">Solo</div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg border border-white/10 text-[#f3f0e8]"
        >
          X
        </button>
      </div>

      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#8b847a]">Today from my todo</div>
        {!tasks.length && <div className="text-[10px] text-[#8b847a]">No tasks yet. Add one below.</div>}
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            selected={task.id === activeTaskId}
            onSelect={() => onSelectTask(task.id)}
            onChange={(patch) => onUpdateTask(task.id, patch, 'tasks')}
          />
        ))}
        <button
          type="button"
          onClick={onAddTask}
          className="w-full rounded-xl border border-white/10 text-[11px] uppercase tracking-[0.25em] text-[#f3f0e8] py-2"
        >
          Add task
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#8b847a]">AI suggestions</div>
          <button
            type="button"
            onClick={onToggleSuggestions}
            className="px-2 py-1 rounded border border-white/10 text-[10px] uppercase tracking-[0.25em] text-[#f3f0e8]"
          >
            {showSuggestions ? 'Hide' : 'Show'}
          </button>
        </div>
        {showSuggestions && (
          <>
            <div className="text-[9px] text-[#6f6a63]">Suggestions are generated from your profile/context later.</div>
            {suggestions.length === 0 && (
              <div className="text-[10px] text-[#8b847a]">No suggestions yet.</div>
            )}
            {suggestions.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={task.id === activeTaskId}
                onSelect={() => onSelectTask(task.id)}
                onChange={(patch) => onUpdateTask(task.id, patch, 'suggestions')}
              />
            ))}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={!canStart}
        className="w-full rounded-xl border border-[#f46a2e]/50 bg-[#2a1a12] py-3 text-[12px] uppercase tracking-[0.28em] text-white disabled:opacity-40"
      >
        Start challenge
      </button>
    </div>
  );
};
