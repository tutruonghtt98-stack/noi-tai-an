"use client";

/**
 * Âm thanh tổng hợp bằng Web Audio — không cần file mp3.
 * Trình duyệt chỉ cho phát âm thanh sau khi người dùng đã tương tác với trang,
 * nên AudioContext được "mở khoá" ở lần click/phím đầu tiên (xem unlockAudio).
 */
let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  getCtx();
}

/** Một tiếng chuông mềm: sóng sine + hoạ âm, tắt dần. */
function bell(c: AudioContext, freq: number, at: number, dur = 1.2, gain = 0.22) {
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(gain, at + 0.015);
  out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  out.connect(c.destination);
  for (const [mult, g] of [
    [1, 1],
    [2, 0.35],
    [3, 0.12],
  ] as const) {
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = "sine";
    o.frequency.value = freq * mult;
    og.gain.value = g;
    o.connect(og).connect(out);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
}

/** Nhắc lịch hẹn: "ding-dong" lặp 2 lần. */
export function playReminder() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + 0.05;
  [0, 1.1].forEach((off) => {
    bell(c, 880, t + off, 0.9);
    bell(c, 659.25, t + off + 0.32, 1.1);
  });
}

/** Hoàn thành phiên tập trung: hợp âm rải đi lên (Đô – Mi – Sol – Đô). */
export function playComplete() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + 0.05;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(c, f, t + i * 0.14, 1.6, 0.2));
  bell(c, 1046.5, t + 0.75, 2.2, 0.16);
}

/** Hết giờ nghỉ: hai tiếng chuông nhẹ đi xuống. */
export function playBreakOver() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + 0.05;
  bell(c, 783.99, t, 1);
  bell(c, 587.33, t + 0.3, 1.3);
}
