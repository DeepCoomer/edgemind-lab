import { router } from "expo-router";
import { Alert } from "react-native";
import { setLastModel } from "./chatStore";
import { createDraftChat } from "./draftChat";
import { listDownloadedModels } from "./modelStore";
import { resolveModelRef } from "./resolveModel";

export async function startNewChat(): Promise<void> {
  const models = listDownloadedModels();
  if (models.length === 0) {
    Alert.alert("No model loaded", "Load a model from the Models screen first.");
    return;
  }
  if (models.length > 1) {
    // replace, not push — this is also called right after deleting the
    // current chat, and push would leave the now-deleted chat's route
    // sitting underneath in history, reachable again via the back button.
    router.replace("/new-chat-picker");
    return;
  }
  const fullModel = await resolveModelRef(models[0]);
  await setLastModel(fullModel);
  const draft = createDraftChat(fullModel);
  router.replace({ pathname: "/chat/[id]", params: { id: draft.id } });
}
