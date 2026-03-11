import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuestStationHandoff } from '../components/Auth/GuestStationHandoff';
import { ClientView } from '../types';

vi.mock('../src/onboarding/storage', async () => {
  const actual = await vi.importActual<typeof import('../src/onboarding/storage')>('../src/onboarding/storage');
  return {
    ...actual,
    readXtationOnboardingHandoff: vi.fn(() => ({
      questId: 'quest-1',
      title: 'Starter Loop',
      branch: 'Systems',
      track: 'system',
      createdAt: Date.now(),
    })),
  };
});

vi.mock('../src/navigation/lastView', async () => {
  const actual = await vi.importActual<typeof import('../src/navigation/lastView')>('../src/navigation/lastView');
  return {
    ...actual,
    readStoredXtationLastView: vi.fn(() => ClientView.LAB),
  };
});

describe('GuestStationHandoff', () => {
  it('shows explicit continuation destinations and carried local relay context', () => {
    render(
      <GuestStationHandoff
        open
        localSummary={{
          tasks: 6,
          sessions: 4,
          projects: 2,
          selfTreeNodes: 3,
          inventorySlots: 1,
          activeDays: 5,
          latestActivityAt: Date.now(),
        }}
        accountSummary={{
          tasks: 2,
          sessions: 1,
          projects: 1,
          selfTreeNodes: 2,
          inventorySlots: 0,
          activeDays: 2,
          latestActivityAt: Date.now(),
        }}
        accountLabel="operator@example.com"
        accountWorkspace={ClientView.SETTINGS}
        importWorkspace={ClientView.LAB}
        onKeepAccount={vi.fn()}
        onImportLocal={vi.fn()}
        onReturnToLocal={vi.fn()}
      />
    );

    expect(screen.getByText(/Local station found/i)).toBeInTheDocument();
    expect(screen.getByText(/Move the guest station into this account and reopen directly in Lab/i)).toBeInTheDocument();
    expect(screen.getByText(/Starter relay: Starter Loop/i)).toBeInTheDocument();
    expect(screen.getByText(/Account resume/i)).toBeInTheDocument();
    expect(screen.getByText(/Import target/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep Account Station/i)).toBeInTheDocument();
    expect(screen.getByText(/Return To Local Station/i)).toBeInTheDocument();
  });
});
