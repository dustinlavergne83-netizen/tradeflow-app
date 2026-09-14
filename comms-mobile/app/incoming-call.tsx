/**
 * Full-screen incoming call UI, shown when the Twilio Voice SDK emits a
 * `callInvite` event (app open/foregrounded — the CallKeep-style native
 * notification handles the app-closed case). Navigated to from
 * lib/TwilioVoice.ts's callInvite listener registered in _layout.tsx.
 */
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useBrand } from "../lib/useBrand";
import { getPendingCallInvite, clearPendingCallInvite } from "../lib/TwilioVoice";

function formatPhone(num: string = "") {
  const d = num.replace(/\D/g, "").slice(-10);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return num;
}

export default function IncomingCallScreen() {
  const brand = useBrand();
  const [busy, setBusy] = useState(false);
  const invite = getPendingCallInvite();
  const from = invite?.getFrom?.() || "";

  useEffect(() => {
    // If the invite was cancelled by the caller before we answered, bail out.
    return () => {};
  }, []);

  async function handleAccept() {
    if (!invite || busy) return;
    setBusy(true);
    try {
      await invite.accept();
      router.replace("/(tabs)/dialpad");
    } finally {
      clearPendingCallInvite();
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!invite || busy) { router.back(); return; }
    setBusy(true);
    try {
      await invite.reject();
    } finally {
      clearPendingCallInvite();
      setBusy(false);
      router.back();
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: brand.primary }]}>
      <View style={styles.center}>
        <View style={styles.avatar}>
          <Ionicons name="call" size={48} color="#fff" />
        </View>
        <Text style={styles.label}>Incoming Call</Text>
        <Text style={styles.number}>{formatPhone(from)}</Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.actionCol}>
          <TouchableOpacity style={[styles.btn, styles.reject]} onPress={handleReject} disabled={busy}>
            <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Decline</Text>
        </View>
        <View style={styles.actionCol}>
          <TouchableOpacity style={[styles.btn, styles.accept]} onPress={handleAccept} disabled={busy}>
            <Ionicons name="call" size={30} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Accept</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between", paddingVertical: 80 },
  center: { alignItems: "center", marginTop: 60 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginBottom: 24 },
  label: { color: "rgba(255,255,255,0.8)", fontSize: 16, fontWeight: "600" },
  number: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 8 },
  actions: { flexDirection: "row", justifyContent: "space-evenly", paddingBottom: 40 },
  actionCol: { alignItems: "center", gap: 10 },
  btn: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  accept: { backgroundColor: "#22c55e" },
  reject: { backgroundColor: "#ef4444" },
  actionLabel: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
