import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Drawer, DrawerToggleButton } from "expo-router/drawer";
import { Pressable, useColorScheme } from "react-native";
import ChatSidebar from "../../src/components/ChatSidebar";
import { darkColors, lightColors } from "../../src/theme";

export default function DrawerLayout() {
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? darkColors : lightColors;

  return (
    <Drawer
      drawerContent={(props) => <ChatSidebar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerLeft: () => <DrawerToggleButton tintColor={colors.text} />,
        drawerStyle: { backgroundColor: colors.surface, width: 300 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Drawer.Screen name="index" options={{ title: "" }} />
      <Drawer.Screen name="chat/[id]" options={{ title: "" }} />
      <Drawer.Screen name="lab" options={{ title: "Lab" }} />
      <Drawer.Screen
        name="models"
        options={{
          title: "Models",
          headerRight: () => (
            <Pressable onPress={() => router.push("/model-search")} hitSlop={8} style={{ marginRight: 16 }}>
              <Ionicons name="search" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <Drawer.Screen name="model-search" options={{ title: "Search Models" }} />
    </Drawer>
  );
}
