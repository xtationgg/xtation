export interface QuestStepState {
  text: string;
  done: boolean;
}

export const QUEST_STEPS_BLOCK_REGEX = /\n?---\s*\n\[xstation_steps_v1\]\s*\n([\s\S]*?)\n---\s*$/;

export const stripQuestStepsBlock = (details?: string): string =>
  details ? details.replace(QUEST_STEPS_BLOCK_REGEX, '').trim() : '';

export const parseQuestNotesAndSteps = (raw?: string): { notes: string; steps: QuestStepState[] } => {
  if (!raw) {
    return { notes: '', steps: [] };
  }

  const match = raw.match(QUEST_STEPS_BLOCK_REGEX);
  if (!match?.[1]) {
    return { notes: raw.trimEnd(), steps: [] };
  }

  const notes = raw.replace(QUEST_STEPS_BLOCK_REGEX, '').trimEnd();

  try {
    const parsed = JSON.parse(match[1].trim());
    const steps = Array.isArray(parsed?.steps)
      ? parsed.steps
          .map((step: unknown) => {
            const next = step as { text?: unknown; done?: unknown };
            const text = typeof next?.text === 'string' ? next.text.trim() : '';
            if (!text) return null;
            return {
              text,
              done: !!next?.done,
            } satisfies QuestStepState;
          })
          .filter(Boolean) as QuestStepState[]
      : [];

    return { notes, steps };
  } catch {
    return { notes, steps: [] };
  }
};

export const encodeQuestNotesWithSteps = (notes: string, steps: QuestStepState[]): string => {
  const trimmedNotes = notes.trimEnd();
  const normalizedSteps = steps
    .map((step) => ({ text: step.text.trim(), done: step.done }))
    .filter((step) => step.text.length > 0);

  if (!normalizedSteps.length) {
    return trimmedNotes;
  }

  const block = `---\n[xstation_steps_v1]\n${JSON.stringify({ steps: normalizedSteps }, null, 2)}\n---`;
  return trimmedNotes ? `${trimmedNotes}\n\n${block}` : block;
};

export const getQuestStepCounts = (details?: string): { total: number; done: number } | null => {
  const { steps } = parseQuestNotesAndSteps(details);
  if (!steps.length) return null;
  return {
    total: steps.length,
    done: steps.filter((step) => step.done).length,
  };
};
