// @ts-expect-error - no bundled types under this package's real module name
import AudioRecord from "@fugood/react-native-audio-pcm-stream";
import { File, Paths } from "expo-file-system";
import { PermissionsAndroid, Platform } from "react-native";
import { base64ToBytes, pcm16ToWav } from "./wav";

const SAMPLE_RATE = 16000;
const CHANNELS = 1;

let chunks: Uint8Array[] = [];
let listener: { remove: () => void } | null = null;
let recording = false;

async function ensureMicPermission(): Promise<void> {
  if (Platform.OS !== "android") return;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error("Microphone permission was denied.");
  }
}

export async function startRecording(): Promise<void> {
  await ensureMicPermission();
  chunks = [];
  await AudioRecord.init({
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    bitsPerSample: 16,
    audioSource: 6, // VOICE_RECOGNITION
  });
  listener = AudioRecord.on("data", (base64Chunk: string) => {
    chunks.push(base64ToBytes(base64Chunk));
  });
  recording = true;
  AudioRecord.start();
}

/** Stops recording and writes the captured audio to a WAV file, returning its URI. Returns null if nothing was captured. */
export async function stopRecording(): Promise<string | null> {
  if (!recording) return null;
  recording = false;
  AudioRecord.stop();
  listener?.remove();
  listener = null;

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  if (totalLength === 0) return null;

  const pcm = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    pcm.set(chunk, offset);
    offset += chunk.length;
  }
  chunks = [];

  const wavBytes = pcm16ToWav(pcm, SAMPLE_RATE, CHANNELS);
  const file = new File(Paths.cache, `voice-input-${Date.now()}.wav`);
  file.create({ overwrite: true });
  file.write(wavBytes);
  return file.uri;
}

export function isRecording(): boolean {
  return recording;
}

export function cancelRecording() {
  if (!recording) return;
  recording = false;
  AudioRecord.stop();
  listener?.remove();
  listener = null;
  chunks = [];
}
