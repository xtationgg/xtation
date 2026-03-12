import { describe, expect, it } from 'vitest';
import { shouldRouteWheelToContainer } from '../src/ui/wheelScroll';

function makeScrollable(tagName = 'div') {
  const element = document.createElement(tagName);
  Object.defineProperty(element, 'scrollHeight', { value: 1200, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: 600, configurable: true });
  return element;
}

describe('shouldRouteWheelToContainer', () => {
  it('routes vertical wheel input to a scrollable container', () => {
    const container = makeScrollable();
    const target = document.createElement('div');
    container.appendChild(target);

    expect(shouldRouteWheelToContainer(container, target, 0, 120)).toBe(true);
  });

  it('does not route horizontal-dominant wheel input', () => {
    const container = makeScrollable();
    const target = document.createElement('div');
    container.appendChild(target);

    expect(shouldRouteWheelToContainer(container, target, 120, 10)).toBe(false);
  });

  it('defers to nested scrollable regions', () => {
    const container = makeScrollable();
    const target = document.createElement('div');
    const nested = makeScrollable();
    nested.className = 'xt-scroll';
    nested.appendChild(target);
    container.appendChild(nested);

    expect(shouldRouteWheelToContainer(container, target, 0, 120)).toBe(false);
  });

  it('defers to editable inputs', () => {
    const container = makeScrollable();
    const target = document.createElement('input');
    target.type = 'number';
    container.appendChild(target);

    expect(shouldRouteWheelToContainer(container, target, 0, 120)).toBe(false);
  });
});
