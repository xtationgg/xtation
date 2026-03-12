import type React from 'react';

const NESTED_SCROLLABLE_SELECTOR = [
  '.xt-scroll',
  '[data-wheel-scroll-local]',
  '[data-wheel-scroll-lock="true"]',
].join(', ');

const EDITABLE_SELECTOR = [
  'textarea',
  'select',
  'input[type="number"]',
  'input[type="range"]',
  '[contenteditable="true"]',
].join(', ');

export function shouldRouteWheelToContainer(
  container: HTMLElement,
  target: Element | null,
  deltaX: number,
  deltaY: number
): boolean {
  if (Math.abs(deltaY) <= Math.abs(deltaX)) return false;
  if (container.scrollHeight <= container.clientHeight) return false;
  if (!target) return true;

  const nestedScrollable = target.closest(NESTED_SCROLLABLE_SELECTOR);
  if (
    nestedScrollable &&
    nestedScrollable !== container &&
    container.contains(nestedScrollable) &&
    nestedScrollable instanceof HTMLElement &&
    nestedScrollable.scrollHeight > nestedScrollable.clientHeight
  ) {
    return false;
  }

  const editable = target.closest(EDITABLE_SELECTOR);
  if (editable && editable !== container) {
    return false;
  }

  return true;
}

export function routeWheelToContainer(event: React.WheelEvent<HTMLElement>) {
  const container = event.currentTarget;
  const target = event.target instanceof Element ? event.target : null;
  if (!shouldRouteWheelToContainer(container, target, event.deltaX, event.deltaY)) return;
  event.preventDefault();
  container.scrollTop += event.deltaY;
}
