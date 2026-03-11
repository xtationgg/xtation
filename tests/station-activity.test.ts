import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendStationActivity,
  clearStationActivity,
  readStationActivity,
} from '../src/station/stationActivity';

describe('stationActivity', () => {
  beforeEach(() => {
    clearStationActivity();
    clearStationActivity('user-1');
    clearStationActivity('user-2');
  });

  it('stores guest station activity in local scope', () => {
    appendStationActivity({
      title: 'Returned to local station',
      detail: 'Offline workspace reopened.',
      workspaceLabel: 'Lab',
      chips: ['Account unchanged'],
    });

    expect(readStationActivity()).toMatchObject([
      {
        title: 'Returned to local station',
        detail: 'Offline workspace reopened.',
        workspaceLabel: 'Lab',
        chips: ['Account unchanged'],
      },
    ]);
  });

  it('stores account station activity per user scope', () => {
    appendStationActivity(
      {
        title: 'Account station active',
        detail: 'Cloud state resumed.',
        workspaceLabel: 'Play',
      },
      'user-1'
    );

    expect(readStationActivity('user-1')).toMatchObject([
      {
        title: 'Account station active',
        detail: 'Cloud state resumed.',
        workspaceLabel: 'Play',
      },
    ]);
    expect(readStationActivity('user-2')).toEqual([]);
    expect(readStationActivity()).toEqual([]);
  });
});
