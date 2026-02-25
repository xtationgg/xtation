import React, { useMemo, useState } from 'react';
import { Upload, HardDrive, Shield, Cpu, Wifi, Activity, Bell, Menu, Search, Send, Layers, Grid, ArrowRight, Sparkles, Play, Pause, Tag } from 'lucide-react';
import { playClickSound, playHoverSound } from '../utils/SoundEffects';

interface DuskNavItem {
    label: string;
    icon: React.ReactNode;
    active?: boolean;
}

export const DuskLayout: React.FC = () => {
    const [parallax, setParallax] = useState({ x: 0, y: 0 });
    const [parallaxIntensity, setParallaxIntensity] = useState(10);
    const [activeNav, setActiveNav] = useState('Dashboard');
    const [aiLive, setAiLive] = useState(true);
    const [syncArmed, setSyncArmed] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

    const handleParallax = (e: React.MouseEvent<HTMLDivElement>) => {
        const { innerWidth, innerHeight } = window;
        const x = ((e.clientX / innerWidth) - 0.5) * parallaxIntensity;
        const y = ((e.clientY / innerHeight) - 0.5) * parallaxIntensity;
        setParallax({ x, y });
    };

    const navItems: DuskNavItem[] = [
        { label: 'Dashboard', icon: <Grid size={16} /> },
        { label: 'Slots', icon: <HardDrive size={16} /> },
        { label: 'Vault', icon: <Layers size={16} /> },
        { label: 'Systems', icon: <Cpu size={16} /> },
        { label: 'Security', icon: <Shield size={16} /> },
    ];

    const glowTranslate = useMemo(() => ({
        transform: `translate(${parallax.x}px, ${parallax.y}px)`,
    }), [parallax]);

    return (
        <div 
            className="min-h-screen bg-[var(--t-bg)] text-[var(--t-text)] font-mono overflow-hidden relative"
            onMouseMove={handleParallax}
        >
            {/* Ambient Layers */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_srgb,var(--t-accent)_8%,transparent),transparent_32%),radial-gradient(circle_at_70%_10%,color-mix(in_srgb,var(--t-text)_8%,transparent),transparent_30%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:100%_3px]" style={{ opacity: 0.25 }} />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:3px_100%]" style={{ opacity: 0.2 }} />
                <div className="absolute inset-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'220\' height=\'220\' viewBox=\'0 0 220 220\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h220v220H0z\' fill=\'%23000000\'/%3E%3Cpath d=\'M0 0h220v220H0z\' fill=\'none\' stroke=\'%23222222\' stroke-width=\'0.7\'/%3E%3C/svg%3E")', opacity: 0.1 }} />
            </div>

            <DuskTopBar parallax={parallax} />

            <div className="relative z-10 flex">
                <DuskNav items={navItems} active={activeNav} onSelect={(label) => { setActiveNav(label); playClickSound(); }} />

                <main className="flex-1 p-10 space-y-8">
                    <HeroSection glowTranslate={glowTranslate} />
                    <ControlDeck 
                        aiLive={aiLive} 
                        syncArmed={syncArmed} 
                        onToggleAi={() => { setAiLive(!aiLive); playClickSound(); }}
                        onToggleSync={() => { setSyncArmed(!syncArmed); playClickSound(); }}
                        parallaxIntensity={parallaxIntensity}
                        onParallaxChange={(val) => setParallaxIntensity(val)}
                    />

                    <div className="grid grid-cols-12 gap-8">
                        <section className="col-span-8 bg-[color-mix(in_srgb,var(--t-panel)_80%,transparent)] border border-[var(--t-border)] rounded-2xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.5)] backdrop-blur-md relative">
                            <div className="absolute inset-0 pointer-events-none" style={glowTranslate}>
                                <div className="absolute -inset-16 bg-[radial-gradient(circle,color-mix(in_srgb,var(--t-accent)_8%,transparent)_0%,transparent_70%)] blur-3xl" />
                            </div>
                            <div className="border-b border-[var(--t-border)] px-6 py-4 flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--t-accent)]">Slots System</div>
                                    <div className="text-lg font-semibold text-[var(--t-text)]">Holographic Inventory Grid</div>
                                </div>
                                <button className="px-3 py-2 text-xs uppercase tracking-wide border border-[var(--t-border)] hover:border-[var(--t-text)] bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)] rounded-md flex items-center gap-2 transition-colors">
                                    <Upload size={14} /> Upload
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <DuskSlotGrid onSelect={(idx) => setSelectedSlot(idx)} selected={selectedSlot} />
                                <div className="grid grid-cols-3 gap-3">
                                    <GlassCard title="Metadata" desc="Hover to inspect, right-click menu coming soon." />
                                    <GlassCard title="Sync Status" desc="Local cache active // Supabase link pending." />
                                    <GlassCard title="Background" desc="Select slot → set as OS background." />
                                </div>
                            </div>
                        </section>

                        <aside className="col-span-4 flex flex-col gap-6">
                            <DuskAIAdvisor live={aiLive} />
                            <div className="bg-[color-mix(in_srgb,var(--t-panel)_80%,transparent)] border border-[var(--t-border)] rounded-2xl p-5 shadow-[0_20px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
                                <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--t-accent)] mb-2">Quick Upload</div>
                                <div className="flex items-center gap-3">
                                    <button className="flex-1 px-3 py-3 border border-dashed border-[var(--t-border)] rounded-lg text-xs uppercase tracking-wide bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)] hover:border-[var(--t-text)] transition-colors flex items-center justify-center gap-2">
                                        <Upload size={14} /> Drop Artifact
                                    </button>
                                    <button className="px-3 py-3 border border-[var(--t-border)] rounded-lg hover:border-[var(--t-text)] transition-colors text-xs uppercase tracking-wide">
                                        <ArrowRight size={14} />
                                    </button>
                                </div>
                                <p className="text-[11px] text-[var(--t-muted)] mt-3 leading-relaxed">
                                    Drag imagery / video / files. LocalStorage first; vault sync next.
                                </p>
                            </div>
                        </aside>
                    </div>
                </main>
            </div>

            <DuskFooter />
        </div>
    );
};

