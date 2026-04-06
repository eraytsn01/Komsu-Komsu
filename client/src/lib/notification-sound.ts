import type { NotificationSound } from "@/hooks/use-notification-settings";

let audioCtx: AudioContext | null = null;

function getCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function beep(freq: number, duration: number, startAt = 0, volume = 0.08) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime + startAt;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playNotificationSound(sound: NotificationSound) {
  try {
    if (sound === "beep") {
      beep(720, 0.15);
      return;
    }
    if (sound === "bell") {
      beep(920, 0.12);
      beep(1240, 0.2, 0.08, 0.06);
      return;
    }
    // chime
    beep(660, 0.12);
    beep(880, 0.14, 0.1, 0.07);
    beep(990, 0.18, 0.2, 0.06);
  } catch {
    // noop
  }
}

/**
 * Acil durum sireni — kullanıcı ayarlarından bağımsız, sabit ve değiştirilemez.
 * Yalnızca acil durumu GÖRENLERE çalınır, tetikleyene değil.
 */
export function playEmergencyAlarm() {
  try {
    const ctx = getCtx();
    // AudioContext askiya alınmışsa uyandır (mobile tarayıcı uyumu)
    if (ctx.state === "suspended") ctx.resume();

    const totalDuration = 4.0; // saniye
    const now = ctx.currentTime;

    // --- Siren osilatörü ---
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 880;

    // LFO: frekansı 880±440 Hz arasında 3 Hz hızında sallıyor
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 3;
    lfoGain.gain.value = 440;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Ses seviyesi zarfi
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.38, now + 0.08);
    gain.gain.setValueAtTime(0.38, now + totalDuration - 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + totalDuration);
    osc.stop(now + totalDuration);

    // --- Tiz vurgu bipleri (dikkat çekici) ---
    const beepTimes = [0.0, 0.55, 1.1, 1.65, 2.2, 2.75, 3.3];
    beepTimes.forEach((offset) => {
      beep(1400, 0.08, offset, 0.18);
    });
  } catch {
    // noop
  }
}
