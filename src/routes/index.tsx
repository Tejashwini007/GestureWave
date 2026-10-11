import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { CameraPanel } from "@/components/CameraPanel";
import { Simulator } from "@/components/Simulator";
import {
  COMMANDS,
  GESTURE_LABEL,
  TARGETS,
  initialSim,
  type Gesture,
  type SimState,
  type Target,
} from "@/lib/gestures";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "GestureWave Assist — Hand Gesture Accessibility" },
      { name: "description", content: "Context-aware hand gesture control for accessibility with a live 3D home simulator." },
      { property: "og:title", content: "GestureWave Assist" },
      { property: "og:description", content: "Point at an object, gesture a command, watch the 3D room respond." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

interface LogItem {
  id: number;
  time: string;
  text: string;
  ok: boolean;
}

function App() {
  const [sim, setSim] = useState<SimState>(initialSim);
  const [target, setTarget] = useState<Target | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [threshold, setThreshold] = useState(0.65);
  const [stable, setStable] = useState(12);
  const [live, setLive] = useState<{ g: Gesture; score: number; p: number }>({ g: "None", score: 0, p: 0 });
  const [log, setLog] = useState<LogItem[]>([]);
  const targetRef = useRef(target);
  targetRef.current = target;
  const idRef = useRef(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn;

  const push = (text: string, ok = true) =>
    setLog((l) => [{ id: ++idRef.current, time: new Date().toLocaleTimeString(), text, ok }, ...l].slice(0, 30));

  const speak = useCallback((text: string) => {
    if (!voiceRef.current) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      speechSynthesis.speak(u);
    } catch {}
  }, []);

  const select = useCallback((t: Target) => {
    if (targetRef.current === t) return;
    setTarget(t);
    const label = TARGETS.find((x) => x.id === t)!.label;
    push(`Target selected: ${label}`);
    speak(`${label} selected`);
  }, [speak]);

  const command = useCallback((g: Gesture) => {
    const t = targetRef.current;
    if (!t) {
      push(`${GESTURE_LABEL[g]} ignored — point at a target first`, false);
      speak("Please point at a target first");
      return;
    }
    const cmd = COMMANDS[t][g];
    if (!cmd) {
      push(`${GESTURE_LABEL[g]} has no action for ${t}`, false);
      speak(`${GESTURE_LABEL[g]} has no action here`);
      return;
    }
    setSim((s) => cmd.apply(s));
    push(`${GESTURE_LABEL[g]} → ${cmd.label}`);
    const spoken =
      t === "emergency" && g === "Open_Palm"
        ? "Emergency. I need help."
        : t === "message"
          ? cmd.label.replace(/Say |“|”/g, "")
          : cmd.label;
    speak(spoken);
  }, [speak]);

  const onLive = useCallback((g: Gesture, score: number, p: number) => setLive({ g, score, p }), []);

  const cmds = target ? Object.entries(COMMANDS[target]) : [];

  return (
    <div className={`min-h-screen bg-background text-foreground ${sim.emergency ? "emergency-flash" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            GestureWave <span className="text-primary">Assist</span>
          </h1>
          <p className="text-sm text-muted-foreground">Point to choose · gesture to act · see it happen</p>
        </div>
        <div className="flex gap-2">
          <button
            className={voiceOn ? "chip chip-on" : "chip"}
            onClick={() => {
              setVoiceOn((v) => {
                if (v) speechSynthesis.cancel();
                return !v;
              });
            }}
          >
            🔊 Voice {voiceOn ? "on" : "off"}
          </button>
          <button className="btn-primary" onClick={() => setCamOn((v) => !v)}>
            {camOn ? "Stop camera" : "Start camera"}
          </button>
        </div>
      </header>

      {sim.message && (
        <div className={`mx-6 mt-4 rounded-xl px-6 py-4 text-center font-display text-3xl font-bold ${sim.emergency ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
          {sim.message}
        </div>
      )}

      <main className="grid gap-6 p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="space-y-4">
          <CameraPanel
            enabled={camOn}
            threshold={threshold}
            stableFrames={stable}
            target={target}
            onSelect={select}
            onCommand={command}
            onLive={onLive}
          />
          <div className="panel">
            <div className="flex items-center justify-between text-sm">
              <span>Detected: <b>{GESTURE_LABEL[live.g]}</b></span>
              <span className="text-muted-foreground">confidence {(live.score * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${live.p * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Stability — hold the gesture until the bar fills</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <label>Confidence threshold {(threshold * 100).toFixed(0)}%
                <input type="range" min={0.4} max={0.95} step={0.05} value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="w-full accent-[var(--primary)]" />
              </label>
              <label>Stability frames {stable}
                <input type="range" min={4} max={30} value={stable} onChange={(e) => setStable(+e.target.value)} className="w-full accent-[var(--primary)]" />
              </label>
            </div>
          </div>
          <div className="panel">
            <h2 className="mb-2 font-display font-semibold">Target {target ? `· ${TARGETS.find((t) => t.id === target)!.label}` : ""}</h2>
            <div className="grid grid-cols-3 gap-2">
              {TARGETS.map((t) => (
                <button key={t.id} onClick={() => select(t.id)} className={target === t.id ? "chip chip-on" : "chip"}>{t.label}</button>
              ))}
            </div>
            <h3 className="mt-4 mb-2 text-sm font-semibold">Available gestures</h3>
            {cmds.length === 0 ? (
              <p className="text-sm text-muted-foreground">☝️ Point at a zone on the camera (or tap above) to choose a target.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {cmds.map(([g, c]) => (
                  <button key={g} className="chip text-left" onClick={() => command(g as Gesture)}>
                    {GESTURE_LABEL[g as Gesture]} <span className="text-muted-foreground">→ {c!.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="h-[460px] overflow-hidden rounded-xl border">
            <Simulator s={sim} target={target} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel text-sm">
              <h2 className="mb-2 font-display font-semibold">Room status</h2>
              <ul className="space-y-1">
                <li>Door: <b>{sim.doorOpen ? "Open" : "Closed"}</b></li>
                <li>Light: <b>{sim.lightOn ? `On (level ${sim.brightness})` : "Off"}</b></li>
                <li>Fan: <b>{sim.fanSpeed ? `Speed ${sim.fanSpeed}` : "Off"}</b></li>
                <li>TV: <b>{sim.tvOn ? `Channel ${sim.channel + 1}` : "Off"}</b></li>
                <li>Emergency: <b className={sim.emergency ? "text-destructive" : ""}>{sim.emergency ? "ACTIVE" : "Idle"}</b></li>
              </ul>
            </div>
            <div className="panel text-sm">
              <h2 className="mb-2 font-display font-semibold">Activity</h2>
              <ul className="max-h-40 space-y-1 overflow-auto">
                {log.length === 0 && <li className="text-muted-foreground">No actions yet</li>}
                {log.map((l) => (
                  <li key={l.id} className={l.ok ? "" : "text-muted-foreground"}>
                    <span className="text-muted-foreground">{l.time}</span> {l.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
