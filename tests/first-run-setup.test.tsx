import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FirstRunSetup } from '../components/Onboarding/FirstRunSetup';

vi.mock('../components/XP/xpStore', () => ({
  useXP: () => ({
    addSelfTreeNode: vi.fn(),
    addTask: vi.fn(() => 'quest-1'),
    selfTreeNodes: [],
  }),
}));

vi.mock('../utils/SoundEffects', () => ({
  playClickSound: vi.fn(),
  playHoverSound: vi.fn(),
}));

describe('FirstRunSetup', () => {
  it('defaults to the visible first branch path', () => {
    render(
      <FirstRunSetup
        open
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('Example: French / AI Research / Economics')).toBeInTheDocument();
    expect(screen.getByText('Primary branch')).toBeInTheDocument();
    expect(screen.getAllByText('Knowledge').length).toBeGreaterThan(0);
  });
});
