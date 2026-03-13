import React from 'react';
import { useXtationSettings } from '../../src/settings/SettingsProvider';

interface HintProps {
  /** The instructional/hint text content */
  children: React.ReactNode;
  /** Tooltip placement relative to the icon. Default: 'top' */
  placement?: 'top' | 'bottom';
  /** Optional extra class on the inline wrapper (always mode) */
  className?: string;
}

/**
 * Hint — renders instructional text according to the user's hint mode setting.
 *
 *   off    → renders nothing at all
 *   hover  → replaces the text block with a small ⓘ icon; hovering reveals
 *            the text in a clean tooltip bubble (pure CSS, no JS positioning)
 *   always → renders the text inline as subtle muted text (current behaviour)
 */
export const Hint: React.FC<HintProps> = ({ children, placement = 'top', className }) => {
  const { settings } = useXtationSettings();
  const mode = settings.device.interfaceHintMode ?? 'hover';

  if (mode === 'off') return null;

  if (mode === 'hover') {
    return (
      <span
        className={`xt-hint-trigger xt-hint-trigger--${placement}`}
        role="img"
        aria-label="More info"
        tabIndex={0}
      >
        &#9432;
        <span className="xt-hint-bubble">{children}</span>
      </span>
    );
  }

  // always
  return (
    <span className={`xt-hint-inline${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
};

export default Hint;
