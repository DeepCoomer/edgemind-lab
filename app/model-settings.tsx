import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useThemeColors } from "../src/hooks/useThemeColors";
import {
  DEFAULT_MODEL_SETTINGS,
  getModelSettings,
  saveModelSettings,
  type ModelSettings,
} from "../src/lib/modelSettings";
import type { ThemeColors } from "../src/theme";

export default function ModelSettingsScreen() {
  const { path, label } = useLocalSearchParams<{ path: string; label: string }>();
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [settings, setSettings] = useState<ModelSettings>(DEFAULT_MODEL_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getModelSettings(path).then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, [path]);

  async function handleSave() {
    await saveModelSettings(path, settings);
    router.back();
  }

  function handleReset() {
    setSettings(DEFAULT_MODEL_SETTINGS);
  }

  function stepper(
    key: "temperature" | "topP" | "topK" | "maxTokens",
    title: string,
    hint: string,
    step: number,
    min: number,
    max: number,
    decimals: number
  ) {
    const value = settings[key];
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{title}</Text>
        <Text style={styles.fieldHint}>{hint}</Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperButton}
            onPress={() =>
              setSettings((prev) => ({
                ...prev,
                [key]: Math.max(min, +(prev[key] - step).toFixed(decimals)),
              }))
            }
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.stepperValue}>{value.toFixed(decimals)}</Text>
          <Pressable
            style={styles.stepperButton}
            onPress={() =>
              setSettings((prev) => ({
                ...prev,
                [key]: Math.min(max, +(prev[key] + step).toFixed(decimals)),
              }))
            }
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>
    );
  }

  if (!loaded) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen
        options={{
          title: label ?? "Model settings",
          headerRight: () => (
            <Pressable onPress={handleSave} hitSlop={8}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>System prompt</Text>
          <Text style={styles.fieldHint}>
            Sets the model's personality and instructions. Applied to new chats with this model.
          </Text>
          <TextInput
            style={styles.textArea}
            value={settings.systemPrompt}
            onChangeText={(text) => setSettings((prev) => ({ ...prev, systemPrompt: text }))}
            placeholder="e.g. You are a concise, friendly assistant."
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={4}
          />
        </View>

        {stepper("temperature", "Temperature", "Higher = more creative/random, lower = more focused.", 0.1, 0, 2, 1)}
        {stepper("topP", "Top-p", "Nucleus sampling cutoff.", 0.05, 0, 1, 2)}
        {stepper("topK", "Top-k", "Number of top tokens considered at each step.", 5, 0, 100, 0)}
        {stepper("maxTokens", "Max response length", "Maximum tokens generated per reply.", 64, 32, 2048, 0)}

        <Pressable style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetText}>Reset to defaults</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    field: { marginBottom: 24 },
    fieldLabel: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 2 },
    fieldHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 10 },
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      minHeight: 90,
      textAlignVertical: "top",
      color: colors.text,
      backgroundColor: colors.surface,
    },
    stepperRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    stepperButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    stepperValue: { fontSize: 16, fontWeight: "600", color: colors.text, minWidth: 56, textAlign: "center" },
    resetButton: { alignItems: "center", paddingVertical: 12 },
    resetText: { color: colors.danger, fontWeight: "600" },
    saveText: { color: colors.primary, fontWeight: "700", fontSize: 16, marginRight: 4 },
  });
}
