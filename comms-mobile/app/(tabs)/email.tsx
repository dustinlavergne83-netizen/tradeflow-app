import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
  KeyboardAvoidingView, Platform, SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";
import { useUnread } from "../../lib/UnreadContext";

// Web-safe storage: localStorage on browser, SecureStore on native
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

// ── Constants ─────────────────────────────────────────────────────────────────
const BLUE   = "#0b3ea8";
const ORANGE = "#fc6b04";
const GREEN  = "#22c55e";
const TENANT = "9bd3d089-ecc6-4777-9198-41f0d40f95d6";
const CLIENT = "1101ddc0-5dc1-4275-beb6-34b2ef897452";
const SCOPES = ["openid", "offline_access", "Mail.Read", "Mail.ReadBasic", "Mail.Send"];
const STORE_ACCESS  = "ms_access_token";
const STORE_REFRESH = "ms_refresh_token";
const STORE_EXPIRY  = "ms_token_expiry";

const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`,
  tokenEndpoint:         `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ts: string) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EmailScreen() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "dmlcomms", path: "auth" });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  const { setEmailCount } = useUnread();

  // Auth state
  const [accessToken, setAccessToken]   = useState<string | null>(null);
  const [signedIn, setSignedIn]         = useState(false);
  const [authLoading, setAuthLoading]   = useState(true);

  // Email state
  const [emails, setEmails]             = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [attachments, setAttachments]   = useState<any[]>([]);
  const [error, setError]               = useState<string | null>(null);

  // Compose / Reply state
  const [showCompose, setShowCompose]         = useState(false);
  const [composeMode, setComposeMode]         = useState<"compose" | "reply">("compose");
  const [composeTo, setComposeTo]             = useState("");
  const [composeSubject, setComposeSubject]   = useState("");
  const [composeBody, setComposeBody]         = useState("");
  const [composeSending, setComposeSending]   = useState(false);

  // Auto-refresh timer
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Init: restore token from SecureStore ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const token  = await storage.getItem(STORE_ACCESS);
        const expiry = await storage.getItem(STORE_EXPIRY);
        if (token && expiry && Date.now() < parseInt(expiry)) {
          setAccessToken(token);
          setSignedIn(true);
        } else {
          // Try to refresh
          const refresh = await storage.getItem(STORE_REFRESH);
          if (refresh) {
            await refreshAccessToken(refresh);
          }
        }
      } catch (_) {}
      setAuthLoading(false);
    })();
  }, []);

  // ── Handle auth code response ─────────────────────────────────────────────
  useEffect(() => {
    if (response?.type === "success") {
      exchangeCodeForToken(response.params.code);
    } else if (response?.type === "error") {
      setError("Sign in failed: " + response.error?.message);
    }
  }, [response]);

  // ── Load emails on sign-in ────────────────────────────────────────────────
  useEffect(() => {
    if (signedIn && accessToken && !loading) {
      loadEmails();
    }
  }, [signedIn, accessToken]);

  // ── Auto-refresh every 30 s while screen is focused ──────────────────────
  useFocusEffect(
    useCallback(() => {
      if (signedIn && accessToken) {
        refreshTimer.current = setInterval(() => { loadEmails(true); }, 30000);
      }
      return () => {
        if (refreshTimer.current) clearInterval(refreshTimer.current);
      };
    }, [signedIn, accessToken])
  );

  // ── Exchange auth code for tokens ─────────────────────────────────────────
  async function exchangeCodeForToken(code: string) {
    try {
      setAuthLoading(true);
      const body = new URLSearchParams({
        client_id:     CLIENT,
        code,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
        code_verifier: request!.codeVerifier!,
        scope:         SCOPES.join(" "),
      });
      const res  = await fetch(discovery.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        await saveTokens(data.access_token, data.refresh_token, data.expires_in);
        setSignedIn(true);
      } else {
        setError("Token exchange failed: " + (data.error_description || data.error));
      }
    } catch (e: any) {
      setError("Auth error: " + e.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Refresh access token ──────────────────────────────────────────────────
  async function refreshAccessToken(refreshToken: string) {
    try {
      const body = new URLSearchParams({
        client_id:     CLIENT,
        refresh_token: refreshToken,
        grant_type:    "refresh_token",
        scope:         SCOPES.join(" "),
      });
      const res  = await fetch(discovery.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        await saveTokens(data.access_token, data.refresh_token || refreshToken, data.expires_in);
        setSignedIn(true);
        return data.access_token as string;
      }
    } catch (_) {}
    return null;
  }

  async function saveTokens(token: string, refresh: string, expiresIn: number) {
    const expiry = (Date.now() + expiresIn * 1000 - 60000).toString();
    setAccessToken(token);
    await storage.setItem(STORE_ACCESS, token);
    if (refresh) await storage.setItem(STORE_REFRESH, refresh);
    await storage.setItem(STORE_EXPIRY, expiry);
    // Register Expo push token for server-side email polling (native only)
    if (refresh) registerEmailPushSubscription(refresh);
  }

  // ── Register push subscription for new-email notifications ───────────────
  async function registerEmailPushSubscription(refreshToken: string) {
    if (Platform.OS === "web") return; // localStorage only, no Expo push on web
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const expoPushToken = tokenData.data;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase.from("email_push_subscriptions").upsert(
        {
          user_id:          session.user.id,
          expo_push_token:  expoPushToken,
          ms_refresh_token: refreshToken,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    } catch (e) {
      console.log("Push subscription skipped:", e);
    }
  }

  // ── Get valid token (refresh if needed) ──────────────────────────────────
  async function getToken(): Promise<string> {
    const expiry = await storage.getItem(STORE_EXPIRY);
    if (!expiry || Date.now() >= parseInt(expiry)) {
      const refresh = await storage.getItem(STORE_REFRESH);
      if (refresh) {
        const newToken = await refreshAccessToken(refresh);
        if (newToken) return newToken;
      }
      throw new Error("Session expired. Please sign in again.");
    }
    return accessToken!;
  }

  // ── Graph API fetch ───────────────────────────────────────────────────────
  async function graphFetch(url: string) {
    const token = await getToken();
    const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Graph ${res.status}: ${res.statusText}`);
    return res.json();
  }

  // ── Load Emails ───────────────────────────────────────────────────────────
  async function loadEmails(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await graphFetch(
        "https://graph.microsoft.com/v1.0/me/messages?$top=30&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments,bodyPreview,isRead"
      );
      const loaded = data.value || [];
      setEmails(loaded);
      setEmailCount(loaded.filter((e: any) => !e.isRead).length);
    } catch (e: any) {
      if (!silent) setError("Failed to load emails: " + e.message);
    }
    if (!silent) setLoading(false);
  }

  // ── Select Email + Load Attachments ──────────────────────────────────────
  async function handleSelectEmail(email: any) {
    setSelectedEmail(email);
    setAttachments([]);
    if (email.hasAttachments) {
      try {
        const data = await graphFetch(
          `https://graph.microsoft.com/v1.0/me/messages/${email.id}/attachments`
        );
        setAttachments(data.value || []);
      } catch (_) {}
    }
  }

  // ── Process Pay Stub ──────────────────────────────────────────────────────
  async function handleProcessPayStub(att: any) {
    Alert.alert("Process Pay Stubs", `Process "${att.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Process", onPress: async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(
              "https://hyhjxdgdetdqoyoscflu.supabase.co/functions/v1/process-check-stub-email",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                  source: "mobile-email",
                  filename: att.name,
                  contentBase64: att.contentBytes,
                  contentType: att.contentType,
                  from: selectedEmail?.from?.emailAddress?.address || "unknown",
                  subject: selectedEmail?.subject || "",
                }),
              }
            );
            const result = await res.json();
            Alert.alert(
              res.ok ? "✅ Success" : "❌ Failed",
              res.ok ? (result.message || "Pay stubs processed!") : (result.error || "Processing failed")
            );
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  }

  // ── Send Email ────────────────────────────────────────────────────────────
  async function handleSendEmail() {
    if (!composeTo.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    try {
      const token = await getToken();
      const message = {
        subject: composeSubject || "(no subject)",
        body: { contentType: "Text", content: composeBody },
        toRecipients: composeTo.split(",").map(a => ({ emailAddress: { address: a.trim() } })).filter(r => r.emailAddress.address),
      };
      const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message, saveToSentItems: true }),
      });
      if (res.ok || res.status === 202) {
        Alert.alert("✅ Sent", "Email sent successfully!");
        setShowCompose(false);
        setComposeTo(""); setComposeSubject(""); setComposeBody("");
      } else {
        const j = await res.json().catch(() => ({}));
        Alert.alert("❌ Failed", j.error?.message || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setComposeSending(false);
  }

  // ── Sign Out ──────────────────────────────────────────────────────────────
  async function handleSignOut() {
    Alert.alert("Sign Out", "Sign out of Microsoft email?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive", onPress: async () => {
          await storage.deleteItem(STORE_ACCESS);
          await storage.deleteItem(STORE_REFRESH);
          await storage.deleteItem(STORE_EXPIRY);
          setAccessToken(null);
          setSignedIn(false);
          setEmails([]);
          setSelectedEmail(null);
        },
      },
    ]);
  }

  function openReply() {
    if (!selectedEmail) return;
    setComposeMode("reply");
    setComposeTo(selectedEmail.from?.emailAddress?.address || "");
    setComposeSubject("Re: " + (selectedEmail.subject || ""));
    setComposeBody("");
    setShowCompose(true);
  }

  function openCompose() {
    setComposeMode("compose");
    setComposeTo(""); setComposeSubject(""); setComposeBody("");
    setShowCompose(true);
  }

  // ── Render: Auth Loading ──────────────────────────────────────────────────
  if (authLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.loadingText}>Connecting to Outlook...</Text>
      </SafeAreaView>
    );
  }

  // ── Render: Sign In ───────────────────────────────────────────────────────
  if (!signedIn) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>📬</Text>
        <Text style={styles.signInTitle}>Connect Your Outlook</Text>
        <Text style={styles.signInSub}>Sign in with your Microsoft account to read emails in the app.</Text>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <Text style={styles.redirectNote}>
          📋 Redirect URI to add in Azure AD (Mobile/Desktop):{"\n"}
          <Text style={{ fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 11, color: BLUE }}>
            {redirectUri}
          </Text>
        </Text>
        <TouchableOpacity
          style={[styles.btn, styles.btnBlue, { paddingHorizontal: 40, paddingVertical: 14 }]}
          onPress={async () => {
            // Save PKCE verifier so app/auth.tsx can complete the exchange on web
            if (request?.codeVerifier) {
              await storage.setItem("ms_pkce_verifier", request.codeVerifier);
            }
            promptAsync();
          }}
          disabled={!request}
        >
          <Text style={styles.btnText}>🔑 Sign In with Microsoft</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Render: Email Detail ──────────────────────────────────────────────────
  if (selectedEmail) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelectedEmail(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={BLUE} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailSubject} numberOfLines={2}>
              {selectedEmail.subject || "(no subject)"}
            </Text>
            <Text style={styles.detailFrom} numberOfLines={1}>
              {selectedEmail.from?.emailAddress?.name || selectedEmail.from?.emailAddress?.address}
            </Text>
          </View>
          <TouchableOpacity onPress={openReply} style={[styles.btn, styles.btnGreen, { paddingHorizontal: 12, paddingVertical: 7 }]}>
            <Text style={styles.btnTextSm}>↩️ Reply</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Meta */}
          <View style={styles.metaBox}>
            <Text style={styles.metaText}>
              <Text style={{ fontWeight: "700" }}>From: </Text>
              {selectedEmail.from?.emailAddress?.name}{" "}
              {"<"}{selectedEmail.from?.emailAddress?.address}{">"}
            </Text>
            <Text style={styles.metaText}>
              {new Date(selectedEmail.receivedDateTime).toLocaleString()}
            </Text>
          </View>

          {/* Body Preview */}
          <View style={styles.bodyBox}>
            <Text style={styles.bodyText}>{selectedEmail.bodyPreview || "(no preview)"}</Text>
            {selectedEmail.bodyPreview && (
              <Text style={styles.previewNote}>Preview only — open Outlook for full email.</Text>
            )}
          </View>

          {/* Attachments */}
          {attachments.length > 0 && (
            <View style={styles.attSection}>
              <Text style={styles.attHeader}>📎 Attachments ({attachments.length})</Text>
              {attachments.map((att, i) => {
                const isPdf = att.contentType === "application/pdf" || att.name?.toLowerCase().endsWith(".pdf");
                return (
                  <View key={i} style={styles.attCard}>
                    <Text style={styles.attIcon}>{isPdf ? "📄" : "📁"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.attName} numberOfLines={1}>{att.name}</Text>
                      <Text style={styles.attSize}>{(att.size / 1024).toFixed(1)} KB</Text>
                    </View>
                    {isPdf && (
                      <TouchableOpacity
                        style={[styles.btn, styles.btnGreen, { paddingHorizontal: 10, paddingVertical: 7 }]}
                        onPress={() => handleProcessPayStub(att)}
                      >
                        <Text style={styles.btnTextSm}>🧾 Process</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Compose FAB */}
        <TouchableOpacity style={styles.fab} onPress={openCompose}>
          <Ionicons name="create-outline" size={26} color="#fff" />
        </TouchableOpacity>

        {/* Compose Modal */}
        {renderComposeModal()}
      </SafeAreaView>
    );
  }

  // ── Render: Email List ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>📧 Email</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => loadEmails()} disabled={loading} style={styles.headerBtn}>
              <Ionicons name="refresh" size={20} color={loading ? "#d1d5db" : BLUE} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSignOut} style={styles.headerBtn}>
              <Ionicons name="log-out-outline" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.loadingText}>Loading emails...</Text>
        </View>
      ) : (
        <FlatList
          data={emails}
          keyExtractor={(e) => e.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadEmails(); setRefreshing(false); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>📭</Text>
              <Text style={styles.emptyText}>No emails</Text>
            </View>
          }
          renderItem={({ item: email }) => {
            const sender = email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown";
            return (
              <TouchableOpacity
                style={[styles.emailRow, !email.isRead && styles.emailUnread]}
                onPress={() => handleSelectEmail(email)}
              >
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: email.isRead ? "#e0e7ff" : BLUE }]}>
                  <Text style={[styles.avatarText, { color: email.isRead ? BLUE : "#fff" }]}>
                    {sender[0].toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.emailTop}>
                    <Text style={[styles.emailSender, !email.isRead && { fontWeight: "900" }]} numberOfLines={1}>
                      {sender}
                      {email.hasAttachments && <Text style={{ color: "#9ca3af" }}> 📎</Text>}
                    </Text>
                    <Text style={styles.emailTime}>{formatTime(email.receivedDateTime)}</Text>
                  </View>
                  <Text style={[styles.emailSubject, !email.isRead && { fontWeight: "700", color: "#111" }]} numberOfLines={1}>
                    {email.subject || "(no subject)"}
                  </Text>
                  <Text style={styles.emailPreview} numberOfLines={1}>{email.bodyPreview}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Compose FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCompose}>
        <Ionicons name="create-outline" size={26} color="#fff" />
      </TouchableOpacity>

      {renderComposeModal()}
    </SafeAreaView>
  );

  // ── Compose Modal ─────────────────────────────────────────────────────────
  function renderComposeModal() {
    return (
      <Modal visible={showCompose} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCompose(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCompose(false)}>
                <Text style={{ fontSize: 16, color: "#6b7280" }}>Discard</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {composeMode === "reply" ? "↩️ Reply" : "✏️ New Email"}
              </Text>
              <TouchableOpacity
                onPress={handleSendEmail}
                disabled={composeSending || !composeTo.trim() || !composeBody.trim()}
                style={[styles.sendBtn, (!composeTo.trim() || !composeBody.trim()) && { opacity: 0.4 }]}
              >
                {composeSending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.sendBtnText}>Send ➤</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
              {/* To */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>To</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={composeTo}
                  onChangeText={setComposeTo}
                  placeholder="recipient@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {/* Subject */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Subject</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={composeSubject}
                  onChangeText={setComposeSubject}
                  placeholder="Subject"
                />
              </View>
              {/* Body */}
              <TextInput
                style={styles.bodyInput}
                value={composeBody}
                onChangeText={setComposeBody}
                placeholder="Write your message here..."
                multiline
                textAlignVertical="top"
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  center:        { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#f3f4f6" },
  loadingText:   { marginTop: 12, fontSize: 14, color: "#9ca3af" },
  signInTitle:   { fontSize: 22, fontWeight: "800", color: "#111", marginBottom: 8, textAlign: "center" },
  signInSub:     { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 20, paddingHorizontal: 16 },
  redirectNote:  { backgroundColor: "#eff6ff", borderRadius: 10, padding: 12, marginBottom: 20, marginHorizontal: 16, fontSize: 12, color: "#374151", textAlign: "center" },
  errorBox:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#ef4444", margin: 12, padding: 12, borderRadius: 8 },
  errorText:     { color: "#fff", fontSize: 13, flex: 1 },
  btn:           { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  btnBlue:       { backgroundColor: BLUE },
  btnGreen:      { backgroundColor: GREEN },
  btnText:       { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnTextSm:     { color: "#fff", fontWeight: "700", fontSize: 13 },
  // Header
  header:        { backgroundColor: "#fff", paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headerRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title:         { fontSize: 22, fontWeight: "900", color: BLUE },
  headerBtn:     { padding: 6 },
  // List
  emailRow:      { flexDirection: "row", backgroundColor: "#fff", padding: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", alignItems: "flex-start", gap: 12 },
  emailUnread:   { backgroundColor: "#eff6ff" },
  avatar:        { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  avatarText:    { fontSize: 17, fontWeight: "800" },
  emailTop:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  emailSender:   { fontSize: 14, fontWeight: "600", color: "#111", flex: 1, marginRight: 8 },
  emailTime:     { fontSize: 11, color: "#9ca3af", flexShrink: 0 },
  emailSubject:  { fontSize: 13, color: "#374151", marginBottom: 2 },
  emailPreview:  { fontSize: 12, color: "#9ca3af" },
  empty:         { flex: 1, alignItems: "center", paddingTop: 80 },
  emptyText:     { fontSize: 16, color: "#9ca3af", marginTop: 12 },
  // FAB
  fab:           { position: "absolute", bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: BLUE, justifyContent: "center", alignItems: "center", shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  // Detail
  detailHeader:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 14, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  backBtn:       { padding: 4 },
  detailSubject: { fontSize: 15, fontWeight: "800", color: "#111" },
  detailFrom:    { fontSize: 12, color: "#6b7280", marginTop: 2 },
  metaBox:       { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  metaText:      { fontSize: 13, color: "#374151", marginBottom: 3 },
  bodyBox:       { backgroundColor: "#fff", borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  bodyText:      { fontSize: 14, color: "#374151", lineHeight: 22 },
  previewNote:   { marginTop: 12, fontSize: 11, color: "#9ca3af", fontStyle: "italic" },
  attSection:    { backgroundColor: "#fff", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  attHeader:     { fontSize: 14, fontWeight: "800", color: BLUE, marginBottom: 12 },
  attCard:       { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  attIcon:       { fontSize: 24 },
  attName:       { fontSize: 13, fontWeight: "700", color: "#111" },
  attSize:       { fontSize: 11, color: "#9ca3af" },
  // Compose Modal
  modalHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", backgroundColor: "#fff" },
  modalTitle:    { fontSize: 16, fontWeight: "800", color: "#111" },
  sendBtn:       { backgroundColor: BLUE, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  sendBtnText:   { color: "#fff", fontWeight: "800", fontSize: 14 },
  fieldRow:      { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingVertical: 10, marginBottom: 4 },
  fieldLabel:    { fontSize: 13, fontWeight: "700", color: "#6b7280", width: 60 },
  fieldInput:    { flex: 1, fontSize: 14, color: "#111" },
  bodyInput:     { minHeight: 200, fontSize: 14, color: "#111", lineHeight: 22, marginTop: 8 },
});
