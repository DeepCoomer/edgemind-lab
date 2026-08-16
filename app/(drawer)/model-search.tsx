import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { searchHFModels, type HFSearchResult } from "../../src/lib/huggingface";
import type { ThemeColors } from "../../src/theme";

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ModelSearchScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HFSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const requestIdRef = useRef(0);

  async function runSearch(q: string) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const found = await searchHFModels(q);
      if (requestIdRef.current !== requestId) return; // a newer search superseded this one
      setResults(found);
      setSearched(true);
    } catch (err: any) {
      if (requestIdRef.current !== requestId) return;
      setError(String(err?.message ?? err));
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }

  // Search as you type, debounced — typing further cancels any in-flight
  // request's effect on the UI rather than waiting for it to land.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      requestIdRef.current++;
      setResults([]);
      setSearched(false);
      setError(null);
      setLoading(false);
      return;
    }
    const timeout = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search Hugging Face (e.g. llama 3.2, phi, gemma)…"
          placeholderTextColor={colors.placeholder}
          onSubmitEditing={() => query.trim().length >= MIN_QUERY_LENGTH && runSearch(query.trim())}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <Pressable
          style={styles.searchButton}
          onPress={() => query.trim().length >= MIN_QUERY_LENGTH && runSearch(query.trim())}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} size="small" />
          ) : (
            <Ionicons name="search" size={18} color={colors.primaryText} />
          )}
        </Pressable>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && searched && results.length === 0 && !error && (
        <Text style={styles.emptyText}>No GGUF models found for "{query}".</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push({ pathname: "/model-detail", params: { repoId: item.id } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.id}
              </Text>
              <View style={styles.statsRow}>
                <Ionicons name="download-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.statText}>{formatCount(item.downloads)}</Text>
                <Ionicons name="heart-outline" size={12} color={colors.textSecondary} style={{ marginLeft: 10 }} />
                <Text style={styles.statText}>{formatCount(item.likes)}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    searchRow: { flexDirection: "row", gap: 8, padding: 16 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    searchButton: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    errorText: { color: colors.danger, paddingHorizontal: 16, marginBottom: 8 },
    emptyText: { color: colors.textSecondary, paddingHorizontal: 16, marginBottom: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    rowTitle: { fontSize: 14.5, fontWeight: "600", color: colors.text },
    statsRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
    statText: { fontSize: 12, color: colors.textSecondary, marginLeft: 4 },
  });
}
