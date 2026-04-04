import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

const BLUE = "#0b3ea8";
const ORANGE = "#fc6b04";

export default function SettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [companyName, setCompanyName] = useState("DML Electrical");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase.from("companies").select("name").eq("id", user.id).maybeSingle()
          .then(({ data }) => { if (data?.name) setCompanyName(data.name); });
      }
    });
  }, []);

  async function signOut() {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/sign-in");
        }
      },
    ]);
  }

  const Row = ({ icon, label, sub, onPress, color = "#111" }: any) => (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={[styles.rowIcon, { color }]}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color }]}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Settings</Text>
      </View>

      {/* Account */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.email || "?")[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.userName}>{companyName}</Text>
        <Text style={styles.userEmail}>{user?.email || ""}</Text>
      </View>

      {/* Sections */}
      <Text style={styles.sectionTitle}>COMMUNICATIONS</Text>
      <View style={styles.section}>
        <Row
          icon="📞"
          label="Twilio Phone Settings"
          sub="Configure your business phone number"
          onPress={() => Linking.openURL("https://tradeflow.vercel.app/twilio-settings")}
        />
        <Row
          icon="💬"
          label="View All Messages (Web)"
          sub="Open TradeFlow Communications"
          onPress={() => Linking.openURL("https://tradeflow.vercel.app/communications")}
        />
        <Row
          icon="🤖"
          label="AI Phone Assistant"
          sub="Configure AI auto-answering"
          onPress={() => Linking.openURL("https://tradeflow.vercel.app/twilio-settings")}
        />
      </View>

      <Text style={styles.sectionTitle}>TRADEFLOW</Text>
      <View style={styles.section}>
        <Row
          icon="🏠"
          label="Open TradeFlow"
          sub="Estimates, invoices, projects"
          onPress={() => Linking.openURL("https://tradeflow.vercel.app")}
        />
        <Row
          icon="⏱️"
          label="Open TimeClock App"
          sub="Switch to TradeFlow mobile"
          onPress={() => Linking.openURL("tradeflow://")}
        />
      </View>

      <Text style={styles.sectionTitle}>ABOUT</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowIcon}>📱</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>DML Comms</Text>
            <Text style={styles.rowSub}>Version 1.0.0</Text>
          </View>
        </View>
        <Row
          icon="🔗"
          label="Powered by TradeFlow"
          sub="tradeflow.vercel.app"
          onPress={() => Linking.openURL("https://tradeflow.vercel.app")}
        />
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: { backgroundColor: "#fff", paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title: { fontSize: 22, fontWeight: "900", color: BLUE },
  card: { backgroundColor: "#fff", margin: 16, borderRadius: 16, padding: 24, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: BLUE, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: "800", color: "#fff" },
  userName: { fontSize: 18, fontWeight: "800", color: "#111" },
  userEmail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", letterSpacing: 1, marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  section: { backgroundColor: "#fff", borderRadius: 12, marginHorizontal: 16, overflow: "hidden", borderWidth: 1, borderColor: "#e5e7eb" },
  row: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 12 },
  rowIcon: { fontSize: 20, width: 28, textAlign: "center" },
  rowLabel: { fontSize: 15, fontWeight: "600", color: "#111" },
  rowSub: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 24, padding: 16, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#fecaca" },
  signOutText: { fontSize: 15, fontWeight: "700", color: "#ef4444" },
});