const DuskTopBar: React.FC<{ parallax: { x: number; y: number } }> = ({ parallax }) => {
    return (
        <header className="relative z-20 px-10 py-5 border-b border-[var(--t-border)] bg-[color-mix(in_srgb,var(--t-panel)_85%,transparent)] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.45)] flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg border border-[var(--t-border)] bg-[var(--t-panel-2)] flex items-center justify-center shadow-[0_0_30px_color-mix(in_srgb,var(--t-accent)_25%,transparent)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle,color-mix(in_srgb,var(--t-accent)_25%,transparent),transparent_50%)]" style={{ transform: `translate(${parallax.x * 0.3}px, ${parallax.y * 0.3}px)` }} />
                    <div className="relative text-xs font-black tracking-[0.2em]">DSK</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[var(--t-accent)]">Dusk OS // KPR-Grade Client</div>
                    <div className="text-xl font-semibold">Operator: Eclipse // Channel: Live Sync</div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-[var(--t-panel-2)] border border-[var(--t-border)] rounded-md">
                    <Search size={14} className="text-[var(--t-muted)]" />
                    <input 
                        placeholder="Search network..."
                        className="bg-transparent text-sm outline-none text-[var(--t-text)] placeholder:text-[var(--t-muted)] w-48"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <IconBadge icon={<Wifi size={14} />} label="Online" />
                    <IconBadge icon={<Cpu size={14} />} label="Core" />
                    <IconBadge icon={<Activity size={14} />} label="Stable" />
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-2 rounded-md border border-[var(--t-border)] bg-[var(--t-panel-2)] hover:border-[var(--t-text)] transition-colors relative">
                        <Bell size={16} />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--t-accent)] rounded-full animate-pulse" />
                    </button>
                    <button className="p-2 rounded-md border border-[var(--t-border)] bg-[var(--t-panel-2)] hover:border-[var(--t-text)] transition-colors">
                        <Menu size={16} />
                    </button>
                </div>
            </div>
        </header>
    );
};

