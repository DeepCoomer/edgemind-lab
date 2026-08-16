import * as ImagePicker from "expo-image-picker";
import TextRecognition from "@react-native-ml-kit/text-recognition";

export type ScanSource = "camera" | "library";

/** Opens the camera or photo library, then runs on-device OCR on the picked image. Returns null if the user cancels. */
export async function scanTextFromImage(source: ScanSource): Promise<string | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(source === "camera" ? "Camera permission was denied." : "Photo library permission was denied.");
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ["images"] });

  if (result.canceled || result.assets.length === 0) return null;

  const recognized = await TextRecognition.recognize(result.assets[0].uri);
  return recognized.text.trim();
}
