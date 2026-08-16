import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import type { ThemeColors } from "../../src/theme";

interface Experiment {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  route: "/tasks" | "/lab-sources" | "/param-playground" | "/model-compare" | "/scan-text";
}

const EXPERIMENTS: Experiment[] = [
  {
    icon: "flash-outline",
    title: "Quick Actions",
    subtitle: "Summarize, translate, proofread, and more. Also reachable from Android's share sheet and text-selection popup.",
    route: "/tasks",
  },
  {
    icon: "camera-outline",
    title: "Scan Text",
    subtitle: "Photograph a document, receipt, or whiteboard and pull the text out on-device.",
    route: "/scan-text",
  },
  {
    icon: "albums-outline",
    title: "Sources",
    subtitle: "Drop in reference text the model can pull from during chat. Flat and disposable — no folders, no notes app.",
    route: "/lab-sources",
  },
  {
    icon: "options-outline",
    title: "Live Tuning",
    subtitle: "Tweak temperature, top-p, top-k and re-run the same prompt to see how output changes in real time.",
    route: "/param-playground",
  },
  {
    icon: "git-compare-outline",
    title: "Model Compare",
    subtitle: "Run the same prompt through two downloaded models and compare output and speed side by side.",
    route: "/model-compare",
  },
];

export default function LabScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Experiments in on-device AI. Try things out — nothing here is permanent.
      </Text>
      {EXPERIMENTS.map((item) => (
        <Pressable key={item.route} style={styles.card} onPress={() => router.push(item.route)}>
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16 },
    intro: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
    cardSubtitle: { fontSize: 12.5, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  });
}
