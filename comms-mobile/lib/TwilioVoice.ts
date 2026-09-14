/**
 * TwilioVoice — thin wrapper around @twilio/voice-react-native-sdk.
 *
 * Lets the Comms app register as a "softphone" so calls can ring inside the
 * app itself (via FCM push), instead of only ever forwarding to a cell phone.
 * This is additive — twilio-voice-inbound still dials the cell number in
 * parallel (dual-dial via <Client>+<Number>), so a missed/failed in-app
 * registration never causes a missed call.
 *
 * Android only for now (no iOS entitlements/push configured yet).
 *
 * Usage:
 *   import { registerForVoiceCalls, getVoice } from "../lib/TwilioVoice";
 *   useEffect(() => { registerForVoiceCalls(); }, []);
 */
import { Platform } from "react-native";
import { supabase } from "./supabase";

// The SDK contains native modules and cannot be imported in Expo Go —
// guard the import so screens that don't use calling still work there.
let Voice: any = null;
let voiceInstance: any = null;

function loadSdk() {
  if (Voice) return true;
  if (Platform.OS !== "android") return false; // iOS not configured yet
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sdk = require("@twilio/voice-react-native-sdk");
    Voice = sdk.Voice;
    return true;
  } catch (e) {
    console.log("TwilioVoice: SDK not available in this runtime (Expo Go?)", e);
    return false;
  }
}

export function getVoice(): any | null {
  if (!loadSdk()) return null;
  if (!voiceInstance) voiceInstance = new Voice();
  return voiceInstance;
}

/** Fetches a fresh Access Token from the twilio-voice-token edge function. */
export async function fetchVoiceToken(): Promise<{ token: string; identity: string; company_id: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("twilio-voice-token", {});
    if (error || !data?.token) {
      console.log("TwilioVoice: failed to fetch token", error);
      return null;
    }
    return data;
  } catch (e) {
    console.log("TwilioVoice: token fetch threw", e);
    return null;
  }
}

let currentToken: string | null = null;
let currentIdentity: string | null = null;

/**
 * Registers this device to receive incoming calls. Safe to call multiple
 * times (e.g. on every app foreground) — re-registers with a fresh token.
 * No-ops silently on iOS / Expo Go / when Twilio isn't configured, so
 * callers don't need to guard against unsupported environments.
 */
export async function registerForVoiceCalls(): Promise<boolean> {
  const voice = getVoice();
  if (!voice) return false;

  const result = await fetchVoiceToken();
  if (!result) return false;

  try {
    await voice.register(result.token);
    currentToken = result.token;
    currentIdentity = result.identity;
    return true;
  } catch (e) {
    console.log("TwilioVoice: register() failed", e);
    return false;
  }
}

export async function unregisterForVoiceCalls(): Promise<void> {
  const voice = getVoice();
  if (!voice || !currentToken) return;
  try {
    await voice.unregister(currentToken);
  } catch (e) {
    console.log("TwilioVoice: unregister() failed", e);
  } finally {
    currentToken = null;
    currentIdentity = null;
  }
}

export function getCurrentIdentity(): string | null {
  return currentIdentity;
}

/**
 * Places an outgoing call through the in-app softphone. Returns the Call
 * object on success, or null if the softphone isn't available (caller should
 * fall back to the server-side bridge call in that case).
 */
export async function connectVoiceCall(params: Record<string, string>): Promise<any | null> {
  const voice = getVoice();
  if (!voice) return null;

  const result = await fetchVoiceToken();
  if (!result) return null;

  try {
    return await voice.connect(result.token, { params });
  } catch (e) {
    console.log("TwilioVoice: connect() failed", e);
    return null;
  }
}

export function isVoiceSdkAvailable(): boolean {
  return loadSdk();
}

// ── Incoming call invite handling ──────────────────────────────────────────
// The Voice SDK emits a `callInvite` event (app in foreground/background but
// process alive). We stash the invite here and navigate to /incoming-call,
// which reads it back out via getPendingCallInvite(). This avoids having to
// pass a non-serializable SDK object through expo-router params.
let pendingCallInvite: any = null;
let listenersAttached = false;

export function getPendingCallInvite(): any | null {
  return pendingCallInvite;
}

export function clearPendingCallInvite(): void {
  pendingCallInvite = null;
}

/**
 * Attaches the callInvite/registered/error listeners once per app lifetime.
 * Call this from the root layout after registerForVoiceCalls(). Uses a
 * dynamic require for expo-router so this file has no hard dependency on it
 * (keeps it easy to unit test / reuse).
 */
export function attachVoiceListeners(onIncomingCall: (invite: any) => void): void {
  const voice = getVoice();
  if (!voice || listenersAttached) return;
  listenersAttached = true;

  voice.on(Voice.Event.CallInvite, (invite: any) => {
    pendingCallInvite = invite;
    onIncomingCall(invite);
  });

  voice.on(Voice.Event.Error, (err: any) => {
    console.log("TwilioVoice: SDK error", err?.message || err);
  });
}
