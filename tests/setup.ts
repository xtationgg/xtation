import '@testing-library/jest-dom/vitest';

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
