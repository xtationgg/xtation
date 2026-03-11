import { ClientView } from '../../types';
import { readUserScopedString, writeUserScopedString } from '../lib/userScopedStorage';

const LAST_VIEW_STORAGE_KEY = 'xtation_last_view_v1';
const GUEST_LAST_VIEW_STORAGE_KEY = `${LAST_VIEW_STORAGE_KEY}:guest`;
export const XTATION_LAST_VIEW_STORAGE_EVENT = 'xtation:last-view-change';

const RESTORABLE_VIEWS = new Set<ClientView>([
  ClientView.LOBBY,
  ClientView.LAB,
  ClientView.PROFILE,
  ClientView.MULTIPLAYER,
  ClientView.INVENTORY,
  ClientView.STORE,
  ClientView.SETTINGS,
  ClientView.ADMIN,
  ClientView.TFT,
]);

const isClientView = (value: string | null): value is ClientView =>
  Boolean(value && Object.values(ClientView).includes(value as ClientView));

export const isRestorableXtationView = (value: ClientView | null | undefined) =>
  Boolean(value && RESTORABLE_VIEWS.has(value));

interface XtationViewAccess {
  canAccessAdmin?: boolean;
  featureVisibility?: {
    lab?: boolean;
    multiplayer?: boolean;
    store?: boolean;
  };
}

export const resolveXtationLastView = (
  view: ClientView | null | undefined,
  {
    canAccessAdmin = false,
    featureVisibility = { lab: true, multiplayer: true, store: true },
  }: XtationViewAccess = {}
): ClientView => {
  if (!view || !isRestorableXtationView(view)) return ClientView.LOBBY;
  if (view === ClientView.ADMIN && !canAccessAdmin) return ClientView.LOBBY;
  if ((view === ClientView.LAB || view === ClientView.HOME) && featureVisibility.lab === false) return ClientView.LOBBY;
  if (view === ClientView.MULTIPLAYER && featureVisibility.multiplayer === false) return ClientView.LOBBY;
  if (view === ClientView.STORE && featureVisibility.store === false) return ClientView.LOBBY;
  return view;
};

const getGuestStorage = (): Partial<Storage> | null => {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage as Partial<Storage> | undefined;
  if (!storage) return null;
  return storage;
};

export const readStoredXtationLastView = (userId?: string | null): ClientView | null => {
  if (typeof window === 'undefined') return null;

  const raw = userId
    ? readUserScopedString(LAST_VIEW_STORAGE_KEY, null, userId)
    : typeof getGuestStorage()?.getItem === 'function'
      ? getGuestStorage()!.getItem!(GUEST_LAST_VIEW_STORAGE_KEY) ?? null
      : null;

  if (!isClientView(raw) || !isRestorableXtationView(raw)) return null;
  return raw;
};

export const writeStoredXtationLastView = (view: ClientView, userId?: string | null) => {
  if (typeof window === 'undefined' || !isRestorableXtationView(view)) return false;

  if (userId) {
    const result = writeUserScopedString(LAST_VIEW_STORAGE_KEY, view, userId);
    window.dispatchEvent(
      new CustomEvent(XTATION_LAST_VIEW_STORAGE_EVENT, {
        detail: {
          userId,
          view,
        },
      })
    );
    return result;
  }

  const storage = getGuestStorage();
  if (!storage || typeof storage.setItem !== 'function') return false;

  try {
    storage.setItem(GUEST_LAST_VIEW_STORAGE_KEY, view);
    window.dispatchEvent(
      new CustomEvent(XTATION_LAST_VIEW_STORAGE_EVENT, {
        detail: {
          userId: null,
          view,
        },
      })
    );
    return true;
  } catch {
    return false;
  }
};
