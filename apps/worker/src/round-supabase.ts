// The database side of a build round: reads with the service key; the round summary goes only through
// complete_stage_artifact, which also puts the round in review with its claims (P4-T01, P4-T05).
import { basename } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  effectiveAnswers,
  planProblem,
  type Database,
  type Json,
  type LinkAnswer,
  type Plan,
  type Skill,
} from '@wpe/shared';
import type { RoundDeps, RoundLoad, RoundRow } from './round-run';
import { loadSelected, type RegistryRow } from './skills';

const BUCKET = 'intake-uploads';
export const ROUND_SHOT_KIND = 'round_screenshot';
const IMAGE_MAX = 5 * 1024 * 1024;
/** Files the worker itself stores; never client uploads for the Builder. */
const WORKER_KINDS = new Set(['prototype_screenshot', 'reference_screenshot', ROUND_SHOT_KIND]);

/** Packages any round may add without asking (D-286); anything else needs the owner. Small on purpose. */
export const CURATED_PACKAGES = [
  'clsx',
  'zod',
  'lucide-react',
  'date-fns',
  '@heroicons/react',
  'react-hook-form',
];

export function supabaseRoundDeps(
  admin: SupabaseClient<Database>,
  skills: () => { skills: Skill[]; library: () => Promise<RegistryRow[]> },
): Pick<
  RoundDeps,
  'load' | 'startRound' | 'recordMerge' | 'refused' | 'logBacklog' | 'store' | 'write'
