import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { darkColors, lightColors } from "../src/theme";

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? darkColors : lightColors;

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        </Stack>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
