import { Player } from '../types';

export const defaultPlayers: Player[] = [
  {
    id: 'me',
    name: 'Admin',
    role: 'Operator',
    email: 'admin@dusk.gg',
    permissions: {
      profileLevel: 'details',
      location: 'live',
      pinVisibility: 'specific',
      rankVisibility: true,
      appearsInRank: true,
      closeCircle: true,
    },
    accepted: true,
  },
  {
    id: 'p1',
    name: 'Nova',
    role: 'Recon',
    permissions: {
      profileLevel: 'basic',
      location: 'city',
      pinVisibility: 'close',
      rankVisibility: true,
      appearsInRank: true,
      closeCircle: true,
    },
    accepted: true,
  },
  {
    id: 'p2',
    name: 'Echo',
    role: 'Support',
    permissions: {
      profileLevel: 'details',
      location: 'off',
      pinVisibility: 'specific',
      rankVisibility: true,
      appearsInRank: true,
      closeCircle: false,
    },
    accepted: false,
  },
];
