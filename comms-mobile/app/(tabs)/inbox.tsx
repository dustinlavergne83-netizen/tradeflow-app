import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useUnread } from "../../lib/UnreadContext";

const BLUE = "#0b3ea8";
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
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const TYPE_ICONS: Record<string, string> = { sms: "💬", call: "📞", ai_call: "🤖", voicemail: "🎙️" };

export default function InboxScreen() {
  const { setSmsCount } = useUnread();
  const [threads, setThreads] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "sms" | "call" | "voicemail">("all");

  useEffect(() => { init(); }, []);

  useFocusEffect(
    useCallback(() => {
      if (companyId) loadThreads(companyId);
    }, [companyId])
  );

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/sign-in"); return; }

      let cid = user.id;
      try {
        const { data: emp } = await supabase.from("employees")
          .select("company_id").eq("user_id", user.id).maybeSingle();
        if (emp?.company_id) cid = emp.company_id;
      } catch (_) {}

      setCompanyId(cid);
      await loadThreads(cid);

      // Real-time
      const sub = supabase.channel("comms-inbox")
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "communications",
          filter: `company_id=eq.${cid}`,
        }, () => loadThreads(cid))
        .subscribe();

      return () => { sub.unsubscribe(); };
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadThreads(cid: string) {
    const { data } = await supabase
      .from("communications")
      .select("*")
      .eq("company_id", cid)
      .order("created_at", { ascending: false });

    if (!data) return;

    const threadMap = new Map<string, any>();
    for (const msg of data) {
      const contactNum = msg.direction === "inbound" ? msg.from_number : msg.to_number;
      if (!threadMap.has(contactNum)) {
        threadMap.set(contactNum, { ...msg, contactNumber: contactNum, unread: 0 });
      }
      if (!msg.read_at && msg.direction === "inbound") {
        threadMap.get(contactNum).unread++;
      }
    }
    const built = Array.from(threadMap.values());
    setThreads(built);
    // Update badge count
    setSmsCount(built.reduce((sum, t) => sum + (t.unread || 0), 0));
  }

  const onRefresh = async () => {
    setRefreshing(true);
    if (companyId) await loadThreads(companyId);
    setRefreshing(false);
  };

  const filtered = threads.filter((t) => {
    if (filter !== "all" && t.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (t.customer_name || "").toLowerCase().includes(q) ||
        (t.contactNumber || "").includes(q)
      );
    }
    return true;
  });

  const totalUnread = threads.reduce((sum, t) => sum + (t.unread || 0), 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            📬 Inbox
            {totalUnread > 0 && (
              <Text style={styles.badge}> {totalUnread}</Text>
            )}
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations..."
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          {(["all", "sms", "call", "voicemail"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === "all" ? "All" : f === "sms" ? "Texts" : f === "call" ? "Calls" : "Voicemail"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Thread List */}
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>💬</Text>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>Texts and calls from customers will appear here</Text>
          </View>
        }
        renderItem={({ item: t }) => (
          <TouchableOpacity
            style={[styles.thread, t.unread > 0 && styles.threadUnread]}
            onPress={() => router.push(`/chat/${encodeURIComponent(t.contactNumber)}?name=${encodeURIComponent(t.customer_name || "")}&customerId=${t.customer_id || ""}`)}
          >
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: t.unread > 0 ? BLUE : "#e5e7eb" }]}>
              <Text style={[styles.avatarText, { color: t.unread > 0 ? "#fff" : "#374151" }]}>
                {(t.customer_name || "?")[0].toUpperCase()}
              </Text>
            </View>

            {/* Content */}
            <View style={styles.threadContent}>
              <View style={styles.threadTop}>
                <Text style={[styles.threadName, t.unread > 0 && { fontWeight: "900" }]} numberOfLines={1}>
                  {t.customer_name || formatPhone(t.contactNumber)}
                </Text>
                <Text style={styles.threadTime}>{formatTime(t.created_at)}</Text>
              </View>
              <View style={styles.threadBottom}>
                <Text style={styles.threadPreview} numberOfLines={1}>
                  {TYPE_ICONS[t.type] || "💬"} {t.direction === "outbound" ? "You: " : ""}
                  {t.ai_summary || t.body || (t.type === "voicemail" ? "Voicemail" : "View conversation")}
                </Text>
                {t.unread > 0 && (
                  <View style={styles.unreadDot}>
                    <Text style={styles.unreadCount}>{t.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#fff", paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "900", color: BLUE },
  badge: { fontSize: 14, color: ORANGE, fontWeight: "800" },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: "#111" },
  filters: { flexDirection: "row", gap: 8 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: "#f3f4f6" },
  filterBtnActive: { backgroundColor: BLUE },
  filterText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  filterTextActive: { color: "#fff" },
  empty: { flex: 1, alignItems: "center", paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 16 },
  emptySubtext: { fontSize: 13, color: "#9ca3af", marginTop: 8, textAlign: "center", paddingHorizontal: 40 },
  thread: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", alignItems: "center" },
  threadUnread: { backgroundColor: "#eff6ff" },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: "800" },
  threadContent: { flex: 1 },
  threadTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  threadName: { fontSize: 15, fontWeight: "700", color: "#111", flex: 1, marginRight: 8 },
  threadTime: { fontSize: 11, color: "#9ca3af" },
  threadBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  threadPreview: { fontSize: 13, color: "#6b7280", flex: 1 },
  unreadDot: { backgroundColor: BLUE, borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 },
  unreadCount: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
