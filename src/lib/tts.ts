import * as Speech from "expo-speech";

let activeId: string | null = null;

/** Speaks text aloud via the OS's built-in TTS engine. Only one utterance plays at a time — starting a new one stops any other. */
export function speak(id: string, text: string, onDone: () => void) {
  Speech.stop();
  activeId = id;
  Speech.speak(text, {
    onDone: () => {
      if (activeId === id) activeId = null;
      onDone();
    },
    onStopped: () => {
      if (activeId === id) activeId = null;
      onDone();
    },
    onError: () => {
      if (activeId === id) activeId = null;
      onDone();
    },
  });
}

export function stopSpeaking() {
  Speech.stop();
  activeId = null;
}
