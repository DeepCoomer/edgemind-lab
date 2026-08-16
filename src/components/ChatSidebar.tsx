import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { DrawerContentScrollView, useDrawerStatus, type DrawerContentComponentProps } from "expo-router/drawer";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";
import { deleteConversation, listConversations, type Conversation } from "../lib/chatStore";
import { startNewChat } from "../lib/newChat";
import type { ThemeColors } from "../theme";

function timeAgo(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ChatSidebar(props: DrawerContentComponentProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const pathname = usePathname();
  const drawerStatus = useDrawerStatus();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (drawerStatus === "open") {
      listConversations().then(setConversations);
    }
  }, [drawerStatus]);

  function handleDelete(id: string) {
    Alert.alert("Delete chat?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteConversation(id);
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (pathname === `/chat/${id}`) {
            // Not router.replace("/") — the home route auto-opens the most
            // recently updated remaining chat if any exist, which would just
            // land back in a different old conversation instead of offering
            // a fresh start.
            startNewChat();
          }
        },
      },
    ]);
  }

  return (
    <DrawerContentScrollView {...props} style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.appName}>EdgeMind Lab</Text>

      <Pressable style={styles.newChatButton} onPress={() => startNewChat()}>
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.newChatText}>New chat</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Chats</Text>
      {conversations.length === 0 ? (
        <Text style={styles.emptyText}>No chats yet</Text>
      ) : (
        conversations.map((item) => {
          const active = pathname === `/chat/${item.id}`;
          return (
            <Pressable
              key={item.id}
              style={[styles.row, active && styles.rowActive]}
              onPress={() => router.replace({ pathname: "/chat/[id]", params: { id: item.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.label} · {timeAgo(item.updatedAt)}
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
              </Pressable>
            </Pressable>
          );
        })
      )}

      <View style={{ flex: 1, minHeight: 12 }} />

      <Pressable style={styles.modelsRow} onPress={() => router.push("/lab")}>
        <Ionicons name="flask-outline" size={18} color={colors.text} />
        <Text style={styles.modelsText}>Lab</Text>
      </Pressable>
      <Pressable style={[styles.modelsRow, { borderTopWidth: 0, paddingTop: 0 }]} onPress={() => router.push("/models")}>
        <Ionicons name="cube-outline" size={18} color={colors.text} />
        <Text style={styles.modelsText}>Models</Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.surface },
    content: { flexGrow: 1, paddingTop: 8 },
    appName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    newChatButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 12,
      marginBottom: 20,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    newChatText: { color: colors.text, fontWeight: "600" },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      paddingHorizontal: 16,
      marginBottom: 4,
      textTransform: "uppercase",
    },
    emptyText: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: 16 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      borderRadius: 8,
      marginHorizontal: 6,
    },
    rowActive: { backgroundColor: colors.background },
    rowTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
    rowMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    modelsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    modelsText: { fontSize: 14, fontWeight: "600", color: colors.text },
  });
}
