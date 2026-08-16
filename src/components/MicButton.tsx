import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet } from "react-native";
import { WHISPER_MODEL } from "../constants/whisperModel";
import { cancelRecording, startRecording, stopRecording } from "../lib/audioRecorder";
import { useThemeColors } from "../hooks/useThemeColors";
import { isDownloaded, localFileFor, startDownload } from "../lib/modelStore";
import { loadWhisperModel, transcribeFile } from "../lib/whisperContext";
import type { ThemeColors } from "../theme";

type State = "idle" | "downloading" | "recording" | "transcribing";

const ACCURACY_NOTICE_SHOWN_KEY = "edgemind:voiceAccuracyNoticeShown";

export default function MicButton({ onTranscribed, size = 20 }: { onTranscribed: (text: string) => void; size?: number }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [state, setState] = useState<State>("idle");

  useEffect(() => cancelRecording, []);

  async function maybeShowAccuracyNotice() {
    const shown = await AsyncStorage.getItem(ACCURACY_NOTICE_SHOWN_KEY);
    if (shown) return;
    await AsyncStorage.setItem(ACCURACY_NOTICE_SHOWN_KEY, "1");
    Alert.alert(
      "Double-check the transcript",
      "Voice input uses a small on-device model, so it can mishear words — review the text before sending."
    );
  }

  function ensureModelDownloaded(): Promise<boolean> {
    if (isDownloaded(WHISPER_MODEL)) return Promise.resolve(true);
    return new Promise((resolve) => {
      Alert.alert(
        "Download voice model?",
        `One-time download (~${Math.round(WHISPER_MODEL.sizeBytes / 1024 / 1024)} MB) to enable voice input. ` +
          "This is a small on-device model chosen to fit older phones, so transcription won't be as accurate as cloud voice assistants — expect occasional mistakes, especially with accents or background noise.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Download",
            onPress: () => {
              setState("downloading");
              const { promise } = startDownload(WHISPER_MODEL, () => {});
              promise.then((result) => resolve(!!result)).catch(() => resolve(false));
            },
          },
        ]
      );
    });
  }

  async function handlePress() {
    if (state === "downloading" || state === "transcribing") return;

    if (state === "recording") {
      setState("transcribing");
      try {
        const uri = await stopRecording();
        if (!uri) {
          setState("idle");
          return;
        }
        await loadWhisperModel(localFileFor(WHISPER_MODEL.filename).uri);
        const text = await transcribeFile(uri);
        if (text) {
          onTranscribed(text);
          maybeShowAccuracyNotice();
        }
      } catch (err: any) {
        Alert.alert("Transcription failed", String(err?.message ?? err));
      } finally {
        setState("idle");
      }
      return;
    }

    const ready = await ensureModelDownloaded();
    if (!ready) {
      setState("idle");
      return;
    }
    try {
      await startRecording();
      setState("recording");
    } catch (err: any) {
      Alert.alert("Couldn't start recording", String(err?.message ?? err));
      setState("idle");
    }
  }

  const busy = state === "downloading" || state === "transcribing";

  return (
    <Pressable style={styles.button} onPress={handlePress} hitSlop={8}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <Ionicons
          name={state === "recording" ? "stop-circle" : "mic-outline"}
          size={size}
          color={state === "recording" ? colors.danger : colors.text}
        />
      )}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  });
}
