import { Player, LocationShareState, Pin } from '../types';

export interface EffectivePermissions {
  profileLevel: 'basic' | 'details';
  locationMode: LocationShareState['mode'];
  pinVisibility: 'none' | 'close' | 'specific';
  rankVisible: boolean;
  appearsInRank: boolean;
  closeCircle: boolean;
}

export const getEffectivePermissions = (viewer?: Player | null): EffectivePermissions => {
  if (!viewer) {
    return {
      profileLevel: 'basic',
      locationMode: 'off',
      pinVisibility: 'none',
      rankVisible: false,
      appearsInRank: false,
      closeCircle: false,
    };
  }
  return {
    profileLevel: viewer.permissions?.profileLevel ?? 'basic',
    locationMode: viewer.permissions?.location ?? 'off',
    pinVisibility: viewer.permissions?.pinVisibility ?? 'none',
    rankVisible: !!viewer.permissions?.rankVisibility,
    appearsInRank: !!viewer.permissions?.appearsInRank,
    closeCircle: !!viewer.permissions?.closeCircle,
  };
};

export const pinVisibleToViewer = (pin: Pin, viewerId: string, viewer: Player | undefined, pinOwnerId: string) => {
  const perms = getEffectivePermissions(viewer);
  if (!viewer) return false;
  if (pin.scope === 'private') return pinOwnerId === viewerId;
  if (pin.scope === 'close') return perms.closeCircle;
  if (pin.scope === 'specific') return pin.sharedWith?.includes(viewerId);
  return perms.pinVisibility !== 'none';
};
