import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Drawer } from "expo-router/drawer";
import { router, useLocalSearchParams } from "expo-router";
import type { LlamaContext, RNLlamaOAICompatibleMessage } from "llama.rn";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardChatScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../src/hooks/useThemeColors";
import { EMBEDDING_MODEL } from "../../../src/constants/embeddingModel";
import {
  deleteConversation,
  deriveTitle,
  getConversation,
  saveConversation,
  type Conversation,
  type StoredMessage,
} from "../../../src/lib/chatStore";
import { takeDraftIfMatching } from "../../../src/lib/draftChat";
import { embedText, loadEmbeddingModel } from "../../../src/lib/embeddingContext";
import { retrieveRelevantChunks } from "../../../src/lib/embeddingsStore";
import { loadModel, prepareForConversation } from "../../../src/lib/llamaContext";
import { isDownloaded, localFileFor } from "../../../src/lib/modelStore";
import MicButton from "../../../src/components/MicButton";
import { startNewChat } from "../../../src/lib/newChat";
import { listSources, type Source } from "../../../src/lib/sourcesStore";
import { speak, stopSpeaking } from "../../../src/lib/tts";
import type { ThemeColors } from "../../../src/theme";

// llama.rn strips the "file://" prefix itself for model/LoRA paths, but not
// for media_paths — its native multimodal loader expects a bare filesystem
// path and throws "File does not exist or cannot be opened" otherwise.
function stripFileProtocol(uri: string): string {
  return uri.startsWith("file://") ? uri.slice(7) : uri;
}

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sourcesModalVisible, setSourcesModalVisible] = useState(false);
  const [allSources, setAllSources] = useState<Source[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const contextRef = useRef<LlamaContext | null>(null);
  const listRef = useRef<{ scrollToEnd: (opts?: { animated?: boolean }) => void } | null>(null);
  // Tracks the sticky input row's live height (it grows with multiline text)
  // so KeyboardChatScrollView can reserve exactly that much space above the
  // keyboard instead of the input row overlapping the last message.
  const inputRowHeight = useSharedValue(0);

  useEffect(() => stopSpeaking, []);

  useEffect(() => {
    let cancelled = false;
    // Reset everything up front — switching threads reuses this same screen
    // instance (params change in place), so stale state must not leak through.
    setConversation(null);
    setNotFound(false);
    setModelReady(false);
    setLoadError(null);
    setLoadProgress(0);
    setMessages([]);
    setInput("");
    setGenerating(false);
    stopSpeaking();
    setSpeakingId(null);
    setPendingImageUri(null);

    const draft = takeDraftIfMatching(id);
    if (draft) {
      setConversation(draft);
      setMessages(draft.messages);
      return;
    }

    getConversation(id).then((found) => {
      if (cancelled) return;
      if (!found) {
        setNotFound(true);
        return;
      }
      setConversation(found);
      setMessages(found.messages);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!conversation) return;
    let cancelled = false;
    loadModel(
      conversation.path,
      conversation.contextSize,
      (progress) => {
        if (!cancelled) setLoadProgress(progress);
      },
      conversation.mmprojPath
    )
      .then(async (ctx) => {
        if (cancelled) return;
        await prepareForConversation(conversation.id);
        contextRef.current = ctx;
        setModelReady(true);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(String(error?.message ?? error));
      });
    return () => {
      cancelled = true;
    };
    // Model only needs (re)loading when the conversation's model identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.path, conversation?.contextSize, conversation?.id]);

  function persist(nextMessages: StoredMessage[], title: string) {
    if (!conversation) return;
    const updated: Conversation = { ...conversation, messages: nextMessages, title, updatedAt: Date.now() };
    setConversation(updated);
    saveConversation(updated);
  }

  async function pickImage(source: "camera" | "library") {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
      if (result.canceled || result.assets.length === 0) return;
      setPendingImageUri(result.assets[0].uri);
    } catch (err: any) {
      Alert.alert("Couldn't attach photo", String(err?.message ?? err));
    }
  }

  function handleAttachImage() {
    Alert.alert("Attach a photo", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Take Photo", onPress: () => pickImage("camera") },
      { text: "Choose Photo", onPress: () => pickImage("library") },
    ]);
  }

  function openSourcesModal() {
    listSources().then(setAllSources);
    setSourcesModalVisible(true);
  }

  function toggleSource(sourceId: string) {
    if (!conversation) return;
    const current = conversation.sourceIds ?? [];
    const next = current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId];
    const updated: Conversation = { ...conversation, sourceIds: next, updatedAt: Date.now() };
    setConversation(updated);
    saveConversation(updated);
  }

  function updateAssistantMessage(msgId: string, updater: (prev: string) => string) {
    setMessages((prev) => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];
      if (last?.id === msgId) {
        next[lastIndex] = { ...last, content: updater(last.content) };
      }
      return next;
    });
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !contextRef.current || generating || !conversation) return;
    setInput("");
    const imageUri = pendingImageUri;
    setPendingImageUri(null);

    const isFirstMessage = messages.length === 0;
    const title = isFirstMessage ? deriveTitle(text) : conversation.title;
    const userMessage: StoredMessage = { id: `${Date.now()}-u`, role: "user", content: text, imageUri: imageUri ?? undefined };
    const assistantMessage: StoredMessage = { id: `${Date.now()}-a`, role: "assistant", content: "" };
    const historyForModel = [...messages, userMessage];

    setMessages([...historyForModel, assistantMessage]);
    persist(historyForModel, title); // save the user's turn immediately, before generation
    setGenerating(true);

    const chatMessages: RNLlamaOAICompatibleMessage[] = [];
    if (conversation.systemPrompt.trim()) {
      chatMessages.push({ role: "system", content: conversation.systemPrompt.trim() });
    }
    if (conversation.sourceIds?.length && isDownloaded(EMBEDDING_MODEL)) {
      try {
        await loadEmbeddingModel(localFileFor(EMBEDDING_MODEL.filename).uri);
        const queryVector = await embedText(text);
        const relevant = await retrieveRelevantChunks(conversation.sourceIds, queryVector, 4);
        if (relevant.length) {
          const block = relevant.map((c) => c.text).join("\n\n---\n\n");
          chatMessages.push({
            role: "system",
            content: `Relevant excerpts from the user's attached sources. Use them to answer if relevant, otherwise ignore them:\n\n${block}`,
          });
        }
      } catch {
        // Retrieval is best-effort — a failure here shouldn't block the chat message.
      }
    }
    for (const m of historyForModel) {
      chatMessages.push({ role: m.role, content: m.content });
    }

    try {
      // Guaranteed here (not just on load) — Tasks can reuse this same model
      // context in between, so the cache must be (re)synced right before use.
      await prepareForConversation(conversation.id);
      await contextRef.current.completion(
        {
          messages: chatMessages,
          n_predict: conversation.maxTokens,
          temperature: conversation.temperature,
          top_p: conversation.topP,
          top_k: conversation.topK,
          // Native bridge chokes on an explicit `media_paths: undefined` —
          // the key must be entirely absent when there's no image.
          ...(imageUri ? { media_paths: [stripFileProtocol(imageUri)] } : {}),
        },
        (data) => {
          updateAssistantMessage(assistantMessage.id, (prev) => data.accumulated_text ?? prev + (data.token ?? ""));
        }
      );
    } catch (error: any) {
      updateAssistantMessage(assistantMessage.id, () => `Error: ${String(error?.message ?? error)}`);
    } finally {
      setGenerating(false);
      setMessages((finalMessages) => {
        persist(finalMessages, title);
        return finalMessages;
      });
      if (isFirstMessage) {
        generateAndApplyTitle(text);
      }
    }
  }

  // Replaces the truncated fallback title with a real summary generated by
  // the same on-device model, once the first reply has finished.
  async function generateAndApplyTitle(userText: string) {
    if (!contextRef.current) return;
    try {
      const result = await contextRef.current.completion({
        messages: [
          {
            role: "system",
            content:
              "Reply with only a short 3-6 word title summarizing the user's message. No punctuation, no quotes, no preamble.",
          },
          { role: "user", content: userText },
        ],
        n_predict: 16,
        temperature: 0.3,
      });
      const generated = (result.content || result.text || "").trim().replace(/^["'.]+|["'.]+$/g, "");
      if (!generated) return;
      setMessages((current) => {
        persist(current, generated.slice(0, 60));
        return current;
      });
    } catch {
      // Keep the truncated fallback title if generation fails.
    }
  }

  function handleStop() {
    contextRef.current?.stopCompletion();
  }

  function handleToggleSpeak(item: StoredMessage) {
    if (speakingId === item.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(item.id);
    speak(item.id, item.content, () => setSpeakingId(null));
  }

  function handleDelete() {
    Alert.alert("Delete chat?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteConversation(id);
          // Not router.replace("/") — the home route auto-opens the most
          // recently updated remaining chat if any exist, which would just
          // land back in a different old conversation instead of offering
          // a fresh start.
          startNewChat();
        },
      },
    ]);
  }

  const headerRight = () => (
    <View style={styles.headerActions}>
      <Pressable onPress={() => startNewChat()} hitSlop={8}>
        <Ionicons name="create-outline" size={22} color={colors.primary} />
      </Pressable>
      {conversation && (
        <Pressable onPress={handleDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );

  const headerTitle = (title: string) => () => (
    <Text style={styles.headerTitleText} numberOfLines={1} ellipsizeMode="tail">
      {title}
    </Text>
  );

  if (notFound) {
    return (
      <View style={styles.center}>
        <Drawer.Screen options={{ title: "Chat", headerRight }} />
        <Text style={{ color: colors.text }}>Chat not found.</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Drawer.Screen options={{ title: "Chat", headerRight }} />
        <Text style={styles.error}>Failed to load model:</Text>
        <Text style={styles.error}>{loadError}</Text>
      </View>
    );
  }

  if (!conversation || !modelReady) {
    return (
      <View style={styles.center}>
        <Drawer.Screen options={{ title: "", headerRight }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {conversation ? `Loading ${conversation.label}… ${Math.round(loadProgress)}%` : "Opening chat…"}
        </Text>
      </View>
    );
  }

  const canSend = input.trim().length > 0 && !generating;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Drawer.Screen
        options={{
          title: conversation.title,
          headerTitle: headerTitle(conversation.title),
          headerTitleContainerStyle: { maxWidth: "55%" },
          headerRight,
        }}
      />

      <KeyboardChatScrollView
        ref={listRef as any}
        style={styles.container}
        contentContainerStyle={{ padding: 16 }}
        keyboardLiftBehavior="whenAtEnd"
        extraContentPadding={inputRowHeight}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((item) => (
          <View key={item.id} style={item.role === "user" ? styles.bubbleUserWrap : styles.bubbleAssistantWrap}>
            <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
              {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.messageImage} />}
              <Text style={item.role === "user" ? styles.bubbleUserText : styles.bubbleAssistantText}>
                {item.content || "…"}
              </Text>
            </View>
            {item.role === "assistant" && item.content.length > 0 && (
              <Pressable style={styles.speakButton} onPress={() => handleToggleSpeak(item)} hitSlop={8}>
                <Ionicons
                  name={speakingId === item.id ? "stop-circle-outline" : "volume-medium-outline"}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
            )}
          </View>
        ))}
      </KeyboardChatScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View
          onLayout={(e) => {
            inputRowHeight.value = e.nativeEvent.layout.height;
          }}
        >
          {pendingImageUri && (
            <View style={styles.imagePreviewRow}>
              <Image source={{ uri: pendingImageUri }} style={styles.imagePreviewThumb} />
              <Pressable style={styles.imagePreviewRemove} onPress={() => setPendingImageUri(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}
          <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={styles.attachButton} onPress={openSourcesModal} hitSlop={8}>
            <Ionicons name="albums-outline" size={20} color={colors.text} />
            {(conversation.sourceIds?.length ?? 0) > 0 && (
              <View style={styles.attachBadge}>
                <Text style={styles.attachBadgeText}>{conversation.sourceIds!.length}</Text>
              </View>
            )}
          </Pressable>
          {conversation.mmprojPath && (
            <Pressable style={styles.attachButton} onPress={handleAttachImage} hitSlop={8}>
              <Ionicons name="image-outline" size={20} color={colors.text} />
            </Pressable>
          )}
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask something…"
            placeholderTextColor={colors.placeholder}
            editable={!generating}
            multiline
          />
          <MicButton onTranscribed={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))} />
          {generating ? (
            <Pressable style={styles.sendButton} onPress={handleStop}>
              <Ionicons name="stop" size={20} color={colors.primaryText} />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!canSend}
            >
              <Ionicons name="arrow-up" size={20} color={colors.primaryText} />
            </Pressable>
          )}
          </View>
        </View>
      </KeyboardStickyView>

      <Modal
        visible={sourcesModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSourcesModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSourcesModalVisible(false)}>
          <Pressable style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attach sources</Text>
              <Pressable onPress={() => router.push("/lab-sources")} hitSlop={8}>
                <Text style={styles.modalManageLink}>Manage</Text>
              </Pressable>
            </View>
            {allSources.length === 0 ? (
              <Text style={styles.modalEmptyText}>
                No sources yet. Add some from the Lab, then attach them here.
              </Text>
            ) : (
              <FlatList
                data={allSources}
                keyExtractor={(s) => s.id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => {
                  const selected = conversation.sourceIds?.includes(item.id) ?? false;
                  return (
                    <Pressable style={styles.sourceRow} onPress={() => toggleSource(item.id)}>
                      <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={20}
                        color={selected ? colors.primary : colors.textSecondary}
                      />
                      <Text style={styles.sourceRowText} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: colors.background,
      gap: 8,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 16, marginRight: 16 },
    headerTitleText: { fontSize: 17, fontWeight: "600", color: colors.text },
    loadingText: { color: colors.textSecondary },
    error: { color: colors.danger, textAlign: "center" },
    bubbleUserWrap: { alignItems: "flex-end", marginBottom: 8 },
    bubbleAssistantWrap: { alignItems: "flex-start", marginBottom: 8 },
    bubble: { borderRadius: 16, padding: 10, maxWidth: "85%" },
    bubbleUser: { backgroundColor: colors.bubbleUser },
    bubbleAssistant: { backgroundColor: colors.bubbleAssistant },
    bubbleUserText: { color: colors.bubbleUserText },
    bubbleAssistantText: { color: colors.bubbleAssistantText },
    speakButton: { padding: 4, marginTop: 2 },
    messageImage: { width: 180, height: 180, borderRadius: 10, marginBottom: 6 },
    imagePreviewRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: 12,
      paddingTop: 10,
      backgroundColor: colors.background,
    },
    imagePreviewThumb: { width: 56, height: 56, borderRadius: 8 },
    imagePreviewRemove: { marginLeft: -12, marginTop: -6 },
    inputRow: {
      flexDirection: "row",
      padding: 12,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: "flex-end",
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      maxHeight: 120,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendButtonDisabled: { opacity: 0.4 },
    attachButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    attachBadge: {
      position: "absolute",
      top: 2,
      right: 2,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    attachBadgeText: { fontSize: 9, fontWeight: "700", color: colors.primaryText },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
    },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    modalTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    modalManageLink: { fontSize: 13, color: colors.primary, fontWeight: "600" },
    modalEmptyText: { fontSize: 13, color: colors.textSecondary, paddingVertical: 20, textAlign: "center" },
    sourceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    sourceRowText: { fontSize: 14, color: colors.text, flex: 1 },
  });
}
