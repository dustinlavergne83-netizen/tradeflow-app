import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { supabase } from "../lib/supabase";
import { View, ActivityIndicator } from "react-native";

export default function RootLayout() {
  const [session, setSession] = useState<any>(undefined); // undefined = still loading
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle auth-based routing
  useEffect(() => {
    if (session === undefined) return; // Still loading, do nothing

    const inTabsGroup = segments[0] === "(tabs)";
    const inSignIn = segments[0] === "sign-in";
    const inIndex = !segments[0]; // at the root "/" (index.tsx) — segment is undefined

    if (!session && !inSignIn) {
      // Not logged in — go to sign-in
      router.replace("/sign-in");
    } else if (session && (inSignIn || inIndex)) {
      // Logged in but on sign-in or root index — go to inbox
      router.replace("/(tabs)/inbox");
    }
  }, [session, segments]);

  // Show loading spinner while checking auth
  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0b3ea8" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen
        name="chat/[id]"
        options={{
          headerShown: true,
          headerTitle: "",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: "#0b3ea8" },
          headerTintColor: "#fff",
          presentation: "card",
        }}
      />
    </Stack>
  );
}
