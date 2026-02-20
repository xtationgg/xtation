export type ChallengeConfig = {
  name: string;
  rules: string;
  timeLimitSec: number;
  mode: 'SOLO' | 'MULTI';
  difficulty?: 'HARD';
  multiType?: 'PVP' | 'COOP';
  server?: string;
  role?: string;
  points?: number;
};
