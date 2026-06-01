import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BLUE = "#0b3ea8";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
          backgroundColor: "#fff",
          borderTopColor: "#e5e7eb",
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        tabBarActiveTintColor: BLUE,
        tabBarInactiveTintColor: "#9ca3af",
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any = "ellipse";
          if (route.name === "inbox")   iconName = focused ? "chatbubbles"   : "chatbubbles-outline";
          else if (route.name === "recents") iconName = focused ? "call"     : "call-outline";
          else if (route.name === "dialpad") iconName = focused ? "keypad"   : "keypad-outline";
          else if (route.name === "email")   iconName = focused ? "mail"     : "mail-outline";
          else if (route.name === "ai")      iconName = focused ? "sparkles" : "sparkles-outline";
          else if (route.name === "settings") iconName = focused ? "settings" : "settings-outline";
          return <Ionicons name={iconName} size={size ?? 24} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="inbox"   options={{ title: "Inbox" }} />
      <Tabs.Screen name="recents" options={{ title: "Recents" }} />
      <Tabs.Screen name="dialpad" options={{ title: "Dial Pad" }} />
      <Tabs.Screen name="email"   options={{ title: "Email" }} />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
          tabBarActiveTintColor: "#fc6b04",
          tabBarBadgeStyle: { backgroundColor: "#fc6b04" },
        }}
      />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
