import { extractDuskProviderRunRequestFromOpenAIResponse, buildOpenAIDuskBridgeRequestBody } from '../../../src/dusk/openaiBridge';

const json = (res: any, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const parseBody = (body: unknown) => {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (body && typeof body === 'object') return body;
  return null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, message: 'Method not allowed' });
  }

  const apiKey = process.env.XTATION_DUSK_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 503, {
      ok: false,
      message: 'Managed OpenAI bridge is not configured. Set XTATION_DUSK_OPENAI_API_KEY on the server.',
    });
  }

  const body = parseBody(req.body);
  if (!body) {
    return json(res, 400, { ok: false, message: 'Invalid JSON body' });
  }

  const envelopeText = typeof body.envelopeText === 'string' ? body.envelopeText.trim() : '';
  const tools = Array.isArray(body.tools) ? body.tools : [];
  const operatorPrompt = typeof body.operatorPrompt === 'string' ? body.operatorPrompt : null;

  if (!envelopeText) {
    return json(res, 400, { ok: false, message: 'Envelope text is required' });
  }
  if (!tools.length) {
    return json(res, 400, { ok: false, message: 'At least one XTATION tool is required' });
  }

  const model = process.env.XTATION_DUSK_OPENAI_MODEL || 'gpt-5';
  const baseUrl = process.env.XTATION_DUSK_OPENAI_BASE_URL || 'https://api.openai.com/v1/responses';
  const project = process.env.OPENAI_PROJECT || process.env.XTATION_DUSK_OPENAI_PROJECT || '';

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(project ? { 'OpenAI-Project': project } : {}),
    },
    body: JSON.stringify(
      buildOpenAIDuskBridgeRequestBody(
        {
          envelopeText,
          tools,
          operatorPrompt,
        },
        {
          model,
          operatorPrompt,
        }
      )
    ),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return json(res, response.status, {
      ok: false,
      message:
        (typeof payload?.error?.message === 'string' && payload.error.message) ||
        `OpenAI bridge request failed with ${response.status}`,
    });
  }

  const suggestion = extractDuskProviderRunRequestFromOpenAIResponse(payload, model);
  if (!('request' in suggestion)) {
    return json(res, 422, {
      ok: false,
      message: suggestion.message,
    });
  }

  return json(res, 200, {
    ok: true,
    request: suggestion.request,
    provider: {
      label: 'Managed OpenAI',
      model: suggestion.model,
      responseId: suggestion.responseId,
    },
    outputText: suggestion.outputText,
  });
}
