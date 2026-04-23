import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Clipboard,
  Animated,
  KeyboardAvoidingView,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../../lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Constants ────────────────────────────────────────────────────────────────
const BLUE = "#0b3ea8";
const ORANGE = "#fc6b04";
const LIGHT_BLUE = "#e8eeff";

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: string | null;
  actionData?: any;
  isVoice?: boolean;
  transcript?: string;
  timestamp: Date;
}

// ── Push Notification Setup ───────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  // Only works on physical devices, not simulators
  if (__DEV__ && !Constants.isDevice) {
    console.log("Push notifications only work on physical devices");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied");
    return null;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData.data;
    console.log("Push token:", token);

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("reminders", {
        name: "AI Reminders",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#fc6b04",
      });
    }

    return token;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIAssistantTab() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 Hey Dustin! I'm your DML AI assistant.\n\nI can help you:\n• 🎤 Dictate material lists\n• 📅 Set reminders\n• ✨ Generate proposals & invoices\n• 📊 Check project & invoice status\n\nHold the mic button to talk, or type below!",
      timestamp: new Date(),
    },
  ]);
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Animation for mic button pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs so stopRecording always has the latest values (avoids stale closure crash)
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingDurationRef = useRef(0);
  const isStoppingRef = useRef(false); // guard against double-stop
  // ref to sendToAI so stopRecording doesn't need it in its dep array (avoids hoisting error)
  const sendToAIRef = useRef<(input: { type: "text" | "voice"; message?: string; audioBase64?: string; audioFormat?: string }) => Promise<void>>(async () => {});

  // ── Init: Register push + load conversation history ──────────────────────
  useEffect(() => {
    initializePush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initializePush() {
    const token = await registerForPushNotifications();
    if (token) {
      setPushToken(token);
      // Save token to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("push_tokens").upsert({
          user_id: user.id,
          token,
          device_type: Platform.OS,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  // ── Mic pulse animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Duration counter — keep ref in sync so stopRecording closure always has latest
      recordingDurationRef.current = 0;
      durationTimer.current = setInterval(() => {
        setRecordingDuration((d) => {
          const next = d + 1;
          recordingDurationRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      pulseAnim.setValue(1);
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
      setRecordingDuration(0);
    }

    return () => {
      if (durationTimer.current) clearInterval(durationTimer.current);
    };
  }, [isRecording, pulseAnim]);

  // ── Auto-scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ── Start Recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isStoppingRef.current) return; // still cleaning up previous session
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Microphone Permission",
          "Please allow microphone access to use voice input.",
          [{ text: "OK" }]
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = newRecording; // keep ref in sync
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording. Please try again.");
    }
  }, []);

  // ── Stop Recording & Process ──────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    // Use ref — avoids stale closure when React re-renders during recording
    const activeRecording = recordingRef.current;
    if (!activeRecording || isStoppingRef.current) return;

    isStoppingRef.current = true;
    recordingRef.current = null;
    setRecording(null);
    setIsRecording(false);
    setIsLoading(true);

    try {
      await activeRecording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = activeRecording.getURI();

      if (!uri) {
        throw new Error("No recording URI");
      }

      // Use ref value — state value may be stale in this closure
      if (recordingDurationRef.current < 1) {
        setIsLoading(false);
        isStoppingRef.current = false;
        return; // Too short, ignore
      }

      // Read as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });

      // Clean up temp file
      await FileSystem.deleteAsync(uri, { idempotent: true });

      // Send to AI — use ref so we don't depend on sendToAI before it's declared
      await sendToAIRef.current({ type: "voice", audioBase64: base64, audioFormat: "m4a" });
    } catch (error) {
      console.error("Stop recording error:", error);
      setIsLoading(false);
      Alert.alert("Recording Error", "Could not process your voice message. Please try again.");
    } finally {
      isStoppingRef.current = false;
    }
  }, []); // no deps needed — all values accessed via refs

  // ── Send Text Message ─────────────────────────────────────────────────────
  const sendTextMessage = useCallback(async () => {
    const text = textInput.trim();
    if (!text || isLoading) return;

    setTextInput("");
    await sendToAI({ type: "text", message: text });
  }, [textInput, isLoading]);

  // ── Core: Send to AI Edge Function ────────────────────────────────────────
  const sendToAI = useCallback(
    async (input: {
      type: "text" | "voice";
      message?: string;
      audioBase64?: string;
      audioFormat?: string;
    }) => {
      // Add user message to chat
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input.type === "voice" ? "🎤 Processing voice..." : input.message || "",
        isVoice: input.type === "voice",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        // Build conversation history (last 8 messages, excluding welcome)
        const history = messages
          .filter((m) => m.id !== "welcome")
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content }));

        const { data, error } = await supabase.functions.invoke("ai-assistant", {
          body: {
            ...input,
            pushToken,
            conversationHistory: history,
          },
        });

        if (error) throw error;

        const result = data as {
          success: boolean;
          message: string;
          transcript?: string;
          action?: string;
          actionData?: any;
        };

        // Update user message with transcript if voice
        if (input.type === "voice" && result.transcript) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMsg.id
                ? { ...m, content: result.transcript!, transcript: result.transcript }
                : m
            )
          );
        }

        // Add AI response
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.message,
          action: result.action,
          actionData: result.actionData,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err: any) {
        console.error("AI error:", err);
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "⚠️ Something went wrong. Please try again.\n\nError: " + (err.message || "Unknown error"),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, pushToken]
  );
  // Always keep the ref pointing to the latest sendToAI (so stopRecording can call it)
  sendToAIRef.current = sendToAI;

  // ── Render Message Bubble ─────────────────────────────────────────────────
  const renderMessage = (msg: Message) => {
    const isUser = msg.role === "user";

    return (
      <View
        key={msg.id}
        style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}
      >
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>🤖</Text>
          </View>
        )}

        <View style={[styles.bubbleContent, isUser ? styles.userContent : styles.aiContent]}>
          {msg.isVoice && !msg.transcript && (
            <View style={styles.voiceIndicator}>
              <Ionicons name="mic" size={14} color="#fff" />
              <Text style={styles.voiceIndicatorText}>Voice message</Text>
            </View>
          )}

          <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
            {msg.content}
          </Text>

          {/* Action Buttons */}
          {msg.action === "add_materials" && msg.actionData?.materials && (
            <View style={styles.actionButtons}>
              {msg.actionData.saved_to_project ? (
                <View style={styles.savedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.savedBadgeText}>
                    Saved to {msg.actionData.saved_to_project}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    Clipboard.setString(
                      msg.actionData.materials
                        .map((m: any) => `${m.qty} ${m.unit} - ${m.item}`)
                        .join("\n")
                    );
                    Alert.alert("✅ Copied!", "Material list copied to clipboard.");
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Copy List</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {msg.action === "invoice_paid" && msg.actionData && (
            <View style={styles.savedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.savedBadgeText}>
                Invoice #{msg.actionData.invoiceNumber} — Paid ✓
              </Text>
            </View>
          )}

          {msg.action === "invoice_created" && msg.actionData && (
            <View style={styles.savedBadge}>
              <Ionicons name="document-text-outline" size={16} color="#0b3ea8" />
              <Text style={styles.savedBadgeText}>
                Invoice #{msg.actionData.invoiceNumber} created (Draft)
              </Text>
            </View>
          )}

          {msg.action === "estimate_created" && msg.actionData && (
            <View style={styles.savedBadge}>
              <Ionicons name="calculator-outline" size={16} color="#0b3ea8" />
              <Text style={styles.savedBadgeText}>
                Estimate created for {msg.actionData.customerName} (Draft)
              </Text>
            </View>
          )}

          {(msg.action === "generate_proposal" ||
            msg.action === "generate_invoice_description") &&
            msg.actionData?.text && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    Clipboard.setString(msg.actionData.text);
                    Alert.alert("✅ Copied!", "Text copied to clipboard. Paste it into your estimate or proposal.");
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Copy Text</Text>
                </TouchableOpacity>
              </View>
            )}

          {msg.action === "set_reminder" && (
            <View style={styles.reminderConfirm}>
              <Ionicons name="alarm-outline" size={16} color={ORANGE} />
              <Text style={styles.reminderConfirmText}>Push notification scheduled</Text>
            </View>
          )}

          <Text style={styles.timestamp}>
            {msg.timestamp.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>🤖 DML AI Assistant</Text>
            <Text style={styles.headerSubtitle}>Voice & text • Reminders • Estimates</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "Clear Chat",
                "Clear conversation history?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Clear",
                    style: "destructive",
                    onPress: () =>
                      setMessages([
                        {
                          id: "welcome",
                          role: "assistant",
                          content: "Chat cleared. How can I help you?",
                          timestamp: new Date(),
                        },
                      ]),
                  },
                ]
              );
            }}
            style={styles.clearBtn}
          >
            <Ionicons name="trash-outline" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Chat Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(renderMessage)}

          {isLoading && (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <View style={styles.aiAvatar}>
                <Text style={styles.aiAvatarText}>🤖</Text>
              </View>
              <View style={[styles.bubbleContent, styles.aiContent, styles.loadingBubble]}>
                <ActivityIndicator size="small" color={BLUE} />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Recording Status */}
        {isRecording && (
          <View style={styles.recordingBar}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              Recording... {recordingDuration}s — Tap mic to send
            </Text>
          </View>
        )}

        {/* Bottom Input Area */}
        <View style={[styles.inputArea, { paddingBottom: insets.bottom + 8 }]}>
          {/* Text Input Row */}
          <View style={styles.textRow}>
            <TextInput
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={sendTextMessage}
              editable={!isLoading && !isRecording}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!textInput.trim() || isLoading) && styles.sendBtnDisabled,
              ]}
              onPress={sendTextMessage}
              disabled={!textInput.trim() || isLoading}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Mic Button — tap once to start, tap again to stop & send */}
          <View style={styles.micRow}>
            <Text style={styles.micHint}>
              {isRecording ? "🔴 Tap to stop & send" : "Tap to talk"}
            </Text>
            <TouchableOpacity
              onPress={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Animated.View
                style={[
                  styles.micButton,
                  isRecording && styles.micButtonActive,
                  isLoading && styles.micButtonLoading,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Ionicons
                  name={isRecording ? "stop-circle" : "mic"}
                  size={36}
                  color="#fff"
                />
              </Animated.View>
            </TouchableOpacity>
            <Text style={styles.micHintRight}>
              {isLoading ? "Processing..." : "or type above"}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BLUE,
  },
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  header: {
    backgroundColor: BLUE,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  clearBtn: {
    padding: 8,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 12,
    paddingBottom: 8,
  },
  messageBubble: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  userBubble: {
    justifyContent: "flex-end",
  },
  aiBubble: {
    justifyContent: "flex-start",
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BLUE,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 4,
  },
  aiAvatarText: {
    fontSize: 16,
  },
  bubbleContent: {
    maxWidth: "80%",
    borderRadius: 16,
    padding: 12,
  },
  userContent: {
    backgroundColor: BLUE,
    borderBottomRightRadius: 4,
    alignSelf: "flex-end",
    marginLeft: "auto",
  },
  aiContent: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "#fff",
  },
  aiText: {
    color: "#111827",
  },
  voiceIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  voiceIndicatorText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 4,
    textAlign: "right",
  },
  actionButtons: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ORANGE,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  reminderConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reminderConfirmText: {
    fontSize: 12,
    color: "#92400e",
    fontWeight: "600",
  },
  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 14,
    fontStyle: "italic",
  },
  recordingBar: {
    backgroundColor: "#fee2e2",
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  recordingText: {
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "600",
  },
  inputArea: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BLUE,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#d1d5db",
  },
  micRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingBottom: 4,
  },
  micHint: {
    fontSize: 11,
    color: "#9ca3af",
    flex: 1,
    textAlign: "right",
  },
  micHintRight: {
    fontSize: 11,
    color: "#9ca3af",
    flex: 1,
    textAlign: "left",
  },
  micButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: BLUE,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  micButtonActive: {
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
  },
  micButtonLoading: {
    backgroundColor: "#9ca3af",
    shadowColor: "#9ca3af",
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#d1fae5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  savedBadgeText: {
    fontSize: 12,
    color: "#065f46",
    fontWeight: "700",
    flexShrink: 1,
  },
});
