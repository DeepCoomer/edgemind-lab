import { Stack, router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import ModelPickerList from "../src/components/ModelPickerList";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { setLastModel } from "../src/lib/chatStore";
import { createDraftChat } from "../src/lib/draftChat";
import type { DownloadedModel } from "../src/lib/modelStore";
import { resolveModelRef } from "../src/lib/resolveModel";

export default function NewChatPickerScreen() {
  const colors = useThemeColors();

  async function handleSelect(model: DownloadedModel & { label: string }) {
    const fullModel = await resolveModelRef(model);
    await setLastModel(fullModel);
    const draft = createDraftChat(fullModel);
    router.replace({ pathname: "/chat/[id]", params: { id: draft.id } });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "New Chat" }} />
      <ModelPickerList onSelect={handleSelect} title="You have multiple models — pick one to chat with" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
});
