import { Tabs } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UnreadProvider, useUnread } from "../../lib/UnreadContext";
import { useBrand, useFeatures } from "../../lib/useBrand";

// Inner component — reads context after provider mounts
function TabsWithBadges() {
  const insets = useSafeAreaInsets();
  const { counts } = useUnread();
  const brand = useBrand();
  const features = useFeatures();

  // Wait for the real company row before rendering the tab bar. Expo Router
  // bakes each <Tabs.Screen>'s `href` in on its first render and does not
  // re-register a screen when the flag later flips — so mounting <Tabs> while
  // features are still resolving to their un-loaded defaults can permanently
  // hide a tab (e.g. Email) for the rest of that session.
  if (features.loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color={brand.primary} />
      </View>
    );
  }

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
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: "#9ca3af",
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any = "ellipse";
          if (route.name === "inbox")    iconName = focused ? "chatbubbles"   : "chatbubbles-outline";
          else if (route.name === "recents") iconName = focused ? "call"      : "call-outline";
          else if (route.name === "dialpad") iconName = focused ? "keypad"    : "keypad-outline";
          else if (route.name === "email")   iconName = focused ? "mail"      : "mail-outline";
          else if (route.name === "ai")      iconName = focused ? "sparkles"  : "sparkles-outline";
          else if (route.name === "settings") iconName = focused ? "settings" : "settings-outline";
          return <Ionicons name={iconName} size={size ?? 24} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarBadge: counts.sms > 0 ? counts.sms : undefined,
        }}
      />
      <Tabs.Screen
        name="recents"
        options={{
          title: "Recents",
          tabBarBadge: counts.missed > 0 ? counts.missed : undefined,
        }}
      />
      <Tabs.Screen
        name="dialpad"
        options={{
          title: "Dial Pad",
          href: features.dialpad ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="email"
        options={{
          title: "Email",
          tabBarBadge: counts.email > 0 ? counts.email : undefined,
          href: features.email ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
          tabBarActiveTintColor: brand.accent,
          tabBarBadgeStyle: { backgroundColor: brand.accent },
          href: features.aiAssistant ? undefined : null,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <UnreadProvider>
      <TabsWithBadges />
    </UnreadProvider>
  );
}
