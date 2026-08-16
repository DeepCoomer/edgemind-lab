export interface ThemeColors {
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryText: string;
  danger: string;
  bubbleUser: string;
  bubbleUserText: string;
  bubbleAssistant: string;
  bubbleAssistantText: string;
  inputBackground: string;
  placeholder: string;
}

export const lightColors: ThemeColors = {
  background: "#ffffff",
  surface: "#f7f7f8",
  border: "#e5e5e5",
  text: "#111111",
  textSecondary: "#666666",
  primary: "#4a63e7",
  primaryText: "#ffffff",
  danger: "#c62828",
  bubbleUser: "#4a63e7",
  bubbleUserText: "#ffffff",
  bubbleAssistant: "#f0f0f0",
  bubbleAssistantText: "#111111",
  inputBackground: "#ffffff",
  placeholder: "#999999",
};

export const darkColors: ThemeColors = {
  background: "#121212",
  surface: "#1c1c1e",
  border: "#2c2c2e",
  text: "#f2f2f2",
  textSecondary: "#a0a0a5",
  primary: "#6f85f0",
  primaryText: "#0b0d1a",
  danger: "#ff6b6b",
  bubbleUser: "#6f85f0",
  bubbleUserText: "#0b0d1a",
  bubbleAssistant: "#26262a",
  bubbleAssistantText: "#f2f2f2",
  inputBackground: "#1c1c1e",
  placeholder: "#7a7a80",
};
