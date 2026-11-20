// Approval metrics for the console (P2-T24, D-293), from timestamps the database already keeps. Pure, so it is
// tested on fixture data.

export type MetricArtifact = {
  id: string;
  project_id: string;
  type: string;
  version: number;
  created_at: string;
};
export type MetricApproval = { artifact_id: string; gate_type: string; role: string; at: string };
/** One Feedback (gate_feedback) or client Request changes (prd_feedback) on an artifact version. */
export type MetricLoop = { artifact_id: string; source: 'feedback' | 'client' };

export type GateTiming = {
  /** e.g. "prd: client", "prototype: owner soft". */
  gate: string;
  decisions: number;
  medianHours: number;
  maxHours: number;
};

export type LoopCount = { project_id: string; type: string; feedback: number; client: number };

const hours = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 3_600_000;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Time to decision per gate: an approval's wait starts when its artifact version was written, or when the
 * gate before it on the same version was approved (the client gate after the owner's soft gate), whichever
 * is later. Hours, rounded to one decimal; gates in a fixed order by artifact type, then gate.
 */
export function gateTimings(
  artifacts: MetricArtifact[],
  approvals: MetricApproval[],
): GateTiming[] {
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const waits = new Map<string, number[]>();
  const byArtifact = new Map<string, MetricApproval[]>();
  for (const ap of approvals) {
    if (!byId.has(ap.artifact_id)) continue;
    byArtifact.set(ap.artifact_id, [...(byArtifact.get(ap.artifact_id) ?? []), ap]);
  }
  for (const [id, list] of byArtifact) {
    const art = byId.get(id)!;
    let start = art.created_at;
    for (const ap of [...list].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
      const gate = `${art.type}: ${ap.role === 'client' ? 'client' : `owner ${ap.gate_type}`}`;
      waits.set(gate, [...(waits.get(gate) ?? []), Math.max(0, hours(start, ap.at))]);
      start = ap.at;
    }
  }
  return [...waits.entries()]
    .map(([gate, w]) => ({
      gate,
      decisions: w.length,
      medianHours: round1(median(w)),
      maxHours: round1(Math.max(...w)),
    }))
    .sort((a, b) => a.gate.localeCompare(b.gate));
}

/** Feedback loops per project and artifact type: the owner's Feedback and the client's Request changes. */
export function feedbackLoops(artifacts: MetricArtifact[], loops: MetricLoop[]): LoopCount[] {
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const counts = new Map<string, LoopCount>();
  for (const l of loops) {
    const a = byId.get(l.artifact_id);
    if (!a) continue;
    const key = `${a.project_id}|${a.type}`;
    const c = counts.get(key) ?? { project_id: a.project_id, type: a.type, feedback: 0, client: 0 };
    c[l.source === 'client' ? 'client' : 'feedback'] += 1;
    counts.set(key, c);
  }
  return [...counts.values()].sort(
    (a, b) => a.project_id.localeCompare(b.project_id) || a.type.localeCompare(b.type),
  );
}
