export type Gesture =
  | "Open_Palm"
  | "Closed_Fist"
  | "Pointing_Up"
  | "Thumb_Up"
  | "Thumb_Down"
  | "Victory"
  | "ILoveYou"
  | "OK_Sign"
  | "Rock_On"
  | "Three_Fingers"
  | "Four_Fingers"
  | "None";

export type Target = "door" | "light" | "fan" | "tv" | "emergency" | "message";

export const TARGETS: { id: Target; label: string }[] = [
  { id: "door", label: "Door" },
  { id: "light", label: "Light" },
  { id: "fan", label: "Fan" },
  { id: "tv", label: "TV" },
  { id: "emergency", label: "Emergency" },
  { id: "message", label: "Messages" },
];

export const GESTURE_LABEL: Record<Gesture, string> = {
  Open_Palm: "✋ Open palm",
  Closed_Fist: "✊ Fist",
  Pointing_Up: "☝️ Point",
  Thumb_Up: "👍 Thumb up",
  Thumb_Down: "👎 Thumb down",
  Victory: "✌️ Victory",
  ILoveYou: "🤟 Love you",
  OK_Sign: "👌 OK sign",
  Rock_On: "🤘 Rock sign",
  Three_Fingers: "🖖 Three fingers",
  Four_Fingers: "🖐️ Four fingers",
  None: "—",
};

/** Custom gesture detection from 21 hand landmarks (tip farther from wrist than pip = extended). */
export function detectCustom(lm: { x: number; y: number }[]): Gesture | null {
  const d = (a: number, b: number) => Math.hypot(lm[a]!.x - lm[b]!.x, lm[a]!.y - lm[b]!.y);
  const ext = (tip: number, pip: number) => d(tip, 0) > d(pip, 0) * 1.12;
  const thumb = ext(4, 2);
  const index = ext(8, 6);
  const middle = ext(12, 10);
  const ring = ext(16, 14);
  const pinky = ext(20, 18);
  if (d(4, 8) < 0.07 && middle && ring && pinky) return "OK_Sign";
  if (index && pinky && !middle && !ring && !thumb) return "Rock_On";
  if (index && middle && ring && !pinky && !thumb) return "Three_Fingers";
  if (index && middle && ring && pinky && !thumb) return "Four_Fingers";
  return null;
}

export interface SimState {
  doorOpen: boolean;
  lightOn: boolean;
  brightness: number; // 1..3
  fanSpeed: number; // 0..3
  tvOn: boolean;
  channel: number;
  emergency: boolean;
  message: string | null;
}

export const initialSim: SimState = {
  doorOpen: false,
  lightOn: false,
  brightness: 2,
  fanSpeed: 0,
  tvOn: false,
  channel: 0,
  emergency: false,
  message: null,
};

/** Context-aware mapping: same gesture → different action per target. */
export const COMMANDS: Record<Target, Partial<Record<Gesture, { label: string; apply: (s: SimState) => SimState }>>> = {
  door: {
    Open_Palm: { label: "Open door", apply: (s) => ({ ...s, doorOpen: true }) },
    Closed_Fist: { label: "Close door", apply: (s) => ({ ...s, doorOpen: false }) },
    OK_Sign: { label: "Toggle door", apply: (s) => ({ ...s, doorOpen: !s.doorOpen }) },
  },
  light: {
    Open_Palm: { label: "Light on", apply: (s) => ({ ...s, lightOn: true }) },
    Closed_Fist: { label: "Light off", apply: (s) => ({ ...s, lightOn: false }) },
    Thumb_Up: { label: "Brighter", apply: (s) => ({ ...s, lightOn: true, brightness: Math.min(3, s.brightness + 1) }) },
    Thumb_Down: { label: "Dimmer", apply: (s) => ({ ...s, brightness: Math.max(1, s.brightness - 1) }) },
    Three_Fingers: { label: "Max brightness", apply: (s) => ({ ...s, lightOn: true, brightness: 3 }) },
    Four_Fingers: { label: "Night light", apply: (s) => ({ ...s, lightOn: true, brightness: 1 }) },
  },
  fan: {
    Open_Palm: { label: "Fan on", apply: (s) => ({ ...s, fanSpeed: Math.max(1, s.fanSpeed) }) },
    Closed_Fist: { label: "Fan off", apply: (s) => ({ ...s, fanSpeed: 0 }) },
    Thumb_Up: { label: "Speed up", apply: (s) => ({ ...s, fanSpeed: Math.min(3, s.fanSpeed + 1) }) },
    Thumb_Down: { label: "Slow down", apply: (s) => ({ ...s, fanSpeed: Math.max(0, s.fanSpeed - 1) }) },
    Three_Fingers: { label: "Max speed", apply: (s) => ({ ...s, fanSpeed: 3 }) },
    OK_Sign: { label: "Toggle fan", apply: (s) => ({ ...s, fanSpeed: s.fanSpeed ? 0 : 1 }) },
  },
  tv: {
    Open_Palm: { label: "TV on", apply: (s) => ({ ...s, tvOn: true }) },
    Closed_Fist: { label: "TV off", apply: (s) => ({ ...s, tvOn: false }) },
    Victory: { label: "Next channel", apply: (s) => ({ ...s, tvOn: true, channel: (s.channel + 1) % 4 }) },
    Three_Fingers: { label: "Previous channel", apply: (s) => ({ ...s, tvOn: true, channel: (s.channel + 3) % 4 }) },
    OK_Sign: { label: "Toggle TV", apply: (s) => ({ ...s, tvOn: !s.tvOn }) },
  },
  emergency: {
    Open_Palm: { label: "SOS — call for help", apply: (s) => ({ ...s, emergency: true, message: "🚨 EMERGENCY — I need help now" }) },
    Closed_Fist: { label: "Cancel alert", apply: (s) => ({ ...s, emergency: false, message: null }) },
    OK_Sign: { label: "I'm OK — cancel alert", apply: (s) => ({ ...s, emergency: false, message: null }) },
  },
  message: {
    Thumb_Up: { label: "Say “Yes”", apply: (s) => ({ ...s, message: "Yes" }) },
    Thumb_Down: { label: "Say “No”", apply: (s) => ({ ...s, message: "No" }) },
    Victory: { label: "Say “I need water”", apply: (s) => ({ ...s, message: "I need water, please" }) },
    ILoveYou: { label: "Say “Thank you”", apply: (s) => ({ ...s, message: "Thank you ❤" }) },
    Open_Palm: { label: "Say “Hello”", apply: (s) => ({ ...s, message: "Hello!" }) },
    Closed_Fist: { label: "Clear message", apply: (s) => ({ ...s, message: null }) },
    Three_Fingers: { label: "Say “Please call the doctor”", apply: (s) => ({ ...s, message: "Please call the doctor" }) },
    Four_Fingers: { label: "Say “I am hungry”", apply: (s) => ({ ...s, message: "I am hungry" }) },
    OK_Sign: { label: "Say “I am okay”", apply: (s) => ({ ...s, message: "I am okay 👌" }) },
    Rock_On: { label: "Say “I need the bathroom”", apply: (s) => ({ ...s, message: "I need the bathroom" }) },
  },
};
