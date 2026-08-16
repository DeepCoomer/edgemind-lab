import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { addSource } from "../src/lib/sourcesStore";
import { scanTextFromImage, type ScanSource } from "../src/lib/ocr";
import type { ThemeColors } from "../src/theme";

export default function ScanTextScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [scanning, setScanning] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleScan(source: ScanSource) {
    setScanning(true);
    try {
      const result = await scanTextFromImage(source);
      if (result === null) return;
      if (result.length === 0) {
        Alert.alert("No text found", "Couldn't find any readable text in that image.");
        return;
      }
      setText(result);
    } catch (err: any) {
      Alert.alert("Scan failed", String(err?.message ?? err));
    } finally {
      setScanning(false);
    }
  }

  function handleUseInQuickActions() {
    router.push({ pathname: "/tasks", params: { sharedText: text } });
  }

  async function handleSaveAsSource() {
    setSaving(true);
    try {
      await addSource("Scanned text", text);
      Alert.alert("Saved", "Added to Sources.", [{ text: "OK", onPress: () => router.push("/lab-sources") }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Scan Text" }} />

      <View style={styles.buttonsRow}>
        <Pressable style={styles.scanButton} onPress={() => handleScan("camera")} disabled={scanning}>
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
          <Text style={styles.scanButtonText}>Take photo</Text>
        </Pressable>
        <Pressable style={styles.scanButton} onPress={() => handleScan("library")} disabled={scanning}>
          <Ionicons name="images-outline" size={22} color={colors.primary} />
          <Text style={styles.scanButtonText}>Choose photo</Text>
        </Pressable>
      </View>

      {scanning && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Reading text…</Text>
        </View>
      )}

      {text.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Recognized text</Text>
          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={10}
            placeholderTextColor={colors.placeholder}
          />
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionButton} onPress={handleUseInQuickActions}>
              <Text style={styles.actionButtonText}>Use in Quick Actions</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleSaveAsSource} disabled={saving}>
              <Text style={styles.actionButtonSecondaryText}>{saving ? "Saving…" : "Save as Source"}</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    buttonsRow: { flexDirection: "row", gap: 10 },
    scanButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    scanButtonText: { fontSize: 13, fontWeight: "600", color: colors.text },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, justifyContent: "center" },
    loadingText: { color: colors.textSecondary, fontSize: 13 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      marginTop: 24,
      marginBottom: 8,
    },
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      minHeight: 160,
      textAlignVertical: "top",
      color: colors.text,
      backgroundColor: colors.surface,
    },
    actionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    actionButton: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    actionButtonText: { color: colors.primaryText, fontWeight: "700", fontSize: 13 },
    actionButtonSecondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    actionButtonSecondaryText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  });
}
