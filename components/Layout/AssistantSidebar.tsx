import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Settings, RefreshCcw, Command, Zap, Wand2, ListChecks, Video } from 'lucide-react';
import { playClickSound, playHoverSound } from '../../utils/SoundEffects';

interface AssistantSidebarProps {
  onSubmitTask?: (prompt: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const AssistantSidebar: React.FC<AssistantSidebarProps> = ({ onSubmitTask }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Systems online. How can I assist across client sections?' }
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const prompt = input.trim();
    if (!prompt) return;
    playClickSound();
    const newMsg: Message = { id: Date.now().toString(), role: 'user', content: prompt };
    setMessages(prev => [...prev, newMsg, { id: `${Date.now()}-ack`, role: 'assistant', content: 'Acknowledged. Executing requested action stub.' }]);
    setInput('');
    onSubmitTask?.(prompt);
  };

  return (
    <div className="w-[320px] h-full bg-[var(--app-bg)] border-l border-[var(--app-border)] flex flex-col z-20">
      {/* Video header */}
      <div className="relative h-40 border-b border-[var(--app-border)] overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-80"
          src="https://cdn.coverr.co/videos/coverr-blue-planet-6645/1080p.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/70" />
        <div className="absolute bottom-3 left-4 flex items-center gap-2 text-[var(--app-text)]">
          <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--app-text)_10%,transparent)] border border-[color-mix(in_srgb,var(--app-text)_30%,transparent)] flex items-center justify-center">
            <Bot size={18} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-text)]">AI Assistant</div>
            <div className="text-[10px] text-[var(--app-muted)] uppercase tracking-[0.2em]">Client Ops</div>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded border text-sm font-mono ${
              m.role === 'user' 
                ? 'bg-[var(--app-accent)] text-[var(--app-text)] border-[var(--app-accent)]' 
                : 'bg-[var(--app-panel)] text-[var(--app-text)] border-[var(--app-border)]'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Quick actions */}
      <div className="px-4 py-3 border-t border-[var(--app-border)] space-y-2 bg-[var(--app-panel)]">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">
          <Command size={12} /> Quick Ops
        </div>
        <div className="grid grid-cols-3 gap-2">
          <QuickAction label="Edit Settings" icon={<Settings size={14} />} onClick={() => setInput('Edit settings: ')} />
          <QuickAction label="Update Lobby" icon={<Wand2 size={14} />} onClick={() => setInput('Change lobby visuals: ')} />
          <QuickAction label="Manage Inventory" icon={<ListChecks size={14} />} onClick={() => setInput('Update inventory slot: ')} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--app-border)] bg-[var(--app-panel)]">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Command the client (e.g., update settings, modify slots)..."
            className="flex-1 bg-[var(--app-panel-2)] border border-[var(--app-border)] text-[var(--app-text)] text-xs py-2 px-3 focus:border-[var(--app-text)] focus:outline-none placeholder-[var(--app-muted)]"
          />
          <button
            onClick={handleSend}
            onMouseEnter={playHoverSound}
            className="h-10 w-12 bg-[var(--app-accent)] text-[var(--app-text)] flex items-center justify-center border border-[var(--app-accent)] hover:bg-[var(--app-panel-2)] hover:text-[var(--app-text)] transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const QuickAction: React.FC<{ label: string; icon: React.ReactNode; onClick: () => void }> = ({ label, icon, onClick }) => (
  <button
    onClick={onClick}
    onMouseEnter={playHoverSound}
    className="flex items-center gap-2 px-2 py-2 border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[10px] uppercase tracking-[0.15em] text-[var(--app-muted)] hover:border-[var(--app-text)] hover:text-[var(--app-text)] transition-colors"
  >
    {icon} {label}
  </button>
);
