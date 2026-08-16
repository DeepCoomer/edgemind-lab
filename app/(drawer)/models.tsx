import { router } from "expo-router";
import { setLastModel } from "../../src/lib/chatStore";
import { createDraftChat } from "../../src/lib/draftChat";
import { getModelSettings } from "../../src/lib/modelSettings";
import ModelListScreen, { type ReadyModel } from "../../src/screens/ModelListScreen";

export default function ModelsScreen() {
  async function handleModelReady(model: ReadyModel) {
    const settings = await getModelSettings(model.path);
    const fullModel = { ...model, ...settings };
    await setLastModel(fullModel);
    const draft = createDraftChat(fullModel);
    router.replace({ pathname: "/chat/[id]", params: { id: draft.id } });
  }

  return <ModelListScreen onModelReady={handleModelReady} />;
}
