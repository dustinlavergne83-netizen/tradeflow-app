/**
 * app/auth.tsx
 * OAuth callback handler — Microsoft redirects here after sign-in.
 * Reads the auth code + stored PKCE verifier, exchanges for tokens,
 * then navigates back to the Email tab.
 */
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as AuthSession from "expo-auth-session";

// Web-safe storage (same pattern as email.tsx)
const storage = {
  getItem: (key: string): Promise<string | null> =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.getItem(key))
      : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string): Promise<void> =>
    Platform.OS === "web"
      ? (localStorage.setItem(key, value), Promise.resolve())
      : SecureStore.setItemAsync(key, value),
  deleteItem: (key: string): Promise<void> =>
    Platform.OS === "web"
      ? (localStorage.removeItem(key), Promise.resolve())
      : SecureStore.deleteItemAsync(key),
};

const BLUE   = "#0b3ea8";
const TENANT = "9bd3d089-ecc6-4777-9198-41f0d40f95d6";
const CLIENT = "1101ddc0-5dc1-4275-beb6-34b2ef897452";
const SCOPES = ["openid", "offline_access", "Mail.Read", "Mail.ReadBasic", "Mail.Send"];

const TOKEN_ENDPOINT = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    const { code, error, error_description } = params;

    if (error) {
      setStatus(`Sign in failed: ${error_description || error}`);
      setTimeout(() => router.replace("/(tabs)/email"), 3000);
      return;
    }

    if (!code) {
      // No code and no error — just go back to email tab
      router.replace("/(tabs)/email");
      return;
    }

    try {
      setStatus("Exchanging code for tokens...");

      // Read PKCE verifier saved by email.tsx before promptAsync()
      const codeVerifier = await storage.getItem("ms_pkce_verifier");

      // Build the redirect URI the same way email.tsx does
      const redirectUri = AuthSession.makeRedirectUri({ scheme: "dmlcomms", path: "auth" });

      const body = new URLSearchParams({
        client_id:    CLIENT,
        code,
        redirect_uri: redirectUri,
        grant_type:   "authorization_code",
        scope:        SCOPES.join(" "),
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      });

      const res  = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = await res.json();

      if (data.access_token) {
        const expiry = (Date.now() + data.expires_in * 1000 - 60000).toString();
        await storage.setItem("ms_access_token", data.access_token);
        if (data.refresh_token) await storage.setItem("ms_refresh_token", data.refresh_token);
        await storage.setItem("ms_token_expiry", expiry);
        // Clean up verifier
        await storage.deleteItem("ms_pkce_verifier").catch(() => {});
        setStatus("✅ Signed in! Loading email...");
        router.replace("/(tabs)/email");
      } else {
        setStatus(`❌ ${data.error_description || data.error || "Token exchange failed"}`);
        setTimeout(() => router.replace("/(tabs)/email"), 3000);
      }
    } catch (e: any) {
      setStatus(`❌ Error: ${e.message}`);
      setTimeout(() => router.replace("/(tabs)/email"), 3000);
    }
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={BLUE} style={{ marginBottom: 16 }} />
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  status: {
    fontSize: 15,
    color: "#374151",
    textAlign: "center",
    lineHeight: 22,
  },
});