const DuskNav: React.FC<{ items: DuskNavItem[]; active: string; onSelect: (label: string) => void }> = ({ items, active, onSelect }) => {
    return (
        <nav className="w-64 border-r border-[var(--t-border)] bg-[color-mix(in_srgb,var(--t-panel)_85%,transparent)] backdrop-blur-md relative z-10">
            <div className="p-8 space-y-4">
                {items.map(item => (
                    <button
                        key={item.label}
                        onMouseEnter={playHoverSound}
                        onClick={() => onSelect(item.label)}
                        className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition-all text-xs tracking-[0.2em] uppercase ${
                            active === item.label 
                                ? 'border-[var(--t-accent)] bg-[color-mix(in_srgb,var(--t-accent)_10%,transparent)] text-[var(--t-text)] shadow-[0_0_20px_color-mix(in_srgb,var(--t-accent)_15%,transparent)]' 
                                : 'border-[var(--t-border)] bg-[var(--t-panel-2)] hover:border-[var(--t-accent)] hover:text-[var(--t-text)] text-[var(--t-muted)]'
                        }`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                ))}

                <div className="mt-8 p-4 border border-[var(--t-border)] rounded-xl bg-[var(--t-panel-2)]">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--t-accent)] mb-3">Quick Actions</div>
                    <div className="space-y-2">
                        <button className="w-full text-left px-3 py-2 text-xs border border-dashed border-[var(--t-border)] rounded-lg bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)] hover:border-[var(--t-text)] transition-colors flex items-center gap-2">
                            <Upload size={14} /> Upload to Vault
                        </button>
                        <button className="w-full text-left px-3 py-2 text-xs border border-dashed border-[var(--t-border)] rounded-lg bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)] hover:border-[var(--t-text)] transition-colors flex items-center gap-2">
                            <Shield size={14} /> Secure Channel
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

const HeroSection: React.FC<{ glowTranslate: React.CSSProperties }> = ({ glowTranslate }) => {
    return (
        <section className="relative overflow-hidden border border-[var(--t-border)] rounded-2xl bg-[color-mix(in_srgb,var(--t-panel)_80%,transparent)] backdrop-blur-md shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
            <div className="absolute inset-0 pointer-events-none" style={glowTranslate}>
                <div className="absolute -left-10 -top-10 w-64 h-64 rounded-full bg-[color-mix(in_srgb,var(--t-accent)_10%,transparent)] blur-3xl" />
                <div className="absolute -right-16 -bottom-16 w-72 h-72 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.04),transparent_40%)]" />
            </div>
            <div className="grid grid-cols-12 gap-8 p-10 relative z-10">
                <div className="col-span-7 space-y-4">
                    <div className="text-[11px] uppercase tracking-[0.35em] text-[var(--t-accent)]">KPRverse-inspired // Tactical Client</div>
                    <h1 className="text-4xl md:text-5xl font-black leading-tight">Dusk OS // Cinematic Life Operating System</h1>
                    <p className="text-sm text-[color-mix(in_srgb,var(--t-text)_88%,var(--t-muted))] leading-relaxed max-w-2xl">
                        Dark-matte holo surfaces, glitch text, and red-accent rails. Build your slots, vault media, and stream AI directives inside a KPR-grade shell.
                    </p>
                    <div className="flex items-center gap-3">
                        <button className="px-4 py-3 bg-[var(--t-accent)] text-black font-bold uppercase tracking-[0.2em] rounded-lg hover:brightness-110 transition-all shadow-[0_15px_40px_color-mix(in_srgb,var(--t-accent)_35%,transparent)]">
                            Launch Session
                        </button>
                        <button className="px-4 py-3 border border-[var(--t-border)] text-xs uppercase tracking-[0.2em] rounded-lg bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)] hover:border-[var(--t-text)] transition-colors flex items-center gap-2">
                            <ArrowRight size={14} /> View Vault
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2">
                        <MiniStat label="Slots Ready" value="06" />
                        <MiniStat label="Sync Channel" value="Local > Supabase (pending)" />
                        <MiniStat label="Advisor Feed" value="Live" />
                    </div>
                </div>
                <div className="col-span-5 relative flex items-center justify-center">
                    <div className="w-72 h-72 rounded-full border border-[var(--t-border)] flex items-center justify-center relative">
                        <div className="absolute inset-6 border border-[var(--t-border)] rounded-full" />
                        <div className="absolute inset-0 border-t-2 border-[var(--t-accent)] rounded-full animate-spin-slow" />
                        <div className="absolute inset-0 border-b-2 border-[color-mix(in_srgb,var(--t-text)_40%,transparent)] rounded-full animate-spin-slow" style={{ animationDuration: '5s', animationDirection: 'reverse' }} />
                        <div className="absolute inset-12 bg-gradient-to-br from-[color-mix(in_srgb,var(--t-accent)_10%,transparent)] via-transparent to-transparent rounded-full" />
                        <div className="relative text-center">
                            <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--t-accent)]">System Online</div>
                            <div className="text-2xl font-semibold">Parallax Core</div>
                            <div className="text-xs text-[var(--t-muted)]">Mouse-move reactive glow</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

const DuskSlotGrid: React.FC<{ onSelect: (idx: number) => void; selected: number | null }> = ({ onSelect, selected }) => {
    const placeholderSlots = new Array(6).fill(null);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--t-accent)]">Slots</div>
                    <div className="text-sm text-[var(--t-muted)]">Hover for metadata // right-click actions coming soon.</div>
                </div>
                <button className="px-3 py-2 text-xs uppercase tracking-wide border border-[var(--t-border)] bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)] rounded-md flex items-center gap-2 hover:border-[var(--t-text)] transition-colors">
                    <Upload size={14} /> Add Slot
                </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {placeholderSlots.map((_, idx) => (
                    <div 
                        key={idx} 
                        onMouseEnter={playHoverSound}
                        onClick={() => onSelect(idx)}
                        className={`group relative aspect-video rounded-xl border bg-gradient-to-br from-[var(--t-panel-2)] to-[var(--t-panel)] overflow-hidden cursor-pointer transition-all hover:border-[var(--t-accent)] hover:-translate-y-1 ${
                            selected === idx ? 'border-[var(--t-accent)] shadow-[0_10px_40px_color-mix(in_srgb,var(--t-accent)_25%,transparent)]' : 'border-[var(--t-border)]'
                        }`}
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,color-mix(in_srgb,var(--t-accent)_12%,transparent),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_35%)]" />
                        <div className="absolute inset-0 border border-dashed border-[var(--t-border)] opacity-50" />
                        <div className="absolute top-2 left-2 text-[10px] uppercase tracking-[0.2em] text-[var(--t-accent)]">Slot {idx + 1}</div>
                        <div className="absolute bottom-2 left-2 right-2 text-[11px] text-[color-mix(in_srgb,var(--t-text)_88%,var(--t-muted))] opacity-80">
                            {selected === idx ? 'Selected // Actions armed' : 'Ready for upload. Saved to LocalStorage.'}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="px-3 py-2 text-xs uppercase tracking-wide border border-[var(--t-text)] text-[var(--t-text)] bg-black/60 rounded-md flex items-center gap-2 hover:bg-[var(--t-panel-2)] hover:text-[var(--t-text)] transition-colors">
                                <Upload size={14} /> Upload
                            </button>
                        </div>
                        <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                            <Chip icon={<Tag size={12} />} label="Tag" />
                            <Chip icon={<Sparkles size={12} />} label="Set BG" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DuskAIAdvisor: React.FC<{ live: boolean }> = ({ live }) => {
    return (
        <section className="bg-[color-mix(in_srgb,var(--t-panel)_80%,transparent)] border border-[var(--t-border)] rounded-2xl p-5 shadow-[0_20px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--t-accent)]">AI Advisor</div>
                    <div className="text-sm text-[color-mix(in_srgb,var(--t-text)_88%,var(--t-muted))]">Holo-terminal feed — {live ? 'live stream' : 'paused stream'}.</div>
                </div>
                <button className="px-3 py-2 text-xs uppercase tracking-wide border border-[var(--t-border)] bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)] rounded-md flex items-center gap-2 hover:border-[var(--t-text)] transition-colors">
                    <Send size={14} /> Push Task
                </button>
            </div>
            <div className="space-y-3">
                <AdvisorCard title="Mission Queue" detail="3 active objectives awaiting confirmation." />
                <AdvisorCard title="System Health" detail="Core temp nominal // Bandwidth stable // Shield mode ready." />
                <AdvisorCard title="Next Steps" detail="Connect Supabase sync, wire right-click actions, feed AI events." />
            </div>
        </section>
    );
};

const GlassCard: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
    <div className="p-4 border border-[var(--t-border)] rounded-xl bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)] hover:border-[var(--t-accent)] transition-colors">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--t-accent)] mb-1">{title}</div>
        <div className="text-xs text-[color-mix(in_srgb,var(--t-text)_88%,var(--t-muted))] leading-relaxed">{desc}</div>
    </div>
);

const AdvisorCard: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
    <div className="p-3 border border-[var(--t-border)] rounded-xl bg-[var(--t-panel-2)] hover:border-[var(--t-accent)] transition-colors">
        <div className="text-[11px] uppercase tracking-[0.25em] text-[var(--t-accent)]">{title}</div>
        <div className="text-sm text-[color-mix(in_srgb,var(--t-text)_88%,var(--t-muted))]">{detail}</div>
    </div>
);

const IconBadge: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="px-2 py-1 text-[10px] uppercase tracking-[0.25em] border border-[var(--t-border)] bg-[var(--t-panel-2)] rounded-md flex items-center gap-2 text-[color-mix(in_srgb,var(--t-text)_88%,var(--t-muted))]">
        {icon}
        <span>{label}</span>
    </div>
);

const Chip: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <span className="px-2 py-1 bg-black/60 border border-[var(--t-border)] rounded-full flex items-center gap-1 text-[var(--t-text)]">
        {icon}
        {label}
    </span>
);

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="p-3 border border-[var(--t-border)] rounded-lg bg-[color-mix(in_srgb,var(--t-panel-2)_70%,transparent)]">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--t-accent)]">{label}</div>
        <div className="text-sm text-[var(--t-text)]">{value}</div>
    </div>
);

const DuskFooter: React.FC = () => {
    return (
        <footer className="relative z-20 px-10 py-4 border-t border-[var(--t-border)] bg-[color-mix(in_srgb,var(--t-panel)_90%,transparent)] backdrop-blur-md flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-[var(--t-muted)]">
            <div className="flex items-center gap-4">
                <StatusPill color="var(--t-accent)" label="Live" />
                <StatusPill color="var(--t-accent)" label="Sync Idle" />
                <StatusPill color="var(--t-muted)" label="Glitch Monitor" />
            </div>
            <div className="flex items-center gap-6">
                <span>Memory 42%</span>
                <span>Latency 18ms</span>
                <span>Build: DuskOS-alpha</span>
            </div>
        </footer>
    );
};

const StatusPill: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span>{label}</span>
    </div>
);

const ControlDeck: React.FC<{
    aiLive: boolean;
    syncArmed: boolean;
    onToggleAi: () => void;
    onToggleSync: () => void;
    parallaxIntensity: number;
    onParallaxChange: (val: number) => void;
}> = ({ aiLive, syncArmed, onToggleAi, onToggleSync, parallaxIntensity, onParallaxChange }) => {
    return (
        <section className="grid grid-cols-12 gap-6 border border-[var(--t-border)] rounded-2xl bg-[color-mix(in_srgb,var(--t-panel)_80%,transparent)] backdrop-blur-md p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <div className="col-span-5 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--t-accent)]">Interaction Deck</div>
                <div className="text-lg font-semibold">Live Controls</div>
                <p className="text-sm text-[color-mix(in_srgb,var(--t-text)_88%,var(--t-muted))]">
                    Arm systems, toggle advisor stream, tune parallax feel. Everything is instantly reactive.
                </p>
                <div className="flex items-center gap-2">
                    <ToggleButton active={aiLive} label={aiLive ? 'AI Stream: Live' : 'AI Stream: Paused'} onClick={onToggleAi} iconOn={<Play size={14} />} iconOff={<Pause size={14} />} />
                    <ToggleButton active={syncArmed} label={syncArmed ? 'Sync: Armed' : 'Sync: Idle'} onClick={onToggleSync} iconOn={<Sparkles size={14} />} iconOff={<Sparkles size={14} />} />
                </div>
            </div>
            <div className="col-span-7">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--t-accent)]">Parallax Depth</div>
                    <div className="text-xs text-[var(--t-muted)]">{parallaxIntensity.toFixed(0)}px</div>
                </div>
                <input 
                    type="range" 
                    min={4} 
                    max={20} 
                    value={parallaxIntensity} 
                    onChange={(e) => onParallaxChange(Number(e.target.value))} 
                    className="w-full accent-[var(--t-accent)]"
                />
                <div className="mt-3 grid grid-cols-3 gap-3 text-[11px] text-[color-mix(in_srgb,var(--t-text)_88%,var(--t-muted))]">
                    <div className="border border-[var(--t-border)] rounded-lg p-3 bg-[var(--t-panel-2)]">Hover the nav + slots for tactile feedback.</div>
                    <div className="border border-[var(--t-border)] rounded-lg p-3 bg-[var(--t-panel-2)]">Drag files soon; local save is ready.</div>
                    <div className="border border-[var(--t-border)] rounded-lg p-3 bg-[var(--t-panel-2)]">Set a slot as background once selected.</div>
                </div>
            </div>
        </section>
    );
};

const ToggleButton: React.FC<{ active: boolean; label: string; onClick: () => void; iconOn: React.ReactNode; iconOff: React.ReactNode }> = ({ active, label, onClick, iconOn, iconOff }) => (
    <button 
        onClick={onClick}
        onMouseEnter={playHoverSound}
        className={`px-3 py-2 rounded-lg border text-xs uppercase tracking-[0.2em] flex items-center gap-2 transition-all ${
            active ? 'border-[var(--t-accent)] bg-[color-mix(in_srgb,var(--t-accent)_10%,transparent)] text-[var(--t-text)] shadow-[0_0_20px_color-mix(in_srgb,var(--t-accent)_25%,transparent)]' : 'border-[var(--t-border)] bg-[var(--t-panel-2)] text-[var(--t-muted)] hover:border-[var(--t-accent)]'
        }`}
    >
        {active ? iconOn : iconOff}
        {label}
    </button>
);
