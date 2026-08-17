import { Ionicons } from "@expo/vector-icons";
import { File, FileMode, type DownloadTask } from "expo-file-system";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { MODEL_CATALOG, type CompatTier, type ModelCatalogEntry } from "../constants/models";
import { useThemeColors } from "../hooks/useThemeColors";
import { bytesToGB, getCompatibility, getCompatibilityForSize, getDeviceRamBytes, recommendedContextTokens } from "../lib/device";
import {
  deleteDownloadedModel,
  deleteModelFile,
  importModelFile,
  isDownloaded,
  listDownloadedModels,
  localFileFor,
  startDownload,
  type DownloadedModel,
} from "../lib/modelStore";
import type { ThemeColors } from "../theme";

export interface ReadyModel {
  path: string;
  label: string;
  contextSize: number;
  /** Set only for vision-capable models. */
  mmprojPath?: string;
}

type DownloadState = "idle" | "downloading-model" | "downloading-mmproj" | "downloaded";

interface RowState {
  state: DownloadState;
  progress: number;
}

type OtherModel = DownloadedModel & { label: string };
type SectionItem = { kind: "catalog"; entry: ModelCatalogEntry } | { kind: "other"; entry: OtherModel };

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

function openSettings(path: string, label: string) {
  router.push({ pathname: "/model-settings", params: { path, label } });
}

function isFullyDownloaded(model: ModelCatalogEntry): boolean {
  return isDownloaded(model) && (!model.mmproj || isDownloaded(model.mmproj));
}

const SECTION_LABELS: Record<ModelCatalogEntry["capability"], string> = {
  text: "Text models",
  vision: "Vision models — can see attached images in chat",
};

