import { useState, useEffect, useRef } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActionSheetIOS, Platform, Linking, KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { supabase } from "../../lib/supabase";

const BLUE = "#0b3ea8";
const GREEN = "#22c55e";

function formatPhone(num: string = "") {
  const d = num.replace(/\D/g, "").slice(-10);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return num;
}

function formatTime(ts: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const { id, name, customerId } = useLocalSearchParams<{ id: string; name: string; customerId: string }>();
  const contactNumber = decodeURIComponent(id || "");
  const contactName = decodeURIComponent(name || "");
  const navigation = useNavigation();

  const [messages, setMessages] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const [recordCall, setRecordCall] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
            {contactName || formatPhone(contactNumber)}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
            {formatPhone(contactNumber)}
          </Text>
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={handleCallMenu} style={{ marginRight: 12 }}>
          <Ionicons name="call" size={22} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [contactNumber, contactName, recordCall]);

  useEffect(() => { init(); }, []);

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let cid = user.id;
      try {
        const { data: emp } = await supabase.from("employees")
          .select("company_id").eq("user_id", user.id).maybeSingle();
        if (emp?.company_id) cid = emp.company_id;
      } catch (_) {}
      setCompanyId(cid);
      await loadMessages(cid);

      // Real-time
      const sub = supabase.channel(`chat-${contactNumber}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "communications",
          filter: `company_id=eq.${cid}`,
        }, (payload) => {
          const msg = payload.new as any;
          if ([msg.from_number, msg.to_number].includes(contactNumber)) {
            setMessages((prev) => [...prev, msg]);
          }
        })
        .subscribe();
      return () => sub.unsubscribe();
    } catch (e) { console.error(e); }
  }

  async function loadMessages(cid: string) {
    const { data } = await supabase
      .from("communications")
      .select("*")
      .eq("company_id", cid)
      .or(`from_number.eq.${contactNumber},to_number.eq.${contactNumber}`)
      .order("created_at", { ascending: true });
    setMessages(data || []);

    // Mark as read
    await supabase.from("communications")
      .update({ read_at: new Date().toISOString() })
      .eq("company_id", cid)
      .eq("from_number", contactNumber)
      .is("read_at", null);
  }

  async function sendMessage() {
    if (!newMsg.trim() || !companyId || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-sms", {
        body: {
          to: contactNumber,
          body: newMsg.trim(),
          company_id: companyId,
          customer_name: contactName || null,
        },
      });
      if (error) throw error;
      setNewMsg("");
    } catch (err: any) {
      Alert.alert("Failed to send", err.message);
    } finally {
      setSending(false);
    }
  }

  async function callViaTwilio(record: boolean) {
    if (!companyId) return;
    setCalling(true);
    try {
      const { error } = await supabase.functions.invoke("twilio-outbound-call", {
        body: {
          to_customer: contactNumber,
          company_id: companyId,
          customer_name: contactName || null,
          record,
        },
      });
      if (error) throw error;
      Alert.alert(
        "📞 Incoming Call",
        `Your phone will ring in a moment. Answer it to be connected to ${contactName || formatPhone(contactNumber)}.${record ? "\n\n🔴 This call will be recorded." : ""}`
      );
    } catch (err: any) {
      Alert.alert("Call Failed", err.message);
    } finally {
      setCalling(false);
    }
  }

  async function playRecording(msg: any) {
    try {
      if (playingId === msg.id) {
        await soundRef.current?.stopAsync();
        await soundRef.current?.unloadAsync();
        soundRef.current = null;
        setPlayingId(null);
        return;
      }
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setPlayingId(msg.id);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: msg.recording_url });
      soundRef.current = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) { setPlayingId(null); soundRef.current = null; }
      });
    } catch (e: any) {
      Alert.alert("Playback Error", e.message);
      setPlayingId(null);
    }
  }

  function handleCallMenu() {
    const options = [
      "Call via Business # (no record)",
      "Call via Business # (🔴 record)",
      "Direct Call (personal #)",
      "Cancel",
    ];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 3, title: `Call ${contactName || formatPhone(contactNumber)}` },
        (idx) => {
          if (idx === 0) callViaTwilio(false);
          else if (idx === 1) callViaTwilio(true);
          else if (idx === 2) Linking.openURL(`tel:${contactNumber}`);
        }
      );
    } else {
      Alert.alert(
        `Call ${contactName || formatPhone(contactNumber)}`,
        "Choose call method:",
        [
          { text: "Via Business # (no record)", onPress: () => callViaTwilio(false) },
          { text: "Via Business # (🔴 record)", onPress: () => callViaTwilio(true) },
          { text: "Direct Call (personal #)", onPress: () => Linking.openURL(`tel:${contactNumber}`) },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  }

  const renderMessage = ({ item: msg }: { item: any }) => {
    const isOutbound = msg.direction === "outbound";
    const isCall = msg.type === "call" || msg.type === "ai_call" || msg.type === "voicemail";

    if (isCall) {
      const isPlaying = playingId === msg.id;
      return (
        <View style={styles.callBubble}>
          {/* Play button if recording available */}
          {msg.recording_url ? (
            <TouchableOpacity
              onPress={() => playRecording(msg)}
              style={[styles.playBtn, { backgroundColor: isPlaying ? "#ef4444" : BLUE }]}
            >
              <Ionicons name={isPlaying ? "stop" : "play"} size={16} color="#fff" />
            </TouchableOpacity>
          ) : (
            <Text style={styles.callIcon}>
              {msg.type === "voicemail" ? "🎙️" : msg.type === "ai_call" ? "🤖" : "📞"}
            </Text>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.callLabel}>
              {msg.type === "voicemail" ? "Voicemail" : msg.type === "ai_call" ? "AI Call" : msg.direction === "inbound" ? "Inbound Call" : "Outbound Call"}
              {msg.status === "missed" && <Text style={{ color: "#ef4444" }}> • Missed</Text>}
              {msg.recording_url && <Text style={{ color: BLUE }}> • 🔴 Recorded</Text>}
            </Text>
            {msg.ai_summary && <Text style={styles.callSummary} numberOfLines={2}>{msg.ai_summary}</Text>}
            {msg.duration_seconds > 0 && (
              <Text style={styles.callDuration}>
                {Math.floor(msg.duration_seconds / 60)}:{String(msg.duration_seconds % 60).padStart(2, "0")}
                {msg.recording_url ? (isPlaying ? " • Playing..." : " • Tap ▶ to listen") : ""}
              </Text>
            )}
          </View>
          <Text style={styles.callTime}>{formatTime(msg.created_at)}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.bubbleRow, isOutbound ? styles.bubbleRight : styles.bubbleLeft]}>
        <View style={[styles.bubble, isOutbound ? styles.bubbleOut : styles.bubbleIn]}>
          <Text style={[styles.bubbleText, isOutbound && { color: "#fff" }]}>{msg.body}</Text>
          <Text style={[styles.bubbleTime, isOutbound && { color: "rgba(255,255,255,0.7)" }]}>
            {formatTime(msg.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={88}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={{ fontSize: 40 }}>💬</Text>
            <Text style={{ color: "#9ca3af", marginTop: 8 }}>No messages yet. Send one!</Text>
          </View>
        }
      />

      {/* Send Box */}
      <View style={styles.inputRow}>
        <TouchableOpacity onPress={handleCallMenu} style={styles.callBtn} disabled={calling}>
          <Ionicons name="call" size={22} color={GREEN} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={newMsg}
          onChangeText={setNewMsg}
          placeholder="Type a message..."
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={1600}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!newMsg.trim() || sending) && { opacity: 0.4 }]}
          onPress={sendMessage}
          disabled={!newMsg.trim() || sending}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  messageList: { padding: 16, paddingBottom: 8 },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  bubbleRow: { marginBottom: 8, flexDirection: "row" },
  bubbleLeft: { justifyContent: "flex-start" },
  bubbleRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "72%", borderRadius: 18, padding: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  bubbleIn: { backgroundColor: "#fff", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#e5e7eb" },
  bubbleOut: { backgroundColor: BLUE, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, color: "#111", lineHeight: 20 },
  bubbleTime: { fontSize: 10, color: "#9ca3af", marginTop: 4, textAlign: "right" },
  callBubble: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "center", backgroundColor: "#f3f4f6", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  callIcon: { fontSize: 22 },
  callLabel: { fontSize: 13, fontWeight: "700", color: "#111" },
  callSummary: { fontSize: 12, color: "#6b7280", maxWidth: 220, marginTop: 2 },
  callDuration: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  callTime: { fontSize: 11, color: "#9ca3af", marginLeft: "auto" },
  playBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb", gap: 8 },
  callBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  input: { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 100, color: "#111" },
  sendBtn: { width: 40, height: 40, backgroundColor: BLUE, borderRadius: 20, justifyContent: "center", alignItems: "center" },
});
