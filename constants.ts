import { Friend, NewsItem, MatchHistoryItem, Champion } from './types';

// Mock Assets
export const ASSETS = {
  LOGO: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/LoL_icon.svg/1200px-LoL_icon.svg.png', 
  RP_ICON: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/icon-rp-72.png', 
  BE_ICON: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/icon-be-72.png',
  BACKGROUND_HOME: 'https://images.contentstack.io/v3/assets/blt731acb42bb3d1659/blt569335f606b23a54/64e673a5a8e2686161179672/082823_Briar_Client_Theme_Hub_Banner.jpg',
  PROFILE_ICON: 'https://ddragon.leagueoflegends.com/cdn/14.4.1/img/profileicon/29.png',
};

export const MOCK_FRIENDS: Friend[] = [
  { id: '1', name: 'Hide on bush', status: 'online', statusMessage: 'Lobby', iconId: 1 },
  { id: '2', name: 'T1 Keria', status: 'in-game', statusMessage: 'Ranked Solo (25:12)', iconId: 2 },
  { id: '3', name: 'G2 Caps', status: 'mobile', iconId: 3 },
  { id: '4', name: 'Doublelift', status: 'offline', iconId: 4 },
  { id: '5', name: 'Rekkles', status: 'online', statusMessage: 'Creating Lobby', iconId: 5 },
  { id: '6', name: 'Caedrel', status: 'offline', iconId: 6 },
  { id: '7', name: 'Jankos', status: 'in-game', statusMessage: 'ARAM (12:45)', iconId: 7 },
];

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: '1',
    title: 'Patch 14.5 Notes',
    category: 'GAME UPDATES',
    image: 'https://images.contentstack.io/v3/assets/blt731acb42bb3d1659/blt2a945d82098b6408/64e6740c037b3f172551e590/082823_Briar_Teaser_Banner.jpg',
    description: 'Check out the latest balance changes, skins, and more coming to the Rift.',
  },
  {
    id: '2',
    title: 'New Skinline: Heavenscale',
    category: 'SKINS',
    image: 'https://images.contentstack.io/v3/assets/blt731acb42bb3d1659/bltb94b055d7815d787/65a9956d4f6d3f3f6311e64e/Heavenscale_2024_Key_Art_1920x1080.jpg',
    description: 'Celebrate the Lunar New Year with divine new looks for your favorite champions.',
  },
  {
    id: '3',
    title: 'Dev Update: Arena Mode',
    category: 'DEV',
    image: 'https://images.contentstack.io/v3/assets/blt731acb42bb3d1659/blt6d57311181284a7e/657235555d49114f6534267d/Arena_Augments_Article_Banner.jpg',
    description: 'Insights into the future of the 2v2v2v2 mode and upcoming augment changes.',
  },
];

export const MATCH_HISTORY: MatchHistoryItem[] = [
  { id: '1', champion: 'Ahri', result: 'VICTORY', kda: '12/2/8', mode: 'Ranked Solo', date: '2 hours ago' },
  { id: '2', champion: 'Yasuo', result: 'DEFEAT', kda: '0/10/2', mode: 'Ranked Solo', date: '5 hours ago' },
  { id: '3', champion: 'Lee Sin', result: 'VICTORY', kda: '8/4/12', mode: 'Normal Draft', date: '1 day ago' },
  { id: '4', champion: 'Thresh', result: 'VICTORY', kda: '2/1/24', mode: 'ARAM', date: '2 days ago' },
];

export const CHAMPIONS: Champion[] = [
    { id: '1', name: 'Aatrox', role: ['Fighter'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg' },
    { id: '2', name: 'Ahri', role: ['Mage'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg' },
    { id: '3', name: 'Akali', role: ['Assassin'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Akali_0.jpg' },
    { id: '4', name: 'Ashe', role: ['Marksman'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ashe_0.jpg' },
    { id: '5', name: 'Garen', role: ['Fighter'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Garen_0.jpg' },
    { id: '6', name: 'Jinx', role: ['Marksman'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Jinx_0.jpg' },
    { id: '7', name: 'Lux', role: ['Mage'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Lux_0.jpg' },
    { id: '8', name: 'Thresh', role: ['Support'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Thresh_0.jpg' },
    { id: '9', name: 'Yasuo', role: ['Fighter'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Yasuo_0.jpg' },
    { id: '10', name: 'Zed', role: ['Assassin'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Zed_0.jpg' },
    { id: '11', name: 'Yone', role: ['Assassin'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Yone_0.jpg' },
    { id: '12', name: 'Lee Sin', role: ['Fighter'], image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/LeeSin_0.jpg' },
];