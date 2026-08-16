import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { type DownloadTask } from "expo-file-system";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { setLastModel } from "../src/lib/chatStore";
import { bytesToGB, getCompatibilityForSize, getDeviceRamBytes, recommendedContextTokens } from "../src/lib/device";
import { createDraftChat } from "../src/lib/draftChat";
import type { CompatTier } from "../src/constants/models";
import { getHFModelFiles, type HFGgufFile } from "../src/lib/huggingface";
import { deleteDownloadedModel, isDownloaded, localFileFor, startDownload } from "../src/lib/modelStore";
import { getModelSettings } from "../src/lib/modelSettings";
import type { ThemeColors } from "../src/theme";

type DownloadState = "idle" | "downloading" | "downloaded";
interface RowState {
  state: DownloadState;
  progress: number;
}

function compatLabel(tier: CompatTier) {
  if (tier === "green") return "Runs comfortably";
  if (tier === "yellow") return "May run slowly";
  return "Likely to crash";
}

function compatColor(tier: CompatTier, colors: ThemeColors) {
  if (tier === "green") return "#2e7d32";
  if (tier === "yellow") return "#b26a00";
  return colors.danger;
}

function formatMB(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export default function ModelDetailScreen() {
  const { repoId } = useLocalSearchParams<{ repoId: string }>();
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [files, setFiles] = useState<HFGgufFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceRamBytes, setDeviceRamBytes] = useState<number | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const downloadTasks = useRef<Record<string, DownloadTask>>({});

  useEffect(() => {
    getDeviceRamBytes().then(setDeviceRamBytes);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getHFModelFiles(repoId)
      .then((found) => {
        if (cancelled) return;
        setFiles(found);
        const initial: Record<string, RowState> = {};
        for (const file of found) {
          initial[file.filename] = { state: isDownloaded(file) ? "downloaded" : "idle", progress: 0 };
        }
        setRows(initial);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message ?? err));
      });
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  function handleDownload(file: HFGgufFile) {
    setRows((prev) => ({ ...prev, [file.filename]: { state: "downloading", progress: 0 } }));
    const { task, promise } = startDownload(file, (fraction) => {
      setRows((prev) => ({ ...prev, [file.filename]: { state: "downloading", progress: fraction } }));
    });
    downloadTasks.current[file.filename] = task;
    promise
      .then((result) => {
        delete downloadTasks.current[file.filename];
        if (!result) return;
        setRows((prev) => ({ ...prev, [file.filename]: { state: "downloaded", progress: 1 } }));
      })
      .catch((err) => {
        delete downloadTasks.current[file.filename];
        setRows((prev) => ({ ...prev, [file.filename]: { state: "idle", progress: 0 } }));
        if (task.state !== "cancelled") {
          Alert.alert("Download failed", String(err?.message ?? err));
        }
      });
  }

  function handleCancel(file: HFGgufFile) {
    downloadTasks.current[file.filename]?.cancel();
  }

  function handleDelete(file: HFGgufFile) {
    deleteDownloadedModel(file);
    setRows((prev) => ({ ...prev, [file.filename]: { state: "idle", progress: 0 } }));
  }

  async function handleLoad(file: HFGgufFile) {
    const path = localFileFor(file.filename).uri;
    const settings = await getModelSettings(path);
    const contextSize = recommendedContextTokens(deviceRamBytes ?? 4 * 1024 ** 3, 2048);
    const fullModel = {
      path,
      label: `${repoId} (${file.quant})`,
      contextSize,
      ...settings,
    };
    await setLastModel(fullModel);
    const draft = createDraftChat(fullModel);
    router.replace({ pathname: "/chat/[id]", params: { id: draft.id } });
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!files) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.repoTitle}>{repoId}</Text>
      <Text style={styles.subtitle}>
        {deviceRamBytes
          ? `Your device has ~${bytesToGB(deviceRamBytes).toFixed(1)} GB RAM`
          : "Checking device RAM…"}
      </Text>

      <FlatList
        data={files}
        keyExtractor={(f) => f.filename}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        renderItem={({ item }) => {
          const row = rows[item.filename] ?? { state: "idle", progress: 0 };
          const tier = getCompatibilityForSize(item.sizeBytes, deviceRamBytes ?? 4 * 1024 ** 3);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.quant}
                </Text>
                <Text style={[styles.badge, { color: compatColor(tier, colors) }]} numberOfLines={1}>
                  {compatLabel(tier)}
                </Text>
              </View>
              <Text style={styles.cardMeta}>{formatMB(item.sizeBytes)}</Text>

              {row.state === "downloading" && (
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(row.progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>{Math.round(row.progress * 100)}%</Text>
                </View>
              )}

              <View style={styles.actions}>
                {row.state === "idle" && (
                  <Pressable style={styles.button} onPress={() => handleDownload(item)}>
                    <Text style={styles.buttonText}>Download</Text>
                  </Pressable>
                )}
                {row.state === "downloading" && (
                  <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => handleCancel(item)}>
                    <Text style={styles.buttonSecondaryText}>Cancel</Text>
                  </Pressable>
                )}
                {row.state === "downloaded" && (
                  <>
                    <Pressable style={styles.button} onPress={() => handleLoad(item)}>
                      <Text style={styles.buttonText}>Load</Text>
                    </Pressable>
                    <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => handleDelete(item)}>
                      <Text style={styles.buttonSecondaryText}>Delete</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No .gguf files found in this repo.</Text>}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: 24 },
    errorText: { color: colors.danger, textAlign: "center" },
    repoTitle: { fontSize: 16, fontWeight: "700", color: colors.text, paddingHorizontal: 16, paddingTop: 12 },
    subtitle: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 4 },
    emptyText: { color: colors.textSecondary, padding: 16 },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
    cardTitle: { fontSize: 16, fontWeight: "600", color: colors.text, flexShrink: 1 },
    badge: { fontSize: 12, fontWeight: "600", flexShrink: 0 },
    cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 6, opacity: 0.8 },
    progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    progressTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: colors.primary },
    progressLabel: { fontSize: 12, color: colors.textSecondary, width: 36, textAlign: "right" },
    actions: { flexDirection: "row", gap: 8, marginTop: 12 },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 90,
    },
    buttonText: { color: colors.primaryText, fontWeight: "600" },
    buttonSecondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    buttonSecondaryText: { color: colors.danger, fontWeight: "600" },
  });
}
