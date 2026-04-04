import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  TextInput, ScrollView, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";

const BLUE = "#0b3ea8";
const ORANGE = "#fc6b04";
const GREEN = "#22c55e";

const KEYS = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
];

function formatDisplay(num: string) {
  const d = num.replace(/\D/g, "").slice(-10);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function DialPadScreen() {
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"call" | "text">("call");
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(false);
  const [bizPhone, setBizPhone] = useState<string | null>(null);

  useEffect(() => { loadBizPhone(); }, []);

  async function loadBizPhone() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let cid = user.id;
      try {
        const { data: emp } = await supabase.from("employees")
          .select("company_id").eq("user_id", user.id).maybeSingle();
        if (emp?.company_id) cid = emp.company_id;
      } catch (_) {}
      const { data: cfg } = await supabase
        .from("twilio_config")
        .select("phone_number")
        .eq("company_id", cid)
        .maybeSingle();
      if (cfg?.phone_number) setBizPhone(cfg.phone_number);
    } catch (_) {}
  }

  function pressKey(key: string) {
    if (number.replace(/\D/g, "").length >= 11) return;
    setNumber((p) => p + key);
  }

  async function getCompanyId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    let cid = user.id;
    try {
      const { data: emp } = await supabase.from("employees")
        .select("company_id").eq("user_id", user.id).maybeSingle();
      if (emp?.company_id) cid = emp.company_id;
    } catch (_) {}
    return cid;
  }

  async function makeCall() {
    const digits = number.replace(/\D/g, "");
    if (digits.length < 10) { Alert.alert("Invalid number", "Please enter a 10-digit number."); return; }
    const toNumber = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    setLoading(true);
    try {
      const cid = await getCompanyId();
      const { error } = await supabase.functions.invoke("twilio-outbound-call", {
        body: { to_customer: toNumber, company_id: cid, record },
      });
      if (error) throw error;
      Alert.alert("📞 Incoming Call", `Your phone will ring shortly and connect you to ${formatDisplay(number)}.${record ? "\n\n🔴 Recording enabled." : ""}`);
      setNumber("");
    } catch (e: any) {
      Alert.alert("Call Failed", e.message);
    } finally { setLoading(false); }
  }

  async function sendText() {
    const digits = number.replace(/\D/g, "");
    if (digits.length < 10) { Alert.alert("Invalid number", "Please enter a 10-digit number."); return; }
    if (!message.trim()) { Alert.alert("Missing message", "Please type a message to send."); return; }
    const toNumber = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    setLoading(true);
    try {
      const cid = await getCompanyId();
      const { error } = await supabase.functions.invoke("send-sms", {
        body: { to: toNumber, body: message.trim(), company_id: cid },
      });
      if (error) throw error;
      Alert.alert("✅ Sent", "Your message was sent successfully.");
      setNumber(""); setMessage("");
    } catch (e: any) {
      Alert.alert("Failed to send", e.message);
    } finally { setLoading(false); }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>☎️ Dial Pad</Text>
          {bizPhone && (
            <View style={styles.bizBadge}>
              <Text style={styles.bizBadgeText}>📞 {formatDisplay(bizPhone)}</Text>
            </View>
          )}
        </View>
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "call" && styles.modeBtnActive]}
            onPress={() => setMode("call")}
          >
            <Text style={[styles.modeTxt, mode === "call" && styles.modeTxtActive]}>📞 Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "text" && styles.modeBtnActive]}
            onPress={() => setMode("text")}
          >
            <Text style={[styles.modeTxt, mode === "text" && styles.modeTxtActive]}>💬 Text</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Display */}
      <View style={styles.display}>
        <TextInput
          style={styles.displayText}
          value={formatDisplay(number) || ""}
          onChangeText={(v) => setNumber(v.replace(/\D/g, ""))}
          placeholder="(   )    -    "
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          textAlign="center"
          maxLength={14}
        />
        {number.length > 0 && (
          <TouchableOpacity onPress={() => setNumber((p) => p.slice(0, -1))} style={styles.backspace}>
            <Ionicons name="backspace-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYS.map(([digit, letters]) => (
          <TouchableOpacity key={digit} style={styles.key} onPress={() => pressKey(digit)}>
            <Text style={styles.keyDigit}>{digit}</Text>
            {letters ? <Text style={styles.keyLetters}>{letters}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      {/* Text message input */}
      {mode === "text" && (
        <TextInput
          style={styles.msgInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message..."
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={1600}
        />
      )}

      {/* Call recording toggle */}
      {mode === "call" && (
        <TouchableOpacity
          style={styles.recordToggle}
          onPress={() => setRecord((r) => !r)}
        >
          <View style={[styles.toggle, record && { backgroundColor: "#ef4444" }]}>
            <View style={[styles.toggleThumb, record && { marginLeft: "auto" }]} />
          </View>
          <Text style={styles.recordLabel}>
            {record ? "🔴 Record this call" : "Record call (off)"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Action Button */}
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: mode === "call" ? GREEN : BLUE }, loading && { opacity: 0.6 }]}
        onPress={mode === "call" ? makeCall : sendText}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name={mode === "call" ? "call" : "send"} size={22} color="#fff" />
            <Text style={styles.actionTxt}>
              {mode === "call" ? "Call via Business #" : "Send Text"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {mode === "call" && (
        <Text style={styles.hint}>
          Your phone will ring first, then connect you to the customer.{"\n"}
          {bizPhone
            ? `Customer sees ${formatDisplay(bizPhone)} as the caller.`
            : "Configure your business number in Settings."}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: { backgroundColor: "#fff", paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "900", color: BLUE },
  bizBadge: { backgroundColor: "#eff6ff", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#bfdbfe" },
  bizBadgeText: { fontSize: 12, fontWeight: "700", color: BLUE },
  modeSwitch: { flexDirection: "row", backgroundColor: "#f3f4f6", borderRadius: 10, padding: 3 },
  modeBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  modeBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  modeTxt: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  modeTxtActive: { color: BLUE, fontWeight: "800" },
  display: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 24, paddingVertical: 20, position: "relative" },
  displayText: { flex: 1, fontSize: 30, fontWeight: "300", color: "#111", letterSpacing: 2 },
  backspace: { padding: 8 },
  keypad: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 32, backgroundColor: "#fff", paddingBottom: 8 },
  key: { width: "33.3%", alignItems: "center", paddingVertical: 14 },
  keyDigit: { fontSize: 26, fontWeight: "300", color: "#111" },
  keyLetters: { fontSize: 9, color: "#9ca3af", letterSpacing: 2, marginTop: 1 },
  msgInput: { margin: 16, backgroundColor: "#fff", borderRadius: 12, padding: 14, fontSize: 15, minHeight: 80, color: "#111", borderWidth: 1, borderColor: "#e5e7eb" },
  recordToggle: { flexDirection: "row", alignItems: "center", marginHorizontal: 24, marginBottom: 16, gap: 12 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: "#e5e7eb", padding: 2, flexDirection: "row" },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  recordLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 24, borderRadius: 16, padding: 18, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  actionTxt: { color: "#fff", fontSize: 17, fontWeight: "800" },
  hint: { textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 12, paddingHorizontal: 32, lineHeight: 18 },
});
