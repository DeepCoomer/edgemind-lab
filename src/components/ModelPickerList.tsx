import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";
import { listDownloadedModels, type DownloadedModel } from "../lib/modelStore";
import type { ThemeColors } from "../theme";

function formatMB(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export default function ModelPickerList({
  onSelect,
  title = "Choose a model",
}: {
  onSelect: (model: DownloadedModel & { label: string }) => void;
  title?: string | null;
}) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const models = listDownloadedModels();

  if (models.length === 0) {
    return <Text style={styles.emptyText}>No downloaded models yet — get one from Models first.</Text>;
  }

  return (
    <View>
      {title && <Text style={styles.title}>{title}</Text>}
      {models.map((model) => (
        <Pressable key={model.path} style={styles.card} onPress={() => onSelect(model)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {model.label}
            </Text>
            <Text style={styles.cardMeta}>{formatMB(model.sizeBytes)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    title: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase", marginBottom: 8 },
    emptyText: { fontSize: 13, color: colors.textSecondary },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      backgroundColor: colors.surface,
    },
    cardTitle: { fontSize: 14.5, fontWeight: "600", color: colors.text },
    cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  });
}
