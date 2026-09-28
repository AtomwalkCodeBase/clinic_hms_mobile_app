import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Check, ChevronRight, CircleAlert, CircleCheckBig, CloudUpload, FileSearch, Sparkles } from "lucide-react-native";
import { useUploadTasks, TrackedDoc } from "@/context/UploadTasksContext";
import { NEUTRAL } from "@/theme/themes";

/**
 * The patient's journey for an upload, as a list of steps — the same order apps/records/tasks.py
 * runs each file through: Upload -> Read (OCR/text extraction) -> Classify (keyword rules, then
 * the LLM if needed — one opaque "classifying" stage from the API's point of view, so there is no
 * separate step for that). A failed document's stage of failure isn't reported by the API either
 * (processing_status just says "failed"), so it's shown against the Classify step regardless of
 * where it actually happened.
 */
type StepState = "done" | "current" | "todo" | "warn";
type UploadStep = { key: "upload" | "read" | "classify"; label: string; state: StepState; caption: string; frac: number };

type UploadModel = {
  kind: "run" | "done" | "warn";
  title: string;
  steps: UploadStep[];
  pct: number;
  indeterminate: boolean;
  showBar: boolean;
  barCount: string;
  barUnit: string;
};

const files = (n: number) => `${n} file${n === 1 ? "" : "s"}`;

const step = (key: UploadStep["key"], state: StepState, caption: string, frac: number): UploadStep => ({
  key, label: key === "upload" ? "Upload" : key === "read" ? "Read" : "Classify", state, caption, frac,
});

/** Aggregate the tracked docs' processing_status into the Read/Classify steps' progress. */
function laterSteps(docs: TrackedDoc[]): [UploadStep, UploadStep] {
  const total = docs.length;
  if (!total) return [step("read", "todo", "Next", 0), step("classify", "todo", "Later", 0)];
  const pastRead = docs.filter((d) => d.processing_status !== "queued" && d.processing_status !== "ocr").length;
  const settled = docs.filter((d) => d.processing_status === "completed" || d.processing_status === "failed").length;
  const failed = docs.filter((d) => d.processing_status === "failed").length;

  const read: UploadStep = pastRead === total
    ? step("read", "done", `${total} of ${total}`, 1)
    : step("read", "current", `${pastRead} of ${total}`, pastRead / total);

  let classify: UploadStep;
  if (pastRead === 0) classify = step("classify", "todo", "Later", 0);
  else if (settled < total) classify = step("classify", "current", `${settled} of ${total}`, settled / total);
  else classify = failed > 0 ? step("classify", "warn", `${failed} failed`, 1) : step("classify", "done", `${total} of ${total}`, 1);

  return [read, classify];
}

/** Turns the current/last upload (from UploadTasksContext) into what the UI draws. */
export function useUploadModel(): UploadModel | null {
  const { uploading, uploadPct, fileCount, trackedDocs, settled } = useUploadTasks();

  if (uploading) {
    return {
      kind: "run", title: fileCount > 1 ? "Sending your files" : "Sending your file",
      steps: [step("upload", "current", "Sending", uploadPct / 100), step("read", "todo", "Next", 0), step("classify", "todo", "Later", 0)],
      pct: uploadPct, indeterminate: uploadPct === 0, showBar: true,
      barCount: uploadPct ? `${uploadPct}%` : "", barUnit: "sent",
    };
  }

  if (trackedDocs.length === 0) return null;

  const [read, classify] = laterSteps(trackedDocs);
  const total = trackedDocs.length;
  const failed = trackedDocs.filter((d) => d.processing_status === "failed").length;
  const allSettled = read.state === "done" && (classify.state === "done" || classify.state === "warn");

  if (allSettled) {
    if (!settled) {
      // Still showing briefly before UploadTasksContext clears it.
      return {
        kind: failed ? "warn" : "done",
        title: failed ? `Finished — ${failed} of ${total} couldn't be processed` : "All done",
        steps: [step("upload", "done", files(total), 1), read, classify],
        pct: 100, indeterminate: false, showBar: false, barCount: "", barUnit: "",
      };
    }
    return null;
  }

  const current = read.state === "current" ? read : classify;
  return {
    kind: "run",
    title: current.key === "read" ? (total > 1 ? `Reading ${total} reports` : "Reading your report") : "Classifying your reports",
    steps: [step("upload", "done", files(total), 1), read, classify],
    pct: Math.round(current.frac * 100), indeterminate: current.frac === 0, showBar: true,
    barCount: current.caption, barUnit: current.key === "read" ? "read" : "classified",
  };
}

