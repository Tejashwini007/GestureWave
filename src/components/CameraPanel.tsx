import { useEffect, useRef, useState } from "react";
import { TARGETS, type Gesture, type Target } from "@/lib/gestures";

interface Props {
  enabled: boolean;
  threshold: number;
  stableFrames: number;
  target: Target | null;
  onSelect: (t: Target) => void;
  onCommand: (g: Gesture) => void;
  onLive: (g: Gesture, score: number, progress: number) => void;
}

const COLS = 3;

export function CameraPanel({ enabled, threshold, stableFrames, target, onSelect, onCommand, onLive }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Camera off");
  const [hover, setHover] = useState<Target | null>(null);
  const cb = useRef({ onSelect, onCommand, onLive, threshold, stableFrames });
  cb.current = { onSelect, onCommand, onLive, threshold, stableFrames };

  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let recognizer: import("@mediapipe/tasks-vision").GestureRecognizer | null = null;

    (async () => {
      try {
        setStatus("Loading hand model…");
        const { FilesetResolver, GestureRecognizer } = await import("@mediapipe/tasks-vision");
        const fs = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
        );
        recognizer = await GestureRecognizer.createFromOptions(fs, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
        setStatus("Starting camera…");
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setStatus("Tracking");

        let last: Gesture = "None";
        let count = 0;
        let fired = false;
        let lastTs = -1;
        let zoneCount = 0;
        let lastZone: Target | null = null;

        const loop = () => {
          if (stop || !recognizer) return;
          const now = performance.now();
          if (v.readyState >= 2 && now !== lastTs) {
            lastTs = now;
            const res = recognizer.recognizeForVideo(v, now);
            const c = canvasRef.current!;
            const ctx = c.getContext("2d")!;
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            ctx.clearRect(0, 0, c.width, c.height);

            const top = res.gestures[0]?.[0];
            let g = (top?.categoryName || "None") as Gesture;
            const score = top?.score ?? 0;
            if (score < cb.current.threshold) g = "None";
            const lm = res.landmarks[0];

            if (lm) {
              ctx.fillStyle = "oklch(0.82 0.16 75)";
              for (const p of lm) {
                ctx.beginPath();
                ctx.arc(p.x * c.width, p.y * c.height, 4, 0, Math.PI * 2);
                ctx.fill();
              }
            }

            // Pointing → target selection via fingertip zone
            if (g === "Pointing_Up" && lm) {
              const x = 1 - lm[8]!.x; // mirrored
              const y = lm[8]!.y;
              const col = Math.min(COLS - 1, Math.floor(x * COLS));
              const row = Math.min(1, Math.floor(y * 2));
              const zone = TARGETS[row * COLS + col]!.id;
              setHover(zone);
              if (zone === lastZone) zoneCount++;
              else {
                zoneCount = 0;
                lastZone = zone;
              }
              cb.current.onLive(g, score, Math.min(1, zoneCount / cb.current.stableFrames));
              if (zoneCount === cb.current.stableFrames) cb.current.onSelect(zone);
              last = g;
              count = 0;
            } else {
              setHover(null);
              zoneCount = 0;
              lastZone = null;
              if (g === last) count++;
              else {
                last = g;
                count = 0;
                fired = false;
              }
              const progress = g === "None" ? 0 : Math.min(1, count / cb.current.stableFrames);
              cb.current.onLive(g, score, progress);
              if (g !== "None" && !fired && count >= cb.current.stableFrames) {
                fired = true;
                cb.current.onCommand(g);
              }
            }
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        setStatus("Camera/model error: " + (e as Error).message);
      }
    })();

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      recognizer?.close();
      setStatus("Camera off");
    };
  }, [enabled]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
        {TARGETS.map((t) => (
          <div
            key={t.id}
            className={`zone ${target === t.id ? "zone-selected" : ""} ${hover === t.id ? "zone-hover" : ""}`}
          >
            <span className="zone-label">{t.label}</span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-1 text-xs text-foreground">{status}</div>
    </div>
  );
}