export default function ModelListScreen({
  onModelReady,
}: {
  onModelReady: (model: ReadyModel) => void;
}) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [deviceRamBytes, setDeviceRamBytes] = useState<number | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [otherModels, setOtherModels] = useState<OtherModel[]>([]);
  const downloadTasks = useRef<Record<string, DownloadTask>>({});

  const refreshOtherModels = useCallback(() => {
    const catalogFilenames = new Set(MODEL_CATALOG.map((m) => m.filename));
    setOtherModels(listDownloadedModels().filter((m) => !catalogFilenames.has(m.filename)));
  }, []);

  useEffect(() => {
    getDeviceRamBytes().then(setDeviceRamBytes);
    const initial: Record<string, RowState> = {};
    for (const model of MODEL_CATALOG) {
      initial[model.id] = {
        state: isFullyDownloaded(model) ? "downloaded" : "idle",
        progress: 0,
      };
    }
    setRows(initial);
  }, []);

  // Picks up models downloaded via HF search (model-detail.tsx) or imported
  // here, whenever this screen regains focus — those flows don't share any
  // state with this one, so a plain mount-time load would go stale.
  useFocusEffect(refreshOtherModels);

  function contextSizeFor(defaultCtx: number) {
    return recommendedContextTokens(deviceRamBytes ?? 4 * 1024 ** 3, defaultCtx);
  }

  function handleDownload(model: ModelCatalogEntry) {
    setRows((prev) => ({ ...prev, [model.id]: { state: "downloading-model", progress: 0 } }));
    const { task, promise } = startDownload(model, (fraction) => {
      setRows((prev) => ({ ...prev, [model.id]: { state: "downloading-model", progress: fraction } }));
    });
    downloadTasks.current[model.id] = task;
    promise
      .then((file) => {
        delete downloadTasks.current[model.id];
        if (!file) return; // paused rather than completed — shouldn't happen from this UI
        if (!model.mmproj) {
          setRows((prev) => ({ ...prev, [model.id]: { state: "downloaded", progress: 1 } }));
          return;
        }
        // Vision models need a second, much smaller companion file.
        setRows((prev) => ({ ...prev, [model.id]: { state: "downloading-mmproj", progress: 0 } }));
        const mmprojDownload = startDownload(model.mmproj, (fraction) => {
          setRows((prev) => ({ ...prev, [model.id]: { state: "downloading-mmproj", progress: fraction } }));
        });
        downloadTasks.current[model.id] = mmprojDownload.task;
        mmprojDownload.promise
          .then((mmprojFile) => {
            delete downloadTasks.current[model.id];
            if (!mmprojFile) return;
            setRows((prev) => ({ ...prev, [model.id]: { state: "downloaded", progress: 1 } }));
          })
          .catch((error) => {
            delete downloadTasks.current[model.id];
            setRows((prev) => ({ ...prev, [model.id]: { state: "idle", progress: 0 } }));
            if (mmprojDownload.task.state !== "cancelled") {
              Alert.alert("Download failed", String(error?.message ?? error));
            }
          });
      })
      .catch((error) => {
        delete downloadTasks.current[model.id];
        setRows((prev) => ({ ...prev, [model.id]: { state: "idle", progress: 0 } }));
        if (task.state !== "cancelled") {
          Alert.alert("Download failed", String(error?.message ?? error));
        }
      });
  }

  function handleCancelDownload(model: ModelCatalogEntry) {
    downloadTasks.current[model.id]?.cancel();
  }

  function handleDelete(model: ModelCatalogEntry) {
    deleteDownloadedModel(model);
    if (model.mmproj) deleteDownloadedModel(model.mmproj);
    setRows((prev) => ({ ...prev, [model.id]: { state: "idle", progress: 0 } }));
  }

  function handleLoad(model: ModelCatalogEntry) {
    const tier = getCompatibility(model, deviceRamBytes ?? 4 * 1024 ** 3);
    const readyModel: ReadyModel = {
      path: localFileFor(model.filename).uri,
      label: model.name,
      contextSize: contextSizeFor(model.contextWindowDefault),
      mmprojPath: model.mmproj ? localFileFor(model.mmproj.filename).uri : undefined,
    };
    if (tier === "red") {
      Alert.alert(
        "This may crash",
        "Your device likely doesn't have enough RAM for this model. Load anyway?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Load anyway", style: "destructive", onPress: () => onModelReady(readyModel) },
        ]
      );
      return;
    }
    onModelReady(readyModel);
  }

  function handleLoadOther(model: OtherModel) {
    const tier = getCompatibilityForSize(model.sizeBytes, deviceRamBytes ?? 4 * 1024 ** 3);
    const readyModel: ReadyModel = {
      path: model.path,
      label: model.label,
      contextSize: contextSizeFor(2048),
      mmprojPath: model.mmprojPath,
    };
    if (tier === "red") {
      Alert.alert(
        "This may crash",
        "Your device likely doesn't have enough RAM for this model. Load anyway?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Load anyway", style: "destructive", onPress: () => onModelReady(readyModel) },
        ]
      );
      return;
    }
    onModelReady(readyModel);
  }

  function handleDeleteOther(model: OtherModel) {
    deleteModelFile(model.path);
    refreshOtherModels();
  }

  async function handleImport() {
    try {
      const result = await File.pickFileAsync({ multipleFiles: false });
      if (result.canceled || !result.result) return;
      const file = result.result;
      // Don't trust file.extension/file.name here — on Android, files picked
      // via the Downloads/Recent provider resolve to an opaque content:// URI
      // with no real filename embedded, so extension-sniffing false-positives
      // on real .gguf picks. Check the actual GGUF magic bytes instead.
      // Use a bounded FileHandle read, not file.slice()/arrayBuffer() — slice()
      // reads the ENTIRE file into memory first (OOM on multi-GB model files)
      // before slicing in JS.
      const handle = file.open(FileMode.ReadOnly);
      let header: Uint8Array;
      try {
        header = handle.readBytes(4);
      } finally {
        handle.close();
      }
      const isGguf = header[0] === 0x47 && header[1] === 0x47 && header[2] === 0x55 && header[3] === 0x46; // "GGUF"
      if (!isGguf) {
        Alert.alert("Not a .gguf file", "The picked file doesn't look like a GGUF model file.");
        return;
      }
      importModelFile(file);
      refreshOtherModels();
    } catch (error: any) {
      Alert.alert("Import failed", String(error?.message ?? error));
    }
  }

  const sections: { title: string; data: SectionItem[] }[] = (["text", "vision"] as const)
    .map((capability) => ({
      title: SECTION_LABELS[capability],
      data: MODEL_CATALOG.filter((m) => m.capability === capability).map((entry): SectionItem => ({ kind: "catalog", entry })),
    }))
    .filter((section) => section.data.length > 0);

  if (otherModels.length > 0) {
    sections.push({
      title: "From Hugging Face search or imported files",
      data: otherModels.map((entry): SectionItem => ({ kind: "other", entry })),
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        {deviceRamBytes
          ? `Your device has ~${bytesToGB(deviceRamBytes).toFixed(1)} GB RAM`
          : "Checking device RAM…"}
      </Text>

      <SectionList
        sections={sections}
        keyExtractor={(item) => (item.kind === "catalog" ? item.entry.id : item.entry.path)}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) => {
          if (item.kind === "other") {
            const model = item.entry;
            const tier = getCompatibilityForSize(model.sizeBytes, deviceRamBytes ?? 4 * 1024 ** 3);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {model.label}
                  </Text>
                  <View style={styles.cardHeaderRight}>
                    <Text style={[styles.badge, { color: compatColor(tier, colors) }]}>{compatLabel(tier)}</Text>
                    <Pressable hitSlop={8} onPress={() => openSettings(model.path, model.label)}>
                      <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.cardMeta}>{formatMB(model.sizeBytes)}</Text>
                <View style={styles.actions}>
                  <Pressable style={styles.button} onPress={() => handleLoadOther(model)}>
                    <Text style={styles.buttonText}>Load</Text>
                  </Pressable>
                  <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => handleDeleteOther(model)}>
                    <Text style={styles.buttonSecondaryText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          }

          const item_ = item.entry;
          const row = rows[item_.id] ?? { state: "idle", progress: 0 };
          const tier = getCompatibility(item_, deviceRamBytes ?? 4 * 1024 ** 3);
          const path = localFileFor(item_.filename).uri;
          const downloading = row.state === "downloading-model" || row.state === "downloading-mmproj";
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item_.name}</Text>
                <View style={styles.cardHeaderRight}>
                  <Text style={[styles.badge, { color: compatColor(tier, colors) }]}>
                    {compatLabel(tier)}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => openSettings(path, item_.name)}>
                    <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.cardDesc}>{item_.description}</Text>
              <Text style={styles.cardMeta}>
                {item_.paramCount} · {item_.quant} · {formatMB(item_.sizeBytes + (item_.mmproj?.sizeBytes ?? 0))}
                {item_.mmproj ? " total" : ""}
              </Text>

              {downloading && (
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(row.progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>{Math.round(row.progress * 100)}%</Text>
                </View>
              )}
              {row.state === "downloading-mmproj" && <Text style={styles.progressNote}>Downloading vision component…</Text>}

              <View style={styles.actions}>
                {row.state === "idle" && (
                  <Pressable style={styles.button} onPress={() => handleDownload(item_)}>
                    <Text style={styles.buttonText}>Download</Text>
                  </Pressable>
                )}
                {downloading && (
                  <Pressable
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() => handleCancelDownload(item_)}
                  >
                    <Text style={styles.buttonSecondaryText}>Cancel</Text>
                  </Pressable>
                )}
                {row.state === "downloaded" && (
                  <>
                    <Pressable style={styles.button} onPress={() => handleLoad(item_)}>
                      <Text style={styles.buttonText}>Load</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, styles.buttonSecondary]}
                      onPress={() => handleDelete(item_)}
                    >
                      <Text style={styles.buttonSecondaryText}>Delete</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.importSection}>
            <Text style={styles.importTitle}>Have your own model?</Text>
            <Pressable style={styles.buttonOutline} onPress={handleImport}>
              <Text style={styles.buttonOutlineText}>Import a .gguf file</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    subtitle: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 12 },
    sectionHeader: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      marginTop: 12,
      marginBottom: 8,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardTitle: { fontSize: 16, fontWeight: "600", flexShrink: 1, color: colors.text },
    badge: { fontSize: 12, fontWeight: "600" },
    cardDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 6, opacity: 0.8 },
    progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    progressTrack: {
      flex: 1,
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: "hidden",
    },
    progressFill: { height: "100%", backgroundColor: colors.primary },
    progressLabel: { fontSize: 12, color: colors.textSecondary, width: 36, textAlign: "right" },
    progressNote: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
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
    buttonOutline: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: "center",
      marginBottom: 12,
    },
    buttonOutlineText: { color: colors.primary, fontWeight: "600" },
    importSection: { marginTop: 8, marginBottom: 40 },
    importTitle: { fontSize: 15, fontWeight: "600", marginBottom: 8, color: colors.text },
  });
}
