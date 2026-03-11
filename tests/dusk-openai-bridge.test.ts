import { describe, expect, it } from 'vitest';
import {
  buildOpenAIDuskBridgeRequestBody,
  extractDuskProviderRunRequestFromOpenAIResponse,
} from '../src/dusk/openaiBridge';

const tools = [
  {
    name: 'xtation_open_primary_quest',
    actionId: 'open-primary-quest' as const,
    title: 'Open Priority Quest',
    description: 'Open the current priority quest in XTATION.',
  },
  {
    name: 'xtation_capture_station_note',
    actionId: 'capture-station-note' as const,
    title: 'Capture Station Note',
    description: 'Save the station state to Lab.',
  },
];

describe('dusk openai bridge', () => {
  it('builds a responses request with registered XTATION function tools', () => {
    const body = buildOpenAIDuskBridgeRequestBody(
      {
        envelopeText: '{ "version": "xtation.dusk.provider.v1" }',
        tools,
      },
      {
        model: 'gpt-5',
      }
    );

    expect(body.model).toBe('gpt-5');
    expect(body.tools).toHaveLength(2);
    expect(body.tools[0]).toMatchObject({
      type: 'function',
      name: 'xtation_open_primary_quest',
    });
    expect(body.tool_choice).toMatchObject({
      type: 'allowed_tools',
      mode: 'auto',
    });
  });

  it('extracts a provider run request from function calls', () => {
    const result = extractDuskProviderRunRequestFromOpenAIResponse(
      {
        id: 'resp_123',
        model: 'gpt-5',
        output: [
          {
            type: 'function_call',
            name: 'xtation_open_primary_quest',
            arguments: JSON.stringify({ reason: 'A priority quest already exists and should be reopened first.' }),
          },
          {
            type: 'function_call',
            name: 'xtation_capture_station_note',
            arguments: JSON.stringify({ reason: 'Save the current context before switching tracks.' }),
          },
        ],
      },
      'gpt-5'
    );

    expect('request' in result).toBe(true);
    if ('request' in result) {
      expect(result.request.requestedBy).toBe('openai:gpt-5');
      expect(result.request.tools).toEqual([
        {
          name: 'xtation_open_primary_quest',
          reason: 'A priority quest already exists and should be reopened first.',
        },
        {
          name: 'xtation_capture_station_note',
          reason: 'Save the current context before switching tracks.',
        },
      ]);
    }
  });

  it('returns a failure when no function calls are present', () => {
    const result = extractDuskProviderRunRequestFromOpenAIResponse(
      {
        id: 'resp_456',
        model: 'gpt-5',
        output_text: 'No direct tool action is justified yet.',
        output: [],
      },
      'gpt-5'
    );

    expect(result).toEqual({
      message: 'No direct tool action is justified yet.',
    });
  });
});
