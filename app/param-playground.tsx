import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import type { LlamaContext } from "llama.rn";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { loadModel, prepareForConversation } from "../src/lib/llamaContext";
import { deleteModelFile, listDownloadedModels, type DownloadedModel } from "../src/lib/modelStore";
import type { ThemeColors } from "../src/theme";

const PLAYGROUND_ID = "param-playground";

interface Params {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
}

const DEFAULT_PARAMS: Params = { temperature: 0.7, topP: 0.9, topK: 40, maxTokens: 256 };

interface Stats {
  tokensPredicted: number;
  tokensPerSecond: number;
  promptMs: number;
  predictedMs: number;
}

function Stepper({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  colors,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  colors: ThemeColors;
}) {
  const styles = createStyles(colors);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable style={styles.stepperButton} onPress={() => onChange(clamp(value - step))}>
          <Ionicons name="remove" size={16} color={colors.text} />
        </Pressable>
        <Text style={styles.stepperValue}>{format ? format(value) : value.toString()}</Text>
        <Pressable style={styles.stepperButton} onPress={() => onChange(clamp(value + step))}>
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

export default function ParamPlaygroundScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [downloaded, setDownloaded] = useState<(DownloadedModel & { label: string })[]>([]);
  const [selected, setSelected] = useState<(DownloadedModel & { label: string }) | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const contextRef = useRef<LlamaContext | null>(null);

  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setDownloaded(listDownloadedModels());
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setModelReady(false);
    setLoadError(null);
    setLoadProgress(0);
    loadModel(selected.path, 2048, (progress) => {
      if (!cancelled) setLoadProgress(progress);
    })
      .then(async (ctx) => {
        if (cancelled) return;
        await prepareForConversation(PLAYGROUND_ID);
        contextRef.current = ctx;
        setModelReady(true);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(String(error?.message ?? error));
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.path]);

  function updateParam<K extends keyof Params>(key: K, value: number) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  function handleDeleteModel(model: DownloadedModel & { label: string }) {
    Alert.alert("Remove model?", `Deletes "${model.label}" from this device.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          deleteModelFile(model.path);
          setDownloaded((prev) => prev.filter((m) => m.path !== model.path));
          if (selected?.path === model.path) setSelected(null);
        },
      },
    ]);
  }

  async function handleGenerate() {
    if (!contextRef.current || !prompt.trim() || running) return;
    setOutput("");
    setStats(null);
    setRunning(true);
    try {
      await prepareForConversation(PLAYGROUND_ID);
      const result = await contextRef.current.completion(
        {
          messages: [{ role: "user", content: prompt.trim() }],
          n_predict: params.maxTokens,
          temperature: params.temperature,
          top_p: params.topP,
          top_k: params.topK,
        },
        (data) => {
          setOutput((prev) => data.accumulated_text ?? prev + (data.token ?? ""));
        }
      );
      setStats({
        tokensPredicted: result.tokens_predicted,
        tokensPerSecond: result.timings.predicted_per_second,
        promptMs: result.timings.prompt_ms,
        predictedMs: result.timings.predicted_ms,
      });
    } catch (error: any) {
      setOutput(`Error: ${String(error?.message ?? error)}`);
    } finally {
      setRunning(false);
    }
  }

  function handleStop() {
    contextRef.current?.stopCompletion();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Live Tuning" }} />

      <Text style={styles.sectionLabel}>Model</Text>
      {downloaded.length === 0 ? (
        <Text style={styles.emptyText}>No downloaded models yet — get one from Models first.</Text>
      ) : (
        <View style={styles.chipsRow}>
          {downloaded.map((model) => {
            const active = selected?.path === model.path;
            return (
              <Pressable
                key={model.path}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelected(model)}
                onLongPress={() => handleDeleteModel(model)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {model.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {downloaded.length > 0 && <Text style={styles.hintText}>Long-press a model to remove it</Text>}

      {selected && !modelReady && !loadError && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading {selected.label}… {Math.round(loadProgress)}%</Text>
        </View>
      )}
      {loadError && <Text style={styles.errorText}>Failed to load: {loadError}</Text>}

      <Text style={styles.sectionLabel}>Parameters</Text>
      <View style={styles.paramsCard}>
        <Stepper label="Temperature" value={params.temperature} min={0} max={2} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => updateParam("temperature", v)} colors={colors} />
        <Stepper label="Top-p" value={params.topP} min={0.05} max={1} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => updateParam("topP", v)} colors={colors} />
        <Stepper label="Top-k" value={params.topK} min={1} max={100} step={1} onChange={(v) => updateParam("topK", v)} colors={colors} />
        <Stepper label="Max tokens" value={params.maxTokens} min={32} max={1024} step={32} onChange={(v) => updateParam("maxTokens", v)} colors={colors} />
      </View>

      <Text style={styles.sectionLabel}>Prompt</Text>
      <TextInput
        style={styles.textArea}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Type a prompt, then tweak parameters and regenerate to compare…"
        placeholderTextColor={colors.placeholder}
        multiline
        numberOfLines={4}
      />

      {running ? (
        <Pressable style={[styles.primaryButton, styles.stopButton]} onPress={handleStop}>
          <Text style={styles.primaryButtonText}>Stop</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.primaryButton, (!modelReady || !prompt.trim()) && styles.primaryButtonDisabled]}
          onPress={handleGenerate}
          disabled={!modelReady || !prompt.trim()}
        >
          <Text style={styles.primaryButtonText}>Generate</Text>
        </Pressable>
      )}

      {output.length > 0 && (
        <View style={styles.outputCard}>
          <Text style={styles.outputLabel}>Output</Text>
          <Text style={styles.outputText} selectable>
            {output}
          </Text>
          {stats && (
            <View style={styles.statsRow}>
              <Text style={styles.statsText}>{stats.tokensPredicted} tokens</Text>
              <Text style={styles.statsText}>·</Text>
              <Text style={styles.statsText}>{stats.tokensPerSecond.toFixed(1)} tok/s</Text>
              <Text style={styles.statsText}>·</Text>
              <Text style={styles.statsText}>{(stats.promptMs + stats.predictedMs).toFixed(0)} ms total</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      marginTop: 20,
      marginBottom: 8,
    },
    emptyText: { fontSize: 13, color: colors.textSecondary },
    hintText: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: "100%",
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: "600", color: colors.text },
    chipTextActive: { color: colors.primaryText },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
    loadingText: { color: colors.textSecondary, fontSize: 13 },
    errorText: { color: colors.danger, marginTop: 10, fontSize: 13 },
    paramsCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      backgroundColor: colors.surface,
      gap: 12,
    },
    stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    stepperLabel: { fontSize: 14, color: colors.text, fontWeight: "500" },
    stepperControls: { flexDirection: "row", alignItems: "center", gap: 12 },
    stepperButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    stepperValue: { fontSize: 14, color: colors.text, minWidth: 40, textAlign: "center", fontVariant: ["tabular-nums"] },
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      minHeight: 100,
      textAlignVertical: "top",
      color: colors.text,
      backgroundColor: colors.surface,
    },
    primaryButton: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 16 },
    primaryButtonDisabled: { opacity: 0.4 },
    stopButton: { backgroundColor: colors.danger },
    primaryButtonText: { color: colors.primaryText, fontWeight: "700" },
    outputCard: {
      marginTop: 20,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 14,
      backgroundColor: colors.surface,
    },
    outputLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 8, textTransform: "uppercase" },
    outputText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    statsRow: { flexDirection: "row", gap: 6, marginTop: 12, flexWrap: "wrap" },
    statsText: { fontSize: 11.5, color: colors.textSecondary },
  });
}
