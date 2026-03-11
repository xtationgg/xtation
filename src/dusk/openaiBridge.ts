import type { DuskProviderToolDefinition } from './providerAdapter';
import type { DuskProviderRunRequest, DuskProviderRunRequestItem } from './providerRun';

export interface OpenAIDuskBridgeConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  project?: string;
  operatorPrompt?: string | null;
}

export interface OpenAIDuskBridgeRequestInput {
  envelopeText: string;
  tools: DuskProviderToolDefinition[];
  operatorPrompt?: string | null;
}

export interface OpenAIDuskBridgeSuggestion {
  request: DuskProviderRunRequest;
  responseId: string | null;
  model: string;
  outputText: string | null;
}

export interface OpenAIDuskBridgeFailure {
  message: string;
}

type OpenAIToolCall = {
  type?: string;
  name?: string;
  arguments?: string;
};

const OPENAI_RESPONSES_DEFAULT_URL = 'https://api.openai.com/v1/responses';

const buildSystemPrompt = () =>
  [
    'You are the managed Dusk provider bridge for XTATION.',
    'Review the XTATION station envelope and choose the smallest set of XTATION tools that moves the station forward.',
    'Prefer one concrete action over multiple speculative actions.',
    'Do not invent tool names or parameters.',
    'If no tool is appropriate, return no tool calls.',
    'When you call a tool, include a short "reason" argument explaining why the action should happen now.',
  ].join(' ');

const buildUserPrompt = (input: OpenAIDuskBridgeRequestInput) =>
  [
    input.operatorPrompt?.trim() || 'Review the current XTATION envelope and choose the next tool actions.',
    'Use only the registered XTATION tools below.',
    'Envelope:',
    input.envelopeText,
  ].join('\n\n');

export const buildOpenAIDuskBridgeRequestBody = (
  input: OpenAIDuskBridgeRequestInput,
  config: Pick<OpenAIDuskBridgeConfig, 'model'> & { operatorPrompt?: string | null }
) => ({
  model: config.model,
  input: [
    {
      role: 'system',
      content: [{ type: 'input_text', text: buildSystemPrompt() }],
    },
    {
      role: 'user',
      content: [{ type: 'input_text', text: buildUserPrompt({ ...input, operatorPrompt: config.operatorPrompt ?? input.operatorPrompt }) }],
    },
  ],
  tools: input.tools.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        reason: {
          type: 'string',
          description: 'Short operator-facing reason for choosing this XTATION tool now.',
        },
      },
      required: [],
    },
  })),
  tool_choice: {
    type: 'allowed_tools',
    mode: 'auto',
    tools: input.tools.map((tool) => ({
      type: 'function',
      name: tool.name,
    })),
  },
});

const parseToolReason = (rawArguments: unknown): string | undefined => {
  if (typeof rawArguments !== 'string' || !rawArguments.trim()) return undefined;

  try {
    const parsed = JSON.parse(rawArguments) as { reason?: unknown };
    return typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : undefined;
  } catch {
    return undefined;
  }
};

export const extractDuskProviderRunRequestFromOpenAIResponse = (
  payload: unknown,
  modelFallback: string
): OpenAIDuskBridgeSuggestion | OpenAIDuskBridgeFailure => {
  const candidate = payload as {
    id?: unknown;
    model?: unknown;
    output_text?: unknown;
    output?: unknown;
  };
  const output = Array.isArray(candidate?.output) ? (candidate.output as OpenAIToolCall[]) : [];
  const toolCalls = output.filter(
    (item): item is OpenAIToolCall & { type: 'function_call'; name: string } =>
      item?.type === 'function_call' && typeof item.name === 'string' && item.name.trim().length > 0
  );

  if (!toolCalls.length) {
    return {
      message:
        (typeof candidate?.output_text === 'string' && candidate.output_text.trim()) ||
        'Managed provider did not suggest a XTATION tool action.',
    };
  }

  const tools: DuskProviderRunRequestItem[] = toolCalls.slice(0, 3).map((toolCall) => ({
    name: toolCall.name,
    reason: parseToolReason(toolCall.arguments),
  }));

  return {
    request: {
      version: 'xtation.dusk.provider-run.v1',
      requestedAt: Date.now(),
      requestedBy: `openai:${typeof candidate?.model === 'string' ? candidate.model : modelFallback}`,
      stopOnBlocked: true,
      tools,
    },
    responseId: typeof candidate?.id === 'string' ? candidate.id : null,
    model: typeof candidate?.model === 'string' ? candidate.model : modelFallback,
    outputText: typeof candidate?.output_text === 'string' ? candidate.output_text : null,
  };
};

export const requestOpenAIDuskProviderSuggestion = async (
  input: OpenAIDuskBridgeRequestInput,
  config: OpenAIDuskBridgeConfig
): Promise<OpenAIDuskBridgeSuggestion | OpenAIDuskBridgeFailure> => {
  const response = await fetch(config.baseUrl || OPENAI_RESPONSES_DEFAULT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.project ? { 'OpenAI-Project': config.project } : {}),
    },
    body: JSON.stringify(
      buildOpenAIDuskBridgeRequestBody(input, {
        model: config.model,
        operatorPrompt: config.operatorPrompt,
      })
    ),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const apiMessage =
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : `OpenAI bridge request failed with ${response.status}`;
    return { message: apiMessage };
  }

  return extractDuskProviderRunRequestFromOpenAIResponse(payload, config.model);
};