// ── the bar (Material 3 linear style: rounded, small gap, stop dot) ─────────────

function Bar({ pct, indeterminate, color, track, height = 8 }: { pct: number; indeterminate: boolean; color: string; track: string; height?: number }) {
  const width = useRef(new Animated.Value(pct)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);

  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, width]);

  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [indeterminate, sweep]);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const r = height / 2;

  if (indeterminate) {
    const seg = w * 0.38;
    return (
      <View onLayout={onLayout} style={{ height, borderRadius: r, backgroundColor: track, overflow: "hidden" }}>
        <Animated.View
          style={{
            width: seg, height, borderRadius: r, backgroundColor: color,
            transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-seg, w] }) }],
          }}
        />
      </View>
    );
  }
  const GAP = 3;
  return (
    <View onLayout={onLayout} style={{ height, flexDirection: "row", alignItems: "center" }}>
      <Animated.View style={{ height, borderRadius: r, backgroundColor: color, width: width.interpolate({ inputRange: [0, 100], outputRange: [0, Math.max(0, w - (pct >= 100 ? 0 : GAP))], extrapolate: "clamp" }) }} />
      {pct < 100 && (
        <View style={{ flex: 1, height, marginLeft: GAP, borderRadius: r, backgroundColor: track, justifyContent: "center", alignItems: "flex-end" }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginRight: 2 }} />
        </View>
      )}
    </View>
  );
}

// ── shared helpers ────────────────────────────────────────────────────────────

type Accent = { fill: string; bg: string; text: string };

const WARN = "#E0A33A";

function toneFor(kind: UploadModel["kind"], accent: Accent) {
  return kind === "done"
    ? { border: "#B7DCC3", bg: "#F4FAF6", fg: NEUTRAL.success, bar: NEUTRAL.success, track: "rgba(22,101,52,0.14)" }
    : kind === "warn"
      ? { border: WARN, bg: "#FFF9EC", fg: NEUTRAL.warning, bar: WARN, track: "rgba(133,79,11,0.14)" }
      : { border: NEUTRAL.border, bg: "#FFFFFF", fg: accent.text, bar: accent.fill, track: accent.bg };
}

// ── the stepper: check circles joined by lines (solid once done, dotted while ahead) ──

const NODE = 28;

function Dotted() {
  return (
    <View style={styles.dotted}>
      {Array.from({ length: 9 }).map((_, i) => <View key={i} style={styles.dot} />)}
    </View>
  );
}

function Half({ done, hidden }: { done: boolean; hidden: boolean }) {
  if (hidden) return <View style={{ flex: 1 }} />;
  return <View style={{ flex: 1, marginHorizontal: 4 }}>{done ? <View style={styles.solid} /> : <Dotted />}</View>;
}

