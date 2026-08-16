import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ModelPickerList from "../../src/components/ModelPickerList";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { setLastModel, listConversations } from "../../src/lib/chatStore";
import { createDraftChat } from "../../src/lib/draftChat";
import { listDownloadedModels, type DownloadedModel } from "../../src/lib/modelStore";
import { resolveModelRef } from "../../src/lib/resolveModel";
import type { ThemeColors } from "../../src/theme";

type Screen = "loading" | "no-models" | "choose-model";

export default function ChatHome() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [screen, setScreen] = useState<Screen>("loading");

  // This screen stays mounted in the background once the drawer navigator
  // has visited it once, so a plain useEffect(() => {}, []) would only ever
  // resolve on the very first launch. Re-run the resolver every time it's
  // actually focused (e.g. after deleting every chat and landing back here).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setScreen("loading");
      (async () => {
        const conversations = await listConversations();
        if (cancelled) return;
        if (conversations.length > 0) {
          router.replace({ pathname: "/chat/[id]", params: { id: conversations[0].id } });
          return;
        }
        const models = listDownloadedModels();
        if (cancelled) return;
        if (models.length === 0) {
          setScreen("no-models");
          return;
        }
        if (models.length === 1) {
          const fullModel = await resolveModelRef(models[0]);
          if (cancelled) return;
          await setLastModel(fullModel);
          const draft = createDraftChat(fullModel);
          router.replace({ pathname: "/chat/[id]", params: { id: draft.id } });
          return;
        }
        setScreen("choose-model");
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function handleSelect(model: DownloadedModel & { label: string }) {
    const fullModel = await resolveModelRef(model);
    await setLastModel(fullModel);
    const draft = createDraftChat(fullModel);
    router.replace({ pathname: "/chat/[id]", params: { id: draft.id } });
  }

  if (screen === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (screen === "choose-model") {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
        <ModelPickerList onSelect={handleSelect} title="You have multiple models — pick one to chat with" />
      </ScrollView>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.text}>Load a model to start chatting.</Text>
      <Pressable style={styles.button} onPress={() => router.push("/models")}>
        <Text style={styles.buttonText}>Go to Models</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      gap: 16,
      backgroundColor: colors.background,
    },
    text: { fontSize: 15, color: colors.textSecondary, textAlign: "center" },
    button: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
    buttonText: { color: colors.primaryText, fontWeight: "700" },
  });
}
