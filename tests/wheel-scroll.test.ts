import { describe, expect, it } from 'vitest';
import { findNearestScrollableAncestor, routeWheelToContainer } from '../src/ui/wheelScroll';

function makeScrollable(tagName = 'div') {
  const element = document.createElement(tagName);
  Object.defineProperty(element, 'scrollHeight', { value: 1200, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: 600, configurable: true });
  Object.defineProperty(element, 'scrollTop', { value: 0, writable: true, configurable: true });
  element.style.overflowY = 'auto';
  return element;
}

describe('findNearestScrollableAncestor', () => {
  it('returns the nearest scrollable ancestor', () => {
    const container = makeScrollable();
    const nested = makeScrollable();
    nested.className = 'xt-scroll';
    const target = document.createElement('div');
    nested.appendChild(target);
    container.appendChild(nested);

    expect(findNearestScrollableAncestor(container, target)).toBe(nested);
  });

  it('falls back to the container when no nearer scrollable ancestor exists', () => {
    const container = makeScrollable();
    const target = document.createElement('div');
    container.appendChild(target);

    expect(findNearestScrollableAncestor(container, target)).toBe(container);
  });

  it('falls back to the outer container when the nearer ancestor is at its scroll limit', () => {
    const container = makeScrollable();
    const nested = makeScrollable();
    nested.className = 'xt-scroll';
    nested.scrollTop = 600;
    Object.defineProperty(nested, 'scrollHeight', { value: 1200, configurable: true });
    Object.defineProperty(nested, 'clientHeight', { value: 600, configurable: true });
    const target = document.createElement('div');
    nested.appendChild(target);
    container.appendChild(nested);

    expect(findNearestScrollableAncestor(container, target, 120)).toBe(container);
  });
});

describe('routeWheelToContainer', () => {
  it('routes vertical wheel input to the nearest scrollable container', () => {
    const container = makeScrollable();
    const nested = makeScrollable();
    nested.className = 'xt-scroll';
    const target = document.createElement('div');
    nested.appendChild(target);
    container.appendChild(nested);

    const event = {
      currentTarget: container,
      target,
      deltaX: 0,
      deltaY: 120,
      preventDefault: vi.fn(),
    } as unknown as React.WheelEvent<HTMLElement>;

    routeWheelToContainer(event);

    expect(nested.scrollTop).toBe(120);
    expect(container.scrollTop).toBe(0);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('ignores horizontal-dominant wheel input', () => {
    const container = makeScrollable();
    const target = document.createElement('div');
    container.appendChild(target);

    const event = {
      currentTarget: container,
      target,
      deltaX: 120,
      deltaY: 10,
      preventDefault: vi.fn(),
    } as unknown as React.WheelEvent<HTMLElement>;

    routeWheelToContainer(event);

    expect(container.scrollTop).toBe(0);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('defers to local spinbutton wheel controls', () => {
    const container = makeScrollable();
    const target = document.createElement('div');
    target.setAttribute('role', 'spinbutton');
    container.appendChild(target);

    const event = {
      currentTarget: container,
      target,
      deltaX: 0,
      deltaY: 120,
      preventDefault: vi.fn(),
    } as unknown as React.WheelEvent<HTMLElement>;

    routeWheelToContainer(event);

    expect(container.scrollTop).toBe(0);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('defers to editable inputs', () => {
    const container = makeScrollable();
    const target = document.createElement('input');
    target.type = 'number';
    container.appendChild(target);

    const event = {
      currentTarget: container,
      target,
      deltaX: 0,
      deltaY: 120,
      preventDefault: vi.fn(),
    } as unknown as React.WheelEvent<HTMLElement>;

    routeWheelToContainer(event);

    expect(container.scrollTop).toBe(0);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('falls back to the outer container when the nearer nested scroller is already exhausted', () => {
    const container = makeScrollable();
    const nested = makeScrollable();
    nested.className = 'xt-scroll';
    nested.scrollTop = 600;
    const target = document.createElement('div');
    nested.appendChild(target);
    container.appendChild(nested);

    const event = {
      currentTarget: container,
      target,
      deltaX: 0,
      deltaY: 120,
      preventDefault: vi.fn(),
    } as unknown as React.WheelEvent<HTMLElement>;

    routeWheelToContainer(event);

    expect(container.scrollTop).toBe(120);
    expect(nested.scrollTop).toBe(600);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });
});
