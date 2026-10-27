'use server';

import { revalidatePath } from 'next/cache';
import { buildQueue } from '@wpe/shared';
import { requireRole } from '@/lib/auth';
import { loadQueueInput } from '@/lib/queue-data';
import { createClient } from '@/lib/supabase/server';

/**
 * Accept: asks the database to record the owner's approval of the project's next gate. accept_gate
 * checks the stage, the version, the order of the gates and the intake rule, marks the artifact, and
 * advances the project in the same transaction only when this approval completes the gates (D-258).
 * Nothing advances without the approval record.
 */
export async function acceptGate(formData: FormData) {
  await requireRole('owner', '/owner/queue');
  const projectId = String(formData.get('projectId') ?? '');
  const artifactId = String(formData.get('artifactId') ?? '');
  const gateType = String(formData.get('gateType') ?? '');
  if (gateType !== 'soft' && gateType !== 'hard' && gateType !== 'client')
    throw new Error('Unknown gate type. Reload the queue.');

  const supabase = await createClient();
  const accepted = await supabase.rpc('accept_gate', {
    p_project: projectId,
    p_gate: gateType,
    p_artifact: artifactId,
  });
  if (accepted.error) throw new Error(accepted.error.message);
  revalidatePath('/owner', 'layout');
}

/**
 * Advance: moves a project whose gates for the current stage are all approved to the next stage.
 * Nobody advances a project automatically (not even after the client's sign-off); this is the owner's step,
 * and also the retry when an Accept could not finish advancing.
 */
export async function advanceProject(formData: FormData) {
  await requireRole('owner', '/owner/queue');
  const projectId = String(formData.get('projectId') ?? '');
  const supabase = await createClient();
  const ready = buildQueue(await loadQueueInput(supabase)).ready.find(
    (r) => r.project.id === projectId,
  );
  if (!ready) throw new Error('This project is not ready to advance. Reload the queue.');
  const advanced = await supabase.rpc('advance_stage', {
    p_project: projectId,
    p_next: ready.nextStage,
  });
  if (advanced.error) throw new Error(advanced.error.message);
  revalidatePath('/owner', 'layout');
}

/**
 * Reject: marks the version rejected. The stage stays open and no run starts (D-234); the owner then sends
 * Feedback or edits by hand.
 */
export async function rejectGate(formData: FormData) {
  await requireRole('owner', '/owner/queue');
  const projectId = String(formData.get('projectId') ?? '');
  const artifactId = String(formData.get('artifactId') ?? '');
  const supabase = await createClient();
  const rejected = await supabase.rpc('reject_gate', {
    p_project: projectId,
    p_artifact: artifactId,
  });
  if (rejected.error) throw new Error(rejected.error.message);
  revalidatePath('/owner', 'layout');
}

// The database refuses longer notes too (gate_feedback_body).
const FEEDBACK_MAX = 10_000;

/**
 * Feedback: sends the owner's notes to the stage's agent. The database keeps the version as it is, counts the
 * loop against the cap (spec 03) and queues a run when the stage has an agent, all in one call.
 */
export async function sendFeedback(formData: FormData) {
  await requireRole('owner', '/owner/queue');
  const projectId = String(formData.get('projectId') ?? '');
  const artifactId = String(formData.get('artifactId') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (body === '') throw new Error('Write the feedback first.');
  if (body.length > FEEDBACK_MAX)
    throw new Error(`Feedback is limited to ${FEEDBACK_MAX} characters.`);
  const supabase = await createClient();
  const sent = await supabase.rpc('feedback_gate', {
    p_project: projectId,
    p_artifact: artifactId,
    p_body: body,
  });
  if (sent.error) throw new Error(sent.error.message);
  revalidatePath('/owner', 'layout');
}
