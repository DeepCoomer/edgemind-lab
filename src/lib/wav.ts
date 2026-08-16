const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Decodes a base64 string to raw bytes without relying on a global atob/Buffer polyfill. */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_CHARS.indexOf(clean[i]);
    const c1 = BASE64_CHARS.indexOf(clean[i + 1]);
    const c2 = clean[i + 2] !== undefined ? BASE64_CHARS.indexOf(clean[i + 2]) : -1;
    const c3 = clean[i + 3] !== undefined ? BASE64_CHARS.indexOf(clean[i + 3]) : -1;
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) bytes.push(((c1 & 0xf) << 4) | (c2 >> 2));
    if (c3 >= 0) bytes.push(((c2 & 0x3) << 6) | c3);
  }
  return new Uint8Array(bytes);
}

/** Wraps raw 16-bit PCM samples in a standard WAV (RIFF) header. */
export function pcm16ToWav(pcmBytes: Uint8Array, sampleRate: number, channels: number): Uint8Array {
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const dataSize = pcmBytes.length;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const wav = new Uint8Array(44 + dataSize);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcmBytes, 44);
  return wav;
}