> {
  const must = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  return {
    async load(projectId): Promise<RoundLoad | null> {
      const project = must(
        await admin
          .from('projects')
          .select('name, status, stage')
          .eq('id', projectId)
          .maybeSingle(),
      );
      if (!project || project.status !== 'active' || project.stage !== 'build_rounds') return null;
      const lib = skills();
      const [plan, rounds, newest, feedback, intake, backlog, uploads, library] = await Promise.all(
        [
          admin
            .from('artifacts')
            .select('content')
            .eq('project_id', projectId)
            .eq('type', 'plan')
            .eq('status', 'approved')
            .order('version', { ascending: false })
            .limit(1),
          admin
            .from('rounds')
            .select('number, status, merged_at')
            .eq('project_id', projectId)
            .is('change_request_id', null),
          admin
            .from('artifacts')
            .select('id, content')
            .eq('project_id', projectId)
            .eq('type', 'round_summary')
            .order('version', { ascending: false })
            .limit(1),
          admin
            .from('gate_feedback')
            .select('artifact_id, body')
            .eq('project_id', projectId)
            .order('created_at'),
          admin
            .from('intake_responses')
            .select('round, question_id, answer, question')
            .eq('project_id', projectId),
          admin
            .from('backlog_items')
            .select('id, question, owner_answer, client_answer, status')
            .eq('project_id', projectId)
            .order('created_at'),
          admin
            .from('uploads')
            .select('id, kind, storage_path, scan_status')
            .eq('project_id', projectId),
          lib.library(),
        ],
      );
      const planContent = must(plan)?.[0]?.content;
      if (planProblem(planContent) !== null)
        throw new Error('there is no approved plan to build from');
      const p = Object.fromEntries(
        Object.entries(planContent as Record<string, unknown>).filter(([k]) => k !== 'model'),
      ) as Plan;
      const rows: RoundRow[] = (must(rounds) ?? []).map((r) => ({
        number: r.number,
        status: r.status,
        merged: r.merged_at !== null,
      }));
      const top = must(newest)?.[0];
      const topRound = Number((top?.content as { round?: unknown } | null)?.round);
      const notes = (must(feedback) ?? [])
        .filter((f) => f.artifact_id === top?.id)
        .map((f) => f.body.trim())
        .filter(Boolean);
      const items = must(backlog) ?? [];
      // The owner's own answers to the Builder's questions are the owner's words, not client text: they go to the
      // Builder as notes. Client answers relayed by the owner go through the reader (D-298, D-267).
      const ownerAnswers = items
        .filter((b) => b.owner_answer?.trim())
        .slice(-30)
        .map(
          (b) =>
            `Answer to "${b.question.slice(0, 300)}": ${b.owner_answer!.trim().slice(0, 1000)}`,
        );
      const answers = effectiveAnswers(must(intake) ?? []);
      const refs = answers.reference_sites;
      return {
        projectName: project.name,
        plan: p,
        rounds: rows,
        feedback:
          notes.length &&
          Number.isInteger(topRound) &&
          rows.some((r) => r.number === topRound && r.status === 'in_review')
            ? { round: topRound, notes }
            : null,
        ownerAnswers,
        reader: {
          projectName: project.name,
          intake: Object.fromEntries(
            Object.entries(answers).filter(([k]) => k !== 'reference_sites'),
          ),
          clientAnswers: items
            .filter((b) => b.client_answer?.trim())
            .map((b) => ({ id: b.id, question: b.question, answer: b.client_answer!.trim() })),
          uploads: (must(uploads) ?? [])
            .filter((u) => !WORKER_KINDS.has(u.kind) && u.scan_status === 'clean')
            .map((u) => ({ id: u.id, kind: u.kind, name: basename(u.storage_path) })),
          references: Array.isArray(refs)
            ? (refs as LinkAnswer[])
                .map((l) => l.url)
                .filter(Boolean)
                .slice(0, 3)
            : [],
        },
        skills: loadSelected([...new Set(p.rounds.flatMap((r) => r.skills))], lib.skills, library),
        allowedPackages: CURATED_PACKAGES,
      };
    },

    async startRound(projectId, round, branch) {
      must(
        await admin
          .from('rounds')
          .upsert(
            {
              project_id: projectId,
              number: round.number,
              scope: round.scope as unknown as Json,
              branch,
              status: 'building',
            },
            { onConflict: 'project_id,number' },
          ),
      );
    },

    async recordMerge(projectId, round, commit) {
      must(
        await admin
          .from('rounds')
          .update({ merge_commit: commit, merged_at: new Date().toISOString() })
          .eq('project_id', projectId)
          .eq('number', round)
          .eq('status', 'approved')
          .is('merged_at', null),
      );
    },

    async refused(a) {
      must(
        await admin.from('backlog_items').insert({
          project_id: a.project,
          round: a.round,
          run_id: a.run,
          kind: 'refused_command',
          question: `Refused command: ${a.command.slice(0, 1500)}`,
          context: a.reason.slice(0, 2000),
        }),
      );
    },

    async logBacklog(a) {
      if (!a.entries.length) return;
      must(
        await admin.from('backlog_items').insert(
          a.entries.map((e) => ({
            project_id: a.project,
            round: a.round,
            run_id: a.run,
            kind: e.kind,
            question: e.question,
            options: e.options || null,
            assumption: e.assumption || null,
          })),
        ),
      );
    },

    async store(projectId, key, screens) {
      const out = { desktop: '', mobile: '' };
      for (const k of ['desktop', 'mobile'] as const) {
        const image = screens[k];
        if (image.length > IMAGE_MAX) throw new Error(`the ${k} screenshot is over 5 MB`);
        const path = `${projectId}/rounds/${key}-${k}.jpg`;
        must(
          await admin.storage
            .from(BUCKET)
            .upload(path, image, { contentType: 'image/jpeg', upsert: true }),
        );
        must(
          await admin.from('uploads').delete().eq('project_id', projectId).eq('storage_path', path),
        );
        must(
          await admin.from('uploads').insert({
            project_id: projectId,
            kind: ROUND_SHOT_KIND,
            storage_path: path,
            mime_type: 'image/jpeg',
            size_bytes: image.length,
            // Taken by this worker from the local preview, not a client file: nothing to scan.
            scan_status: 'clean',
          }),
        );
        out[k] = path;
      }
      return out;
    },

    async write(a) {
      const { error } = await admin.rpc('complete_stage_artifact', {
        p_project: a.project,
        p_run: a.run,
        p_worker: a.worker,
        p_type: 'round_summary',
        p_content: a.content as unknown as Json,
        p_model: a.model,
        p_prompt_hash: a.promptHash,
      });
      if (error) throw new Error(`complete_stage_artifact: ${error.message}`);
    },
  };
}
