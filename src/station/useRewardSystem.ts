/**
 * useRewardSystem — manages XP-based reward configs, level triggers, and active reward overlay.
 *
 * Extracted from App.tsx to reduce monolith size.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RewardConfig } from '../../types';

const defaultRewardConfigs: RewardConfig[] = [
  { level: 1, threshold: 100, animation: 'CYBER_PULSE', sound: 'LEVEL_UP' },
  { level: 2, threshold: 250, animation: 'GOLDEN_HEX', sound: 'CHIME' },
  { level: 3, threshold: 500, animation: 'GLITCH_STORM', sound: 'TECH_POWER' },
  { level: 4, threshold: 1000, animation: 'ORBITAL_STRIKE', sound: 'ALARM' },
  { level: 5, threshold: 2000, animation: 'NEON_BURST', sound: 'BASS_DROP' },
];

export function useRewardSystem(totalXP: number) {
  const [rewardConfigs, setRewardConfigs] = useState<RewardConfig[]>(defaultRewardConfigs);
  const [triggeredLevels, setTriggeredLevels] = useState<number[]>([]);
  const [activeReward, setActiveReward] = useState<RewardConfig | null>(null);
  const [activeRewardDuration, setActiveRewardDuration] = useState<number>(4000);
  const rewardStartRef = useRef<number>(0);
  const rewardDismissTimer = useRef<number | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const updateRewardConfig = useCallback((newConfig: RewardConfig) => {
    setRewardConfigs((prev) => prev.map((c) => c.level === newConfig.level ? newConfig : c));
  }, []);

  // Auto-dismiss timer for active reward overlay
  useEffect(() => {
    if (!activeReward) {
      if (rewardDismissTimer.current) {
        clearTimeout(rewardDismissTimer.current);
        rewardDismissTimer.current = null;
      }
      return;
    }

    rewardStartRef.current = Date.now();
    rewardDismissTimer.current = window.setTimeout(() => {
      setActiveReward(null);
      rewardDismissTimer.current = null;
    }, activeRewardDuration);

    return () => {
      if (rewardDismissTimer.current) {
        clearTimeout(rewardDismissTimer.current);
        rewardDismissTimer.current = null;
      }
    };
  }, [activeReward, activeRewardDuration]);

  // Monitor XP for Rewards — matches original App.tsx logic exactly
  useEffect(() => {
    // Initial Load: Don't trigger animations for already achieved levels
    if (!hasInitialized) {
      const alreadyReached = rewardConfigs
        .filter((c) => totalXP >= c.threshold)
        .map((c) => c.level);
      setTriggeredLevels(alreadyReached);
      setHasInitialized(true);
      return;
    }

    // RESET LOGIC: Check if we dropped below any previously achieved thresholds
    const stillAchievedLevels = triggeredLevels.filter((level) => {
      const config = rewardConfigs.find((c) => c.level === level);
      return config && totalXP >= config.threshold;
    });

    if (stillAchievedLevels.length !== triggeredLevels.length) {
      setTriggeredLevels(stillAchievedLevels);
      return;
    }

    // TRIGGER LOGIC: Check for new achievements
    rewardConfigs.forEach((config) => {
      if (totalXP >= config.threshold && !triggeredLevels.includes(config.level)) {
        setTriggeredLevels((prev) => [...prev, config.level]);
        setActiveReward(config);
        setActiveRewardDuration(4000);
        rewardStartRef.current = Date.now();
      }
    });
  }, [totalXP, rewardConfigs, triggeredLevels, hasInitialized]);

  const resetForUser = useCallback(() => {
    setTriggeredLevels([]);
    setHasInitialized(false);
    setActiveReward(null);
  }, []);

  return {
    rewardConfigs,
    setRewardConfigs,
    defaultRewardConfigs,
    activeReward,
    activeRewardDuration,
    setActiveReward,
    setActiveRewardDuration,
    updateRewardConfig,
    rewardDismissTimer,
    resetForUser,
  };
}
