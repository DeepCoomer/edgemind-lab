import type { Conversation, ModelRef } from "./chatStore";

// A newly opened chat isn't written to storage until the first message is
// sent — otherwise every visit to an empty history (or every "New chat" tap)
// would silently create a phantom entry. This holds the one pending draft
// in memory between navigating to it and the chat screen picking it up.
let pendingDraft: Conversation | null = null;

export function createDraftChat(model: ModelRef): Conversation {
  const now = Date.now();
  const draft: Conversation = {
    ...model,
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  pendingDraft = draft;
  return draft;
}

export function takeDraftIfMatching(id: string): Conversation | null {
  return pendingDraft?.id === id ? pendingDraft : null;
}
