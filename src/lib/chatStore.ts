import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Local image attached to this message — only possible with a vision-capable model. */
  imageUri?: string;
}

export interface ModelRef {
  path: string;
  label: string;
  contextSize: number;
  systemPrompt: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  /** Presence means this model supports image attachments in chat. */
  mmprojPath?: string;
}

export interface Conversation extends ModelRef {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
  /** Sources (from the Lab) the user has attached as reference material for this chat. */
  sourceIds?: string[];
}

const CONVERSATIONS_KEY = "edgemind:conversations";
const LAST_MODEL_KEY = "edgemind:lastModel";

async function readConversations(): Promise<Conversation[]> {
  const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeConversations(conversations: Conversation[]): Promise<void> {
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export async function listConversations(): Promise<Conversation[]> {
  const conversations = await readConversations();
  return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const conversations = await readConversations();
  return conversations.find((c) => c.id === id);
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const conversations = await readConversations();
  const index = conversations.findIndex((c) => c.id === conversation.id);
  const updated = { ...conversation, updatedAt: Date.now() };
  if (index === -1) {
    conversations.push(updated);
  } else {
    conversations[index] = updated;
  }
  await writeConversations(conversations);
}

export async function deleteConversation(id: string): Promise<void> {
  const conversations = await readConversations();
  await writeConversations(conversations.filter((c) => c.id !== id));
}

export function deriveTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New chat";
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
}

export async function getLastModel(): Promise<ModelRef | null> {
  const raw = await AsyncStorage.getItem(LAST_MODEL_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setLastModel(model: ModelRef): Promise<void> {
  await AsyncStorage.setItem(LAST_MODEL_KEY, JSON.stringify(model));
}
