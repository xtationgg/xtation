

// Synthesized Hextech Sound Effects using Web Audio API
// This avoids external asset dependencies and allows for procedural generation

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

const initAudio = () => {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (!AudioContextClass) return null;
        try {
            audioCtx = new AudioContextClass();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.4; // Master volume
            masterGain.connect(audioCtx.destination);
        } catch {
            audioCtx = null;
            masterGain = null;
            return null;
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx && masterGain ? { ctx: audioCtx, master: masterGain } : null;
};

export const playHoverSound = () => {
    const audio = initAudio();
    if (!audio || !audio.ctx) return;
    const { ctx, master } = audio;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master!);

    // High tech chirp
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.05);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500, ctx.currentTime);

    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
};

export const playClickSound = () => {
    const audio = initAudio();
    if (!audio || !audio.ctx) return;
    const { ctx, master } = audio;

    // Layer 1: Mechanical Thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(master!);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);

    // Layer 2: High frequency click (switch)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(master!);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(2000, ctx.currentTime);
    gain2.gain.setValueAtTime(0.02, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

    osc2.start();
    osc2.stop(ctx.currentTime + 0.02);
};

export const playSuccessSound = () => {
    const audio = initAudio();
    if (!audio || !audio.ctx) return;
    const { ctx, master } = audio;

    // Magical Chord (Major)
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major
    
    freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(master!);

        osc.type = 'sine';
        osc.frequency.value = freq;
        
        const now = ctx.currentTime;
        const startOffset = i * 0.04;

        gain.gain.setValueAtTime(0, now + startOffset);
        gain.gain.linearRampToValueAtTime(0.1, now + startOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + 1.2);

        osc.start(now + startOffset);
        osc.stop(now + startOffset + 1.5);
    });
    
    // Sparkle effect (High random noise burst simulation)
    const oscNoise = ctx.createOscillator();
    const gainNoise = ctx.createGain();
    oscNoise.type = 'sawtooth';
    oscNoise.frequency.setValueAtTime(3000, ctx.currentTime);
    oscNoise.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5);
    
    oscNoise.connect(gainNoise);
    gainNoise.connect(master!);
    
    gainNoise.gain.setValueAtTime(0.01, ctx.currentTime);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    oscNoise.start();
    oscNoise.stop(ctx.currentTime + 0.5);
};

export const playMatchFoundSound = () => {
    const audio = initAudio();
    if (!audio || !audio.ctx) return;
    const { ctx, master } = audio;

    // Heavy Gong/Impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(master!);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 2);

    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);

    osc.start();
    osc.stop(ctx.currentTime + 2.5);

    // Metallic overtone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(master!);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(200, ctx.currentTime);
    gain2.gain.setValueAtTime(0.1, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

    osc2.start();
    osc2.stop(ctx.currentTime + 1.5);
};

export const playPanelOpenSound = () => {
    const audio = initAudio();
    if (!audio || !audio.ctx) return;
    const { ctx, master } = audio;

    // Swoosh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master!);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
};

export const playErrorSound = () => {
    const audio = initAudio();
    if (!audio || !audio.ctx) return;
    const { ctx, master } = audio;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(master!);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
};

export const playRewardSound = (type: string, customUrl?: string) => {
    if (type === 'CUSTOM' && customUrl) {
        try {
            const audio = new Audio(customUrl);
            audio.volume = 0.5;
            audio.play().catch(e => console.error("Error playing custom sound:", e));
        } catch (e) {
            console.error("Error initializing custom audio", e);
        }
        return;
    }

    const audio = initAudio();
    if (!audio || !audio.ctx) return;
    const { ctx, master } = audio;
    
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(master!);

    switch(type) {
        case 'LEVEL_UP':
             // Classic Arpeggio
             const freqs = [440, 554, 659, 880];
             freqs.forEach((f, i) => {
                 const o = ctx.createOscillator();
                 const g = ctx.createGain();
                 o.connect(g);
                 g.connect(master!);
                 o.type = 'square';
                 o.frequency.value = f;
                 g.gain.setValueAtTime(0, now + i*0.1);
                 g.gain.linearRampToValueAtTime(0.1, now + i*0.1 + 0.05);
                 g.gain.exponentialRampToValueAtTime(0.001, now + i*0.1 + 0.5);
                 o.start(now + i*0.1);
                 o.stop(now + i*0.1 + 0.5);
             });
             break;
        case 'TECH_POWER':
            // Low drone rising
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(50, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 1.2);
            osc.start(now);
            osc.stop(now + 1.2);
            break;
        case 'ALARM':
            // Siren
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
            osc.frequency.linearRampToValueAtTime(800, now + 0.4);
             osc.frequency.linearRampToValueAtTime(1200, now + 0.6);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.8);
            osc.start(now);
            osc.stop(now + 0.8);
            break;
        case 'CHIME':
            // Bell
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, now);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
            osc.start(now);
            osc.stop(now + 2);
            break;
        case 'BASS_DROP':
            // Deep sub drop
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 1);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.linearRampToValueAtTime(0, now + 1.2);
            osc.start(now);
            osc.stop(now + 1.2);
            break;
    }
}
