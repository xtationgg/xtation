import React, { useCallback, useEffect, useState } from 'react';
import { classifyEvent, type AnnouncerEvent } from '../../src/announcer/classifier';
import { useXtationSettings } from '../../src/settings/SettingsProvider';

interface AnnouncerMessage {
  id: number;
  title: string;
  tier: string;
}

let messageCounter = 0;

export const AnnouncerOverlay: React.FC = () => {
  const { settings } = useXtationSettings();
  const [messages, setMessages] = useState<AnnouncerMessage[]>([]);

  const showMessage = useCallback((event: AnnouncerEvent) => {
    if (event.tier === 'silent') return;
    if (!settings.device.audioEnabled && event.tier === 'sound') return;

    const id = ++messageCounter;
    setMessages(prev => [...prev.slice(-2), { id, title: event.title, tier: event.tier }]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== id));
    }, 3000);
  }, [settings.device.audioEnabled]);

  useEffect(() => {
    const handlePresentationEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.name) return;
      const event = classifyEvent(detail.name, detail.metadata);
      if (event) showMessage(event);
    };

    // Listen for presentation events
    window.addEventListener('xtation:presentation:event', handlePresentationEvent);

    // Also listen for wire fire events from Lab canvas
    const handleWireFire = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const event = classifyEvent('wire:fired', detail);
      if (event) showMessage(event);
    };
    window.addEventListener('xtation:wire:fire', handleWireFire);

    // Listen for first session of the day
    const handleFirstSession = () => {
      const event = classifyEvent('app.session.first');
      if (event) showMessage(event);
    };
    window.addEventListener('xtation:app:firstSession', handleFirstSession);

    return () => {
      window.removeEventListener('xtation:presentation:event', handlePresentationEvent);
      window.removeEventListener('xtation:wire:fire', handleWireFire);
      window.removeEventListener('xtation:app:firstSession', handleFirstSession);
    };
  }, [showMessage]);

  if (messages.length === 0) return null;

  return (
    <div className="xt-announcer-overlay">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`xt-announcer-message xt-announcer-message--${msg.tier}`}
        >
          <span className="xt-announcer-text">{msg.title}</span>
        </div>
      ))}
    </div>
  );
};
