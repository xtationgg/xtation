import { executeAuditedDuskProviderTool, resolveDuskProviderActionId } from './providerAdapter';
import type { DuskToolExecutionResult, DuskToolRuntimeContext } from './toolRuntime';

export interface DuskProviderRunRequestItem {
  name: string;
  reason?: string;
}

export interface DuskProviderRunRequest {
  version: 'xtation.dusk.provider-run.v1';
  requestedAt?: number;
  requestedBy?: string | null;
  stopOnBlocked?: boolean;
  tools: DuskProviderRunRequestItem[];
}

export interface DuskProviderRunResultItem extends DuskToolExecutionResult {
  name: string;
  actionId: string | null;
  reason?: string;
}

export interface DuskProviderRunReport {
  version: 'xtation.dusk.provider-run-report.v1';
  receivedAt: number;
  requestedBy: string | null;
  requestedCount: number;
  executedCount: number;
  succeededCount: number;
  blockedCount: number;
  stoppedEarly: boolean;
  stopOnBlocked: boolean;
  results: DuskProviderRunResultItem[];
}

export interface ParsedDuskProviderRunRequest {
  ok: boolean;
  request?: DuskProviderRunRequest;
  message?: string;
}

const RUN_REQUEST_VERSION = 'xtation.dusk.provider-run.v1';
const RUN_REPORT_VERSION = 'xtation.dusk.provider-run-report.v1';
const MAX_PROVIDER_RUN_TOOLS = 8;

const normalizeToolRequest = (value: unknown): DuskProviderRunRequestItem | null => {
  if (typeof value === 'string') {
    const name = value.trim();
    return name ? { name } : null;
  }
  if (!value || typeof value !== 'object') return null;

  const candidate = value as { name?: unknown; reason?: unknown };
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!name) return null;

  return {
    name,
    reason: typeof candidate.reason === 'string' ? candidate.reason.trim() || undefined : undefined,
  };
};

export const buildDuskProviderRunRequest = (
  toolNames: string[],
  options?: { requestedBy?: string | null; stopOnBlocked?: boolean }
): DuskProviderRunRequest => ({
  version: RUN_REQUEST_VERSION,
  requestedAt: Date.now(),
  requestedBy: options?.requestedBy ?? 'provider-simulator',
  stopOnBlocked: options?.stopOnBlocked ?? true,
  tools: Array.from(new Set(toolNames.map((toolName) => toolName.trim()).filter(Boolean))).map((name) => ({ name })),
});

export const buildDuskProviderRunRequestText = (request: DuskProviderRunRequest) =>
  JSON.stringify(request, null, 2);

export const parseDuskProviderRunRequestText = (raw: string): ParsedDuskProviderRunRequest => {
  const source = raw.trim();
  if (!source) {
    return {
      ok: false,
      message: 'Provider request is empty',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return {
      ok: false,
      message: 'Provider request must be valid JSON',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      message: 'Provider request must be a JSON object',
    };
  }

  const candidate = parsed as {
    version?: unknown;
    requestedAt?: unknown;
    requestedBy?: unknown;
    stopOnBlocked?: unknown;
    tools?: unknown;
  };

  if (candidate.version !== RUN_REQUEST_VERSION) {
    return {
      ok: false,
      message: `Provider request version must be ${RUN_REQUEST_VERSION}`,
    };
  }

  if (!Array.isArray(candidate.tools) || candidate.tools.length === 0) {
    return {
      ok: false,
      message: 'Provider request must include at least one tool',
    };
  }

  if (candidate.tools.length > MAX_PROVIDER_RUN_TOOLS) {
    return {
      ok: false,
      message: `Provider request can include at most ${MAX_PROVIDER_RUN_TOOLS} tools`,
    };
  }

  const tools = candidate.tools
    .map((item) => normalizeToolRequest(item))
    .filter((item): item is DuskProviderRunRequestItem => !!item);

  if (!tools.length) {
    return {
      ok: false,
      message: 'Provider request tools must include valid tool names',
    };
  }

  if (tools.length !== candidate.tools.length) {
    return {
      ok: false,
      message: 'Provider request tools must all be valid tool names or tool objects',
    };
  }

  return {
    ok: true,
    request: {
      version: RUN_REQUEST_VERSION,
      requestedAt: typeof candidate.requestedAt === 'number' ? candidate.requestedAt : undefined,
      requestedBy: typeof candidate.requestedBy === 'string' ? candidate.requestedBy : null,
      stopOnBlocked: typeof candidate.stopOnBlocked === 'boolean' ? candidate.stopOnBlocked : true,
      tools,
    },
  };
};

export const executeDuskProviderRunRequest = (
  request: DuskProviderRunRequest,
  context: DuskToolRuntimeContext,
  userId?: string | null
): DuskProviderRunReport => {
  const results: DuskProviderRunResultItem[] = [];
  const stopOnBlocked = request.stopOnBlocked !== false;
  let stoppedEarly = false;

  request.tools.forEach((tool) => {
    if (stoppedEarly) return;

    const result = executeAuditedDuskProviderTool(tool.name, context, userId);
    results.push({
      name: tool.name,
      actionId: resolveDuskProviderActionId(tool.name),
      reason: tool.reason,
      ...result,
    });

    if (stopOnBlocked && result.status === 'blocked') {
      stoppedEarly = true;
    }
  });

  const succeededCount = results.filter((result) => result.status === 'success').length;
  const blockedCount = results.filter((result) => result.status === 'blocked').length;

  return {
    version: RUN_REPORT_VERSION,
    receivedAt: Date.now(),
    requestedBy: request.requestedBy ?? null,
    requestedCount: request.tools.length,
    executedCount: results.length,
    succeededCount,
    blockedCount,
    stoppedEarly,
    stopOnBlocked,
    results,
  };
};
