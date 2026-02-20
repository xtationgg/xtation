import React from 'react';
import { ExploreChallenge, ExploreFilters } from './challengeWidgetTypes';

interface ChallengeExploreViewProps {
  filters: ExploreFilters;
  onChange: (patch: Partial<ExploreFilters>) => void;
  results: ExploreChallenge[];
  onJoin: (challenge: ExploreChallenge) => void;
  onClose: () => void;
}

export const ChallengeExploreView: React.FC<ChallengeExploreViewProps> = ({
  filters,
  onChange,
  results,
  onJoin,
  onClose,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-[0.35em] text-white">Explore</div>
        <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg border border-white/10 text-[#f3f0e8]">
          X
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={filters.scope}
          onChange={(e) => onChange({ scope: e.target.value as ExploreFilters['scope'] })}
          className="bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
        >
          <option value="public">Public</option>
          <option value="friends">Friends</option>
        </select>
        <select
          value={filters.country}
          onChange={(e) => onChange({ country: e.target.value })}
          className="bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
        >
          <option value="">Any country</option>
          <option value="US">United States</option>
          <option value="UK">United Kingdom</option>
          <option value="FR">France</option>
          <option value="JP">Japan</option>
        </select>
        <select
          value={filters.ruleType}
          onChange={(e) => onChange({ ruleType: e.target.value as ExploreFilters['ruleType'] })}
          className="bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
        >
          <option value="all">All rule types</option>
          <option value="countdown">Countdown</option>
          <option value="period">Period</option>
          <option value="static">Static</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <button
          type="button"
          onClick={() => onChange({ nearMe: !filters.nearMe })}
          className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.25em] ${
            filters.nearMe ? 'border-[#f46a2e]/60 text-white' : 'border-white/10 text-[#8b847a]'
          }`}
        >
          {filters.nearMe ? 'Near me ✓' : 'Near me'}
        </button>
      </div>

      <div className="space-y-2">
        {results.map((challenge) => (
          <div key={challenge.id} className="rounded-xl border border-white/10 bg-[#141418] p-3">
            <div className="text-[11px] uppercase tracking-[0.25em] text-white">{challenge.name}</div>
            <div className="text-[10px] text-[#8b847a]">By {challenge.creator}</div>
            <div className="text-[10px] text-[#8b847a]">{challenge.ruleSummary}</div>
            <div className="text-[9px] text-[#6f6a63]">{challenge.country}</div>
            <button
              type="button"
              onClick={() => onJoin(challenge)}
              className="mt-2 w-full rounded border border-white/15 py-1 text-[10px] uppercase tracking-[0.25em] text-[#f3f0e8]"
            >
              Join
            </button>
          </div>
        ))}
        {!results.length && <div className="text-[10px] text-[#8b847a]">No matches.</div>}
      </div>
    </div>
  );
};
