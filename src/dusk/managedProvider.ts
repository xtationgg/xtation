import type { DuskProviderToolDefinition } from './providerAdapter';
import type { DuskProviderRunRequest } from './providerRun';

export interface ManagedDuskProviderRequestInput {
  envelopeText: string;
  tools: DuskProviderToolDefinition[];
  operatorPrompt?: string | null;
}

export interface ManagedDuskProviderSuccess {
  ok: true;
  request: DuskProviderRunRequest;
  provider: {
    label: string;
    model: string;
    responseId: string | null;
  };
  outputText: string | null;
}

export interface ManagedDuskProviderFailure {
  ok: false;
  message: string;
}

export type ManagedDuskProviderResult = ManagedDuskProviderSuccess | ManagedDuskProviderFailure;

export const requestManagedDuskProviderRun = async (
  input: ManagedDuskProviderRequestInput
): Promise<ManagedDuskProviderResult> => {
  if (import.meta.env.DEV && import.meta.env.VITE_MANAGED_DUSK_PROVIDER_LOCAL !== '1') {
    return {
      ok: false,
      message:
        'Managed provider route is not available in normal Vite dev. Deploy XTATION on Vercel, run a server bridge, or set VITE_MANAGED_DUSK_PROVIDER_LOCAL=1 to test locally.',
    };
  }

  try {
    const response = await fetch('/api/dusk/provider/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        message:
          (typeof payload?.message === 'string' && payload.message) ||
          (response.status === 404
            ? 'Managed provider route is not available in this runtime. Deploy XTATION on Vercel or run the server bridge.'
            : 'Managed Dusk provider request failed.'),
      };
    }

    return {
      ok: true,
      request: payload.request,
      provider: {
        label: typeof payload.provider?.label === 'string' ? payload.provider.label : 'Managed OpenAI',
        model: typeof payload.provider?.model === 'string' ? payload.provider.model : 'unknown',
        responseId: typeof payload.provider?.responseId === 'string' ? payload.provider.responseId : null,
      },
      outputText: typeof payload.outputText === 'string' ? payload.outputText : null,
    };
  } catch {
    return {
      ok: false,
      message: 'Managed provider is unreachable in this runtime.',
    };
  }
};
