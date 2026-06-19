let audioCtx;
let muted = false;

const getCtx = () => (audioCtx ??= new (window.AudioContext || window.webkitAudioContext)());

export function setMuted(value) { muted = value; }
export function isMuted() { return muted; }

export function unlockAudio() {
  const ctx = getCtx();
  // Iniciar o nó ANTES de resume() — iOS exige que o audio node seja
  // criado e iniciado sincronamente dentro do handler do gesto do usuário.
  // ctx.resume() é async mas não precisa ser aguardado: o nó toca assim
  // que o contexto transita para "running".
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, 22050);
  src.connect(ctx.destination);
  src.start(0);
  if (ctx.state === 'suspended') ctx.resume();
}

export function playTap() {
  if (muted) return;
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 880;
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
  osc.connect(g).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

export function blip(freq, dur = 0.08, type = 'square') {
  if (muted) return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {
    // áudio indisponível — ignora
  }
}
