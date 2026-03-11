import type { DuskActionDeckItem, DuskActionId } from './actionDeck';
import { appendDuskToolAuditEntry } from './toolAudit';
import { executeDuskTool, type DuskToolExecutionResult, type DuskToolRuntimeContext } from './toolRuntime';

export interface DuskProviderToolDefinition {
  name: string;
  actionId: DuskActionId;
  title: string;
  description: string;
}

const TOOL_NAME_BY_ACTION: Record<DuskActionId, string> = {
  'open-primary-quest': 'xtation_open_primary_quest',
  'queue-lead-project-quest': 'xtation_queue_lead_project_quest',
  'capture-station-note': 'xtation_capture_station_note',
  'open-brief-quest': 'xtation_open_brief_quest',
  'create-brief-quest': 'xtation_create_brief_quest',
  'save-brief-note': 'xtation_save_brief_note',
};

const ACTION_BY_TOOL_NAME = Object.fromEntries(
  Object.entries(TOOL_NAME_BY_ACTION).map(([actionId, name]) => [name, actionId as DuskActionId])
) as Record<string, DuskActionId>;

export const resolveDuskProviderActionId = (toolName: string): DuskActionId | null => ACTION_BY_TOOL_NAME[toolName] || null;

export const getDuskProviderTools = (deck: DuskActionDeckItem[]): DuskProviderToolDefinition[] =>
  deck.map((item) => ({
    name: TOOL_NAME_BY_ACTION[item.id],
    actionId: item.id,
    title: item.title,
    description: item.description,
  }));

export const executeDuskProviderTool = (
  toolName: string,
  context: DuskToolRuntimeContext
): DuskToolExecutionResult => {
  const actionId = resolveDuskProviderActionId(toolName);
  if (!actionId) {
    return {
      status: 'blocked',
      message: `Unknown Dusk provider tool: ${toolName}`,
    };
  }
  return executeDuskTool(actionId, context);
};

export const executeAuditedDuskProviderTool = (
  toolName: string,
  context: DuskToolRuntimeContext,
  userId?: string | null
): DuskToolExecutionResult => {
  const result = executeDuskProviderTool(toolName, context);
  const actionId = resolveDuskProviderActionId(toolName);
  if (actionId) {
    appendDuskToolAuditEntry(actionId, 'provider', result, userId);
  }
  return result;
};