function Node({ s, accent, n }: { s: UploadStep; accent: Accent; n: number }) {
  const base = { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: "center" as const, justifyContent: "center" as const };
  if (s.state === "done") return <View style={[base, { backgroundColor: accent.fill }]}><Check size={15} color="#FFFFFF" strokeWidth={3} /></View>;
  if (s.state === "warn") return <View style={[base, { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: WARN }]}><Text style={styles.bang}>!</Text></View>;
  if (s.state === "current") {
    return (
      <View style={{ width: NODE + 8, height: NODE + 8, borderRadius: (NODE + 8) / 2, backgroundColor: accent.bg, alignItems: "center", justifyContent: "center", margin: -4 }}>
        <View style={[base, { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: accent.fill }]}>
          <ActivityIndicator size={14} color={accent.fill} />
        </View>
      </View>
    );
  }
  return <View style={[base, { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#CDD6DC" }]}><Text style={styles.todoN}>{n}</Text></View>;
}

function Stepper({ steps, accent }: { steps: UploadStep[]; accent: Accent }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {steps.map((s, i) => {
        const prevDone = i > 0 && steps[i - 1].state === "done";
        const thisDone = s.state === "done";
        return (
          <View key={s.key} style={{ flex: 1, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", height: NODE }}>
              <Half done={prevDone} hidden={i === 0} />
              <Node s={s} accent={accent} n={i + 1} />
              <Half done={thisDone} hidden={i === steps.length - 1} />
            </View>
            <Text style={[styles.stepLabel, s.state === "todo" && { color: NEUTRAL.textMuted, fontWeight: "400" }]}>{s.label}</Text>
            <Text style={[styles.stepCap, s.state === "warn" && { color: NEUTRAL.warning }]}>{s.caption}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** The progress card at the top of the Uploads screen. */
export function UploadStatusCard({ model, accent }: { model: UploadModel; accent: Accent }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [fade]);
  const tone = toneFor(model.kind, accent);
  const running = model.kind === "run";

  return (
    <Animated.View style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.border, opacity: fade }]}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>{model.title}</Text>
        {running && !model.indeterminate && model.showBar && <Text style={[styles.pct, { color: tone.fg }]}>{Math.round(model.pct)}%</Text>}
      </View>
      <Stepper steps={model.steps} accent={accent} />
      {model.showBar && (
        <View style={{ marginTop: 14 }}>
          <Bar pct={model.pct} indeterminate={model.indeterminate} color={tone.bar} track={tone.track} />
        </View>
      )}
      {(!!model.barCount || !!model.barUnit) && (
        <View style={styles.capRow}>
          <Text style={styles.capL} numberOfLines={2}>
            {!!model.barCount && <Text style={styles.capB}>{model.barCount}</Text>}
            {!!model.barCount && !!model.barUnit ? " " : ""}{model.barUnit}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── slim entry row on Rx & Reports ───────────────────────────────────────────

const currentIndex = (m: UploadModel) => Math.max(0, m.steps.findIndex((s) => s.state === "current" || s.state === "warn"));

/** One tiny bar per step (each fills on its own), the Rx entry row's version of the stepper. */
function SegBar({ steps, accent, kind }: { steps: UploadStep[]; accent: Accent; kind: UploadModel["kind"] }) {
  const tone = toneFor(kind === "done" ? "run" : kind, accent);
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {steps.map((s) => (
        <View key={s.key} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: tone.track, overflow: "hidden" }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: tone.bar, width: `${s.state === "done" || s.state === "warn" ? 100 : Math.round((s.frac || (s.state === "current" ? 0.35 : 0)) * 100)}%` }} />
        </View>
      ))}
    </View>
  );
}

/**
 * One quiet line under the Rx & Reports header that opens the Uploads screen. Shows only while an
 * upload is actively being sent/read/classified, or briefly once it settles — there is nothing to
 * nag about afterward, since a finished document is just a normal row in the list above.
 */
export function UploadsEntryRow({ accent, onOpen }: { patientAwpid?: string; accent?: Accent; onOpen: () => void }) {
  const model = useUploadModel();
  const a = accent ?? { fill: NEUTRAL.textPrimary, bg: NEUTRAL.surfaceAlt, text: NEUTRAL.textPrimary };
  if (!model) return null;

  const i = currentIndex(model);
  const k = model.steps[i]?.key ?? "upload";
  const kind = model.kind;
  const title = kind === "run" ? `Step ${i + 1} of ${model.steps.length} · ${k === "upload" ? "Uploading" : k === "read" ? "Reading" : "Classifying"}` : model.title;
  const sub = model.barCount ? `${model.barCount} ${model.barUnit}`.trim() : model.barUnit;
  const Icon = kind !== "run" ? (kind === "done" ? CircleCheckBig : CircleAlert) : k === "upload" ? CloudUpload : k === "read" ? FileSearch : Sparkles;
  const tile = kind === "warn" ? "#FCEBC8" : kind === "done" ? "#CDEBD6" : a.bg;
  const fg = kind === "warn" ? NEUTRAL.warning : kind === "done" ? NEUTRAL.success : a.text;

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.entry, pressed && { opacity: 0.9 }]}>
      <View style={styles.row}>
        <View style={[styles.entryTile, { backgroundColor: tile }]}>
          <Icon size={16} color={fg} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.entryT} numberOfLines={1}>{title}</Text>
          {!!sub && <Text style={styles.entryS} numberOfLines={1}>{sub}</Text>}
        </View>
        <ChevronRight size={18} color={NEUTRAL.textMuted} strokeWidth={2.2} />
      </View>
      {kind === "run" && (
        <View style={{ marginTop: 9 }}>
          <SegBar steps={model.steps} accent={a} kind={kind} />
        </View>
      )}
    </Pressable>
  );
}

// ── ring for the Home header: one arc per step ───────────────────────────────

const RING = 34;
const R = RING / 2 - 3;
const CIRC = 2 * Math.PI * R;

/** A compact ring beside the bell, split into one arc per step. Renders nothing when idle. */
export function UploadRing({ onOpen }: { onOpen: () => void }) {
  const model = useUploadModel();
  const spin = useRef(new Animated.Value(0)).current;
  const indeterminate = !!model && model.kind === "run" && model.indeterminate;

  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [indeterminate, spin]);

  if (!model) return null;

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const color = model.kind === "warn" ? "#F6C36B" : "#5FD48F";
  const running = model.kind === "run";
  const stepFracs = model.steps.map((s) => (s.state === "done" || s.state === "warn" ? 1 : s.frac || (s.state === "current" ? 0.3 : 0)));
  const n = stepFracs.length;
  const seg = CIRC / n;
  const gap = n > 1 ? 3 : 0;

  return (
    <Pressable onPress={onOpen} hitSlop={8} style={styles.ring}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={RING} height={RING}>
          {stepFracs.map((f, i) => {
            const len = seg - gap;
            const off = -(i * seg);
            return (
              <React.Fragment key={i}>
                <Circle
                  cx={RING / 2} cy={RING / 2} r={R} stroke="rgba(255,255,255,0.28)" strokeWidth={3} fill="none" strokeLinecap="round"
                  strokeDasharray={`${len} ${CIRC}`} strokeDashoffset={off} rotation={-90} origin={`${RING / 2}, ${RING / 2}`}
                />
                {f > 0.02 && (
                  <Circle
                    cx={RING / 2} cy={RING / 2} r={R} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round"
                    strokeDasharray={`${len * Math.min(1, f)} ${CIRC}`} strokeDashoffset={off} rotation={-90} origin={`${RING / 2}, ${RING / 2}`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
      {running ? (
        <Animated.View style={indeterminate ? { transform: [{ rotate }] } : undefined}>
          {(() => {
            const k = model.steps[currentIndex(model)].key;
            return k === "upload"
              ? <CloudUpload size={13} color="#FFFFFF" strokeWidth={2.4} />
              : k === "read"
                ? <FileSearch size={13} color="#FFFFFF" strokeWidth={2.4} />
                : <Sparkles size={13} color="#FFFFFF" strokeWidth={2.4} />;
          })()}
        </Animated.View>
      ) : (
        <Text style={styles.ringT}>{model.kind === "warn" ? "!" : "✓"}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  topRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 14 },
  title: { flex: 1, fontSize: 14.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  pct: { fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  stepLabel: { fontSize: 11.5, fontWeight: "700", color: NEUTRAL.textPrimary, marginTop: 6 },
  stepCap: { fontSize: 10, color: NEUTRAL.textSecondary, marginTop: 1, fontVariant: ["tabular-nums"] },
  bang: { fontSize: 15, fontWeight: "800", color: NEUTRAL.warning },
  todoN: { fontSize: 13, fontWeight: "700", color: "#9AA8B3" },
  solid: { height: 2, borderRadius: 1, backgroundColor: NEUTRAL.success },
  dotted: { height: 2, flexDirection: "row", justifyContent: "space-between", overflow: "hidden", alignItems: "center" },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#B9C5CD" },
  capRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 8, paddingHorizontal: 4, gap: 8 },
  capL: { flex: 1, fontSize: 11.5, color: NEUTRAL.textSecondary },
  capB: { fontWeight: "700", color: NEUTRAL.textPrimary },
  entry: { backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  entryTile: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  entryT: { fontSize: 12.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  entryS: { fontSize: 11, color: NEUTRAL.textSecondary, marginTop: 1 },
  ring: { width: RING, height: RING, borderRadius: RING / 2, backgroundColor: "rgba(0,0,0,0.18)", alignItems: "center", justifyContent: "center" },
  ringT: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
});
