import '@testing-library/jest-dom/vitest';

const ensureStorageMethods = (storage: Storage | undefined) => {
  if (!storage) return;
  const memory = new Map<string, string>();
  const readFallback = (key: string) => (memory.has(key) ? memory.get(key)! : null);

  if (typeof storage.getItem !== 'function') {
    Object.defineProperty(storage, 'getItem', {
      configurable: true,
      value: (key: string) => readFallback(String(key)),
    });
  }

  if (typeof storage.setItem !== 'function') {
    Object.defineProperty(storage, 'setItem', {
      configurable: true,
      value: (key: string, value: string) => {
        memory.set(String(key), String(value));
      },
    });
  }

  if (typeof storage.removeItem !== 'function') {
    Object.defineProperty(storage, 'removeItem', {
      configurable: true,
      value: (key: string) => {
        memory.delete(String(key));
      },
    });
  }

  if (typeof storage.clear !== 'function') {
    Object.defineProperty(storage, 'clear', {
      configurable: true,
      value: () => {
        memory.clear();
      },
    });
  }

  if (typeof storage.key !== 'function') {
    Object.defineProperty(storage, 'key', {
      configurable: true,
      value: (index: number) => Array.from(memory.keys())[index] ?? null,
    });
  }

  if (typeof storage.length !== 'number') {
    Object.defineProperty(storage, 'length', {
      configurable: true,
      get: () => memory.size,
    });
  }
};

ensureStorageMethods(window.localStorage);
ensureStorageMethods(window.sessionStorage);

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(performance.now()), 0);
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
}

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo(options?: ScrollToOptions | number, y?: number) {
    if (typeof options === 'number') {
      this.scrollTop = y ?? 0;
      return;
    }
    this.scrollTop = options?.top ?? 0;
  };
}

if (typeof window.HTMLMediaElement !== 'undefined') {
  Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: () => undefined,
  });

  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => Promise.resolve(),
  });
}
