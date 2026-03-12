import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultXtationOnboardingState,
  readXtationOnboardingHandoff,
  readXtationOnboardingState,
} from '../src/onboarding/storage';
import { clearUserScopedKey, writeUserScopedString } from '../src/lib/userScopedStorage';

const USER_ID = 'user-1';
const ONBOARDING_KEY = 'xtation_onboarding_v1';
const HANDOFF_KEY = 'xtation_onboarding_handoff_v1';

describe('onboarding storage normalization', () => {
  beforeEach(() => {
    clearUserScopedKey(ONBOARDING_KEY, USER_ID);
    clearUserScopedKey(HANDOFF_KEY, USER_ID);
  });

  it('returns default onboarding state when signed-in storage is malformed', () => {
    writeUserScopedString(
      ONBOARDING_KEY,
      JSON.stringify({ status: 'unknown', updatedAt: 'bad-value' }),
      USER_ID
    );

    expect(readXtationOnboardingState(USER_ID)).toEqual(defaultXtationOnboardingState);
  });

  it('returns sanitized onboarding state when signed-in storage is valid', () => {
    writeUserScopedString(
      ONBOARDING_KEY,
      JSON.stringify({ status: 'completed', updatedAt: 12345, extra: 'ignored' }),
      USER_ID
    );

    expect(readXtationOnboardingState(USER_ID)).toEqual({
      status: 'completed',
      updatedAt: 12345,
    });
  });

  it('returns null handoff when signed-in handoff payload is malformed', () => {
    writeUserScopedString(
      HANDOFF_KEY,
      JSON.stringify({
        questId: 'quest-1',
        title: '',
        branch: 'Knowledge',
        track: 'mission',
        createdAt: 111,
      }),
      USER_ID
    );

    expect(readXtationOnboardingHandoff(USER_ID)).toBeNull();
  });

  it('returns sanitized handoff when signed-in handoff payload is valid', () => {
    writeUserScopedString(
      HANDOFF_KEY,
      JSON.stringify({
        questId: 'quest-1',
        title: 'Launch first loop',
        branch: 'Systems',
        track: 'mission',
        nodeTitle: 'Planning',
        createdAt: 222,
        dismissedAt: 333,
      }),
      USER_ID
    );

    expect(readXtationOnboardingHandoff(USER_ID)).toEqual({
      questId: 'quest-1',
      title: 'Launch first loop',
      branch: 'Systems',
      track: 'mission',
      nodeTitle: 'Planning',
      createdAt: 222,
      dismissedAt: 333,
    });
  });
});
