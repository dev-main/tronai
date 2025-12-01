
// Audio Context Singleton
let audioCtx: AudioContext | null = null;
let bgmNodes: AudioScheduledSourceNode[] = [];
let bgmGainNode: GainNode | null = null;
let isMuted = false;
let nextNoteTime = 0;
let schedulerTimer: number | null = null;

// Calm C Minor 9th Arpeggio pattern
const NOTES = [
  261.63, // C4
  311.13, // Eb4
  392.00, // G4
  466.16, // Bb4
  587.33, // D5
  466.16, // Bb4
  392.00, // G4
  311.13, // Eb4
];

const BASS_FREQ = 65.41; // C2

export const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const setMute = (mute: boolean) => {
  isMuted = mute;
  if (audioCtx && bgmGainNode) {
    const targetGain = mute ? 0 : 0.08;
    bgmGainNode.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.2);
  }
};

const createOscillator = (type: OscillatorType, freq: number, startTime: number, duration: number, vol: number) => {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.value = freq;
  
  // Envelope
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(vol, startTime + 0.1); // Attack
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Decay
  
  osc.connect(gain);
  gain.connect(isMuted || !bgmGainNode ? audioCtx.destination : bgmGainNode);
  
  // If BGM Gain exists (music), connect through it for global BGM volume control. 
  // SFX usually bypass this specific BGM gain node or have their own.
  // For this simple implementation, we'll route everything to destination but check isMuted manually for SFX.
  
  osc.start(startTime);
  osc.stop(startTime + duration);
};

// --- SFX ---

export const playTurnSound = () => {
  if (isMuted || !audioCtx) return;
  
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
  
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
};

export const playCrashSound = () => {
  if (isMuted || !audioCtx) return;

  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  // Use sawtooth for a rougher sound
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
  
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.5);
};

export const playGameStartSound = () => {
  if (isMuted || !audioCtx) return;
  
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.linearRampToValueAtTime(880, t + 0.6);
  
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
  gain.gain.linearRampToValueAtTime(0, t + 0.6);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.6);
};

// --- BGM Scheduler ---

const scheduleNote = (noteIndex: number, time: number) => {
  if (!audioCtx || !bgmGainNode) return;

  // Melody
  const freq = NOTES[noteIndex % NOTES.length];
  // Add some random octave variation for ambiance
  const finalFreq = Math.random() > 0.8 ? freq * 2 : freq;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.value = finalFreq;
  
  // Softer envelope for calm feel
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.1, time + 0.5);
  gain.gain.linearRampToValueAtTime(0, time + 2.0); // Long tail
  
  osc.connect(gain);
  gain.connect(bgmGainNode);
  
  osc.start(time);
  osc.stop(time + 2.5);
  bgmNodes.push(osc);

  // Bass Drone (Reinforce every 8 notes)
  if (noteIndex % 8 === 0) {
    const bassOsc = audioCtx.createOscillator();
    const bassGain = audioCtx.createGain();
    bassOsc.type = 'triangle';
    bassOsc.frequency.value = BASS_FREQ;
    
    bassGain.gain.setValueAtTime(0, time);
    bassGain.gain.linearRampToValueAtTime(0.15, time + 1);
    bassGain.gain.linearRampToValueAtTime(0, time + 6);
    
    bassOsc.connect(bassGain);
    bassGain.connect(bgmGainNode);
    bassOsc.start(time);
    bassOsc.stop(time + 6);
    bgmNodes.push(bassOsc);
  }
};

const scheduler = () => {
  if (!audioCtx) return;
  // Schedule ahead
  while (nextNoteTime < audioCtx.currentTime + 0.1) {
    scheduleNote(Math.floor(nextNoteTime * 2), nextNoteTime); // Use time as index seed roughly
    nextNoteTime += 0.5; // 120 BPM ish (0.5s per note)
  }
  schedulerTimer = window.setTimeout(scheduler, 25);
};

export const startBGM = () => {
  initAudio();
  if (!audioCtx || schedulerTimer) return;

  // Master Gain for BGM
  bgmGainNode = audioCtx.createGain();
  bgmGainNode.gain.value = isMuted ? 0 : 0.08; // Low volume for background
  bgmGainNode.connect(audioCtx.destination);

  nextNoteTime = audioCtx.currentTime + 0.1;
  scheduler();
};

export const stopBGM = () => {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  bgmNodes.forEach(n => {
    try { n.stop(); } catch(e) {}
  });
  bgmNodes = [];
  if (bgmGainNode) {
    bgmGainNode.disconnect();
    bgmGainNode = null;
  }
};
