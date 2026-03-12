import { useEffect } from 'react';
import type React from 'react';

const LOCAL_WHEEL_LOCK_SELECTOR = [
  '[data-wheel-scroll-local]',
  '[data-wheel-scroll-lock="true"]',
  '[role="spinbutton"]',
].join(', ');

const EDITABLE_SELECTOR = [
  'textarea',
  'select',
  'input[type="number"]',
  'input[type="range"]',
  '[contenteditable="true"]',
].join(', ');

function isVerticallyScrollable(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  if (!/(auto|scroll|overlay)/.test(style.overflowY)) return false;
  return element.scrollHeight > element.clientHeight + 1;
}

function canScrollInDirection(element: HTMLElement, deltaY: number) {
  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  if (maxScrollTop <= 0) return false;
  if (deltaY < 0) return element.scrollTop > 0;
  if (deltaY > 0) return element.scrollTop < maxScrollTop - 1;
  return false;
}

function getDocumentScrollTarget(deltaY: number) {
  const scrollingElement =
    (document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null) ??
    document.documentElement;
  if (!(scrollingElement instanceof HTMLElement)) return null;
  if (scrollingElement.scrollHeight <= scrollingElement.clientHeight + 1) return null;
  if (canScrollInDirection(scrollingElement, deltaY)) return scrollingElement;
  return scrollingElement;
}

function shouldIgnoreWheelTarget(container: HTMLElement, target: Element | null) {
  if (!target) return false;
  const localLock = target.closest(LOCAL_WHEEL_LOCK_SELECTOR);
  if (localLock && localLock !== container) return true;
  const editable = target.closest(EDITABLE_SELECTOR);
  if (editable && editable !== container) return true;
  return false;
}

export function findNearestScrollableAncestor(
  container: HTMLElement,
  target: Element | null,
  deltaY?: number
) {
  let fallback: HTMLElement | null = null;
  let node = target;
  while (node && node instanceof HTMLElement) {
    if (node === container) break;
    if (isVerticallyScrollable(node)) {
      fallback ??= node;
      if (deltaY == null || canScrollInDirection(node, deltaY)) return node;
    }
    node = node.parentElement;
  }
  if (isVerticallyScrollable(container) && (deltaY == null || canScrollInDirection(container, deltaY))) {
    return container;
  }
  return fallback ?? (isVerticallyScrollable(container) ? container : null);
}

function handleWheelEvent(container: HTMLElement, event: Pick<WheelEvent, 'target' | 'deltaX' | 'deltaY' | 'preventDefault' | 'ctrlKey' | 'metaKey'>) {
  if (event.ctrlKey || event.metaKey) return;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  const target = event.target instanceof Element ? event.target : null;
  if (shouldIgnoreWheelTarget(container, target)) return;
  const nearestTarget = findNearestScrollableAncestor(container, target, event.deltaY);
  const scrollTarget =
    nearestTarget && canScrollInDirection(nearestTarget, event.deltaY)
      ? nearestTarget
      : getDocumentScrollTarget(event.deltaY) ?? nearestTarget;
  if (!scrollTarget) return;
  event.preventDefault();
  scrollTarget.scrollTop += event.deltaY;
}

export function routeWheelToContainer(event: React.WheelEvent<HTMLElement>) {
  handleWheelEvent(
    event.currentTarget,
    ((event as unknown as { nativeEvent?: WheelEvent }).nativeEvent ?? event) as Pick<
      WheelEvent,
      'target' | 'deltaX' | 'deltaY' | 'preventDefault' | 'ctrlKey' | 'metaKey'
    >
  );
}

export function useWheelScrollBridge(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const onWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !container.contains(target)) return;
      handleWheelEvent(container, event);
    };

    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      document.removeEventListener('wheel', onWheel, true);
    };
  }, [ref]);
}
