import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { type DownloadTask } from "expo-file-system";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { EMBEDDING_MODEL } from "../src/constants/embeddingModel";
import { pickAndImportDocument } from "../src/lib/docImport";
import { loadEmbeddingModel } from "../src/lib/embeddingContext";
import { indexSource } from "../src/lib/indexSource";
import { isDownloaded, localFileFor, startDownload } from "../src/lib/modelStore";
import { addSource, deleteSource, listSources, MAX_SOURCE_CHARS, MIN_SOURCE_CHARS, type Source } from "../src/lib/sourcesStore";
import type { ThemeColors } from "../src/theme";

type ModelState = "checking" | "missing" | "downloading" | "ready";

export default function LabSourcesScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [sources, setSources] = useState<Source[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [modelState, setModelState] = useState<ModelState>("checking");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const downloadTask = useRef<DownloadTask | null>(null);
  const [indexingId, setIndexingId] = useState<string | null>(null);

  useEffect(() => {
    listSources().then(setSources);
    setModelState(isDownloaded(EMBEDDING_MODEL) ? "ready" : "missing");
  }, []);

  function handleDownloadModel() {
    setModelState("downloading");
    const { task, promise } = startDownload(EMBEDDING_MODEL, setDownloadProgress);
    downloadTask.current = task;
    promise
      .then((result) => {
        downloadTask.current = null;
        setModelState(result ? "ready" : "missing");
      })
      .catch((err) => {
        downloadTask.current = null;
        setModelState("missing");
        Alert.alert("Download failed", String(err?.message ?? err));
      });
  }

  async function runIndex(source: Source): Promise<number | null> {
    if (modelState !== "ready") return null;
    try {
      await loadEmbeddingModel(localFileFor(EMBEDDING_MODEL.filename).uri);
      const count = await indexSource(source);
      setSources((prev) => prev.map((s) => (s.id === source.id ? { ...s, chunkCount: count } : s)));
      return count;
    } catch (err: any) {
      Alert.alert("Indexing failed", String(err?.message ?? err));
      return null;
    }
  }

  async function handleSave() {
    const t = title.trim() || "Untitled";
    const body = text.trim();
    if (body.length < MIN_SOURCE_CHARS) return;
    setSaving(true);
    try {
      const source = await addSource(t, body);
      setSources((prev) => [source, ...prev]);
      setTitle("");
      setText("");
      setAdding(false);
      if (modelState === "ready") {
        setIndexingId(source.id);
        await runIndex(source);
        setIndexingId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const doc = await pickAndImportDocument(MAX_SOURCE_CHARS);
      if (!doc) return;
      setAdding(true);
      setTitle(doc.title);
      setText(doc.text);
      if (doc.truncated) {
        Alert.alert("Trimmed", `This document was long, so it's been trimmed to ${MAX_SOURCE_CHARS.toLocaleString()} characters.`);
      }
    } catch (err: any) {
      Alert.alert("Import failed", String(err?.message ?? err));
    } finally {
      setImporting(false);
    }
  }

  function handleDelete(id: string) {
    Alert.alert("Delete source?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteSource(id);
          setSources((prev) => prev.filter((s) => s.id !== id));
        },
      },
    ]);
  }

  const canSave = text.trim().length >= MIN_SOURCE_CHARS && !saving;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Sources",
          headerRight: () => (
            <Pressable onPress={() => setAdding((v) => !v)} hitSlop={8} style={{ marginRight: 16 }}>
              <Ionicons name={adding ? "close" : "add"} size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      {modelState !== "ready" && (
        <View style={styles.banner}>
          <Ionicons name="git-network-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Embedding model</Text>
            <Text style={styles.bannerSubtitle}>
              {modelState === "downloading"
                ? `Downloading… ${Math.round(downloadProgress * 100)}%`
                : `Needed to search your sources during chat (~${Math.round(EMBEDDING_MODEL.sizeBytes / 1024 / 1024)} MB, one-time download)`}
            </Text>
          </View>
          {modelState === "missing" && (
            <Pressable style={styles.bannerButton} onPress={handleDownloadModel}>
              <Text style={styles.bannerButtonText}>Download</Text>
            </Pressable>
          )}
        </View>
      )}

      {adding && (
        <View style={styles.addForm}>
          <View style={styles.addFormRow}>
            <TextInput
              style={[styles.titleInput, { flex: 1 }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Title (optional)"
              placeholderTextColor={colors.placeholder}
            />
            <Pressable style={styles.importButton} onPress={handleImport} disabled={importing}>
              {importing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
              )}
            </Pressable>
          </View>
          {importing && (
            <View style={styles.importingRow}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={styles.importingText}>Reading file… PDFs can take a few seconds to extract.</Text>
            </View>
          )}
          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={setText}
            placeholder="Paste reference text, or import a .txt/.md/.pdf file…"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={6}
          />
          <Text style={styles.sizeHint}>
            {text.trim().length.toLocaleString()} / {MAX_SOURCE_CHARS.toLocaleString()} characters
            {text.trim().length > 0 && text.trim().length < MIN_SOURCE_CHARS ? ` · needs at least ${MIN_SOURCE_CHARS}` : ""}
          </Text>
          <Pressable style={[styles.saveButton, !canSave && styles.saveButtonDisabled]} onPress={handleSave} disabled={!canSave}>
            <Text style={styles.saveButtonText}>{saving ? "Adding…" : "Add source"}</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={sources}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, paddingTop: adding ? 0 : 16 }}
        renderItem={({ item }) => {
          const indexed = (item.chunkCount ?? 0) > 0;
          const indexing = indexingId === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Pressable hitSlop={8} onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={styles.cardBody} numberOfLines={3}>
                {item.text}
              </Text>
              <View style={styles.cardFooter}>
                {indexed ? (
                  <View style={styles.statusRow}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                    <Text style={styles.statusText}>Indexed · {item.chunkCount} chunks</Text>
                  </View>
                ) : (
                  <Pressable
                    style={styles.statusRow}
                    disabled={modelState !== "ready" || indexing}
                    onPress={async () => {
                      setIndexingId(item.id);
                      await runIndex(item);
                      setIndexingId(null);
                    }}
                  >
                    <Ionicons
                      name={modelState === "ready" ? "sync-outline" : "alert-circle-outline"}
                      size={13}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.statusText}>
                      {indexing ? "Indexing…" : modelState === "ready" ? "Not indexed — tap to index" : "Not indexed — download embedding model above"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !adding ? (
            <View style={styles.empty}>
              <Ionicons name="albums-outline" size={28} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                No sources yet. Add reference text with the + button, then attach it to a chat from the input row.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      margin: 16,
      marginBottom: 0,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    bannerTitle: { fontSize: 13, fontWeight: "600", color: colors.text },
    bannerSubtitle: { fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
    bannerButton: { backgroundColor: colors.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    bannerButtonText: { color: colors.primaryText, fontWeight: "600", fontSize: 12.5 },
    addForm: { padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    addFormRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    titleInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    importButton: {
      width: 44,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      minHeight: 120,
      textAlignVertical: "top",
      color: colors.text,
      backgroundColor: colors.surface,
    },
    sizeHint: { fontSize: 11.5, color: colors.textSecondary, marginTop: -4 },
    importingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    importingText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
    saveButton: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
    saveButtonDisabled: { opacity: 0.4 },
    saveButtonText: { color: colors.primaryText, fontWeight: "700" },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    cardTitle: { fontSize: 14.5, fontWeight: "600", color: colors.text, flex: 1 },
    cardBody: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
    cardFooter: { marginTop: 8 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    statusText: { fontSize: 11.5, color: colors.textSecondary },
    empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, paddingHorizontal: 32, gap: 12 },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19 },
  });
}
