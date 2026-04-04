import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, Linking, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { supabase } from "../../lib/supabase";

const BLUE = "#0b3ea8";
const RED = "#ef4444";
const GREEN = "#22c55e";
const ORANGE = "#fc6b04";

function formatPhone(num: string = "") {
  const d = num.replace(/\D/g, "").slice(-10);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return num;
}
function formatTime(ts: string) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
function formatDuration(sec: number) {
  if (!sec) return "";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export default function RecentsScreen() {
  const [tab, setTab] = useState<"calls" | "voicemail">("calls");
  const [calls, setCalls] = useState<any[]>([]);
  const [voicemails, setVoicemails] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => { init(); return () => { soundRef.current?.unloadAsync(); }; }, []);
  useFocusEffect(useCallback(() => { if (companyId) load(companyId); }, [companyId]));

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
      await load(cid);
    } finally { setLoading(false); }
  }

  async function load(cid: string) {
    const { data } = await supabase
      .from("communications")
      .select("*")
      .eq("company_id", cid)
      .in("type", ["call", "ai_call", "voicemail"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data) return;
    setCalls(data.filter((d: any) => d.type !== "voicemail"));
    setVoicemails(data.filter((d: any) => d.type === "voicemail"));
  }

  async function playVoicemail(item: any) {
    try {
      if (playingId === item.id) {
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
      setPlayingId(item.id);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: item.recording_url });
      soundRef.current = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) setPlayingId(null);
      });
    } catch (e: any) {
      Alert.alert("Playback Error", e.message);
      setPlayingId(null);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    if (companyId) await load(companyId);
    setRefreshing(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={BLUE} /></View>;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📞 Recents</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "calls" && styles.tabBtnActive]}
            onPress={() => setTab("calls")}
          >
            <Text style={[styles.tabText, tab === "calls" && styles.tabTextActive]}>
              Calls ({calls.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "voicemail" && styles.tabBtnActive]}
            onPress={() => setTab("voicemail")}
          >
            <Text style={[styles.tabText, tab === "voicemail" && styles.tabTextActive]}>
              🎙️ Voicemail ({voicemails.filter((v) => !v.read_at).length} new)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === "calls" ? (
        <FlatList
          data={calls}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No recent calls</Text></View>}
          renderItem={({ item }) => {
            const isMissed = item.status === "missed";
            const num = item.direction === "inbound" ? item.from_number : item.to_number;
            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() => router.push(`/chat/${encodeURIComponent(num)}?name=${encodeURIComponent(item.customer_name || "")}`)}
              >
                <View style={[styles.callIcon, { backgroundColor: isMissed ? "#fef2f2" : "#f0fdf4" }]}>
                  <Ionicons
                    name={item.direction === "inbound" ? "call-outline" : "call"}
                    size={20}
                    color={isMissed ? RED : GREEN}
                  />
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemName, isMissed && { color: RED }]}>
                    {item.customer_name || formatPhone(num)}
                  </Text>
                  <Text style={styles.itemSub}>
                    {isMissed ? "Missed · " : item.direction === "inbound" ? "Inbound · " : "Outbound · "}
                    {item.type === "ai_call" ? "AI " : ""}
                    {formatDuration(item.duration_seconds)}
                    {item.recording_url ? " · 🔴 Recorded" : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.itemTime}>{formatTime(item.created_at)}</Text>
                  <TouchableOpacity
                    onPress={() => supabase.functions.invoke("twilio-outbound-call", {
                      body: { to_customer: num, company_id: companyId, customer_name: item.customer_name, record: false }
                    }).then(() => Alert.alert("📞 Calling", "Your phone will ring shortly"))}
                  >
                    <Text style={styles.callBack}>Call back</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={voicemails}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No voicemails</Text></View>}
          renderItem={({ item }) => (
            <View style={[styles.item, !item.read_at && { backgroundColor: "#eff6ff" }]}>
              <TouchableOpacity onPress={() => playVoicemail(item)} style={[styles.playBtn, { backgroundColor: playingId === item.id ? RED : BLUE }]}>
                <Ionicons name={playingId === item.id ? "stop" : "play"} size={20} color="#fff" />
              </TouchableOpacity>
              <View style={styles.itemContent}>
                <Text style={styles.itemName}>{item.customer_name || formatPhone(item.from_number)}</Text>
                {item.ai_summary ? (
                  <Text style={styles.transcript} numberOfLines={2}>"{item.ai_summary}"</Text>
                ) : (
                  <Text style={styles.itemSub}>{formatDuration(item.duration_seconds) || "New voicemail"}</Text>
                )}
                {!item.read_at && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.itemTime}>{formatTime(item.created_at)}</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.from_number}`)}>
                  <Text style={styles.callBack}>Call back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// need useRef import
import { useRef } from "react";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#fff", paddingTop: 56, paddingHorizontal: 16, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title: { fontSize: 22, fontWeight: "900", color: BLUE, marginBottom: 12 },
  tabRow: { flexDirection: "row" },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: BLUE },
  tabText: { fontSize: 13, fontWeight: "600", color: "#9ca3af" },
  tabTextActive: { color: BLUE, fontWeight: "800" },
  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { color: "#9ca3af", fontSize: 14 },
  item: { flexDirection: "row", backgroundColor: "#fff", padding: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", alignItems: "center" },
  callIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", marginRight: 12 },
  playBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", marginRight: 12 },
  itemContent: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#111" },
  itemSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  itemTime: { fontSize: 11, color: "#9ca3af" },
  transcript: { fontSize: 12, color: "#374151", fontStyle: "italic", marginTop: 2 },
  callBack: { fontSize: 12, color: BLUE, fontWeight: "700", marginTop: 4 },
  newBadge: { backgroundColor: ORANGE, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start", marginTop: 4 },
  newBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
