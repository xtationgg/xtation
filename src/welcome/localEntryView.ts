import { ClientView } from '../../types';
import { resolveXtationLastView } from '../navigation/lastView';

interface LocalEntryAccess {
  canAccessAdmin?: boolean;
  featureVisibility?: {
    lab?: boolean;
    multiplayer?: boolean;
    store?: boolean;
  };
}

export const resolveLocalStationEntryView = (
  lastView: ClientView | null | undefined,
  access?: LocalEntryAccess
) => resolveXtationLastView(lastView, access);
