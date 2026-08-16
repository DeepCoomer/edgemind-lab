import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { loadModel, prepareForConversation } from "../src/lib/llamaContext";
import { deleteModelFile, listDownloadedModels, type DownloadedModel } from "../src/lib/modelStore";
import type { ThemeColors } from "../src/theme";

type Model = DownloadedModel & { label: string };

interface RunResult {
  output: string;
  tokensPerSecond: number;
  tokensPredicted: number;
  totalMs: number;
}

type Stage = "idle" | "loading-a" | "generating-a" | "loading-b" | "generating-b" | "done";

const COMPARE_ID = "model-compare";

function ModelPicker({
  label,
  models,
  selected,
  onSelect,
  onDelete,
  colors,
}: {
  label: string;
  models: Model[];
  selected: Model | null;
  onSelect: (m: Model) => void;
  onDelete: (m: Model) => void;
  colors: ThemeColors;
}) {
  const styles = createStyles(colors);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chipsRow}>
        {models.map((model) => {
          const active = selected?.path === model.path;
          return (
            <Pressable
              key={model.path}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(model)}
              onLongPress={() => onDelete(model)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {model.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ResultCard({ label, result, colors }: { label: string; result: RunResult | null; colors: ThemeColors }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultLabel}>{label}</Text>
      {result ? (
        <>
          <Text style={styles.outputText} selectable>
            {result.output || "(empty response)"}
          </Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsText}>{result.tokensPredicted} tokens</Text>
            <Text style={styles.statsText}>·</Text>
            <Text style={styles.statsText}>{result.tokensPerSecond.toFixed(1)} tok/s</Text>
            <Text style={styles.statsText}>·</Text>
            <Text style={styles.statsText}>{result.totalMs.toFixed(0)} ms</Text>
          </View>
        </>
      ) : (
        <Text style={styles.pendingText}>Waiting…</Text>
      )}
    </View>
  );
}

export default function ModelCompareScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [downloaded, setDownloaded] = useState<Model[]>([]);
  const [modelA, setModelA] = useState<Model | null>(null);
  const [modelB, setModelB] = useState<Model | null>(null);
  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [resultA, setResultA] = useState<RunResult | null>(null);
  const [resultB, setResultB] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const models = listDownloadedModels();
    setDownloaded(models);
    if (models.length >= 1) setModelA(models[0]);
    if (models.length >= 2) setModelB(models[1]);
  }, []);

  function handleDeleteModel(model: Model) {
    Alert.alert("Remove model?", `Deletes "${model.label}" from this device.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          deleteModelFile(model.path);
          setDownloaded((prev) => prev.filter((m) => m.path !== model.path));
          if (modelA?.path === model.path) setModelA(null);
          if (modelB?.path === model.path) setModelB(null);
        },
      },
    ]);
  }

  async function runOne(model: Model): Promise<RunResult> {
    const ctx = await loadModel(model.path, 2048);
    await prepareForConversation(COMPARE_ID);
    const result = await ctx.completion({
      messages: [{ role: "user", content: prompt.trim() }],
      n_predict: 256,
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
    });
    return {
      output: result.content || result.text || "",
      tokensPerSecond: result.timings.predicted_per_second,
      tokensPredicted: result.tokens_predicted,
      totalMs: result.timings.prompt_ms + result.timings.predicted_ms,
    };
  }

  async function handleRun() {
    if (!modelA || !modelB || !prompt.trim()) return;
    setError(null);
    setResultA(null);
    setResultB(null);
    try {
      setStage("loading-a");
      setStage("generating-a");
      const a = await runOne(modelA);
      setResultA(a);

      setStage("loading-b");
      setStage("generating-b");
      const b = await runOne(modelB);
      setResultB(b);

      setStage("done");
    } catch (err: any) {
      setError(String(err?.message ?? err));
      setStage("idle");
    }
  }

  const running = stage !== "idle" && stage !== "done";
  const canRun = !!modelA && !!modelB && modelA.path !== modelB.path && prompt.trim().length > 0 && !running;

  const stageLabel: Record<Stage, string> = {
    idle: "",
    "loading-a": "Loading Model A…",
    "generating-a": "Generating with Model A…",
    "loading-b": "Loading Model B…",
    "generating-b": "Generating with Model B…",
    done: "Done",
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Model Compare" }} />

      {downloaded.length < 2 ? (
        <Text style={styles.emptyText}>Download at least two models to compare them side by side.</Text>
      ) : (
        <>
          <ModelPicker label="Model A" models={downloaded} selected={modelA} onSelect={setModelA} onDelete={handleDeleteModel} colors={colors} />
          <ModelPicker label="Model B" models={downloaded} selected={modelB} onSelect={setModelB} onDelete={handleDeleteModel} colors={colors} />
          <Text style={styles.hintText}>Long-press a model to remove it</Text>
          {modelA && modelB && modelA.path === modelB.path && (
            <Text style={styles.errorText}>Pick two different models to compare.</Text>
          )}

          <Text style={styles.sectionLabel}>Prompt</Text>
          <TextInput
            style={styles.textArea}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Ask the same question to both models…"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={3}
          />

          <Pressable style={[styles.primaryButton, !canRun && styles.primaryButtonDisabled]} onPress={handleRun} disabled={!canRun}>
            {running ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryButtonText}>Run comparison</Text>}
          </Pressable>

          {running && <Text style={styles.stageText}>{stageLabel[stage]}</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {(resultA || resultB || running) && (
            <View style={{ marginTop: 20, gap: 12 }}>
              <ResultCard label={modelA?.label ?? "Model A"} result={resultA} colors={colors} />
              <ResultCard label={modelB?.label ?? "Model B"} result={resultB} colors={colors} />
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    emptyText: { fontSize: 13, color: colors.textSecondary, padding: 4 },
    hintText: { fontSize: 11, color: colors.textSecondary, marginTop: -4, marginBottom: 12 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      marginBottom: 8,
    },
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
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      minHeight: 80,
      textAlignVertical: "top",
      color: colors.text,
      backgroundColor: colors.surface,
      marginTop: 4,
    },
    primaryButton: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 16 },
    primaryButtonDisabled: { opacity: 0.4 },
    primaryButtonText: { color: colors.primaryText, fontWeight: "700" },
    stageText: { fontSize: 12.5, color: colors.textSecondary, textAlign: "center", marginTop: 10 },
    errorText: { color: colors.danger, fontSize: 12.5, marginTop: 8 },
    resultCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 14,
      backgroundColor: colors.surface,
    },
    resultLabel: { fontSize: 12, fontWeight: "700", color: colors.primary, marginBottom: 8, textTransform: "uppercase" },
    outputText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    pendingText: { fontSize: 13, color: colors.textSecondary, fontStyle: "italic" },
    statsRow: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
    statsText: { fontSize: 11.5, color: colors.textSecondary },
  });
}
