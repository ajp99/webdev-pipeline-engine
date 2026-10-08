'use server';

import { revalidatePath } from 'next/cache';
import { remainingGates, STAGES } from '@wpe/shared';
import { requireRole } from '@/lib/auth';
import { loadQueueInput } from '@/lib/queue-data';
import { createClient } from '@/lib/supabase/server';

/**
 * Accept: records the owner's approval for the next gate of a project's stage and, when no gate of
 * the stage is left, advances the project through advance_stage(). Nothing advances without the
 * approval record; the database checks it again.
 */
export async function acceptGate(formData: FormData) {
  const session = await requireRole('owner', '/owner/queue');
  const projectId = String(formData.get('projectId') ?? '');
  const artifactId = String(formData.get('artifactId') ?? '');
  const gateType = String(formData.get('gateType') ?? '');

  const supabase = await createClient();
  const before = await loadQueueInput(supabase);
  const next = remainingGates(before, projectId)[0];
  // The form may be stale (someone else approved, the artifact was replaced): only act on the live next gate.
  if (
    !next ||
    !next.actionable ||
    next.round !== null ||
    next.artifactId !== artifactId ||
    next.gateType !== gateType
  ) {
    throw new Error('This gate is no longer waiting for your approval. Reload the queue.');
  }

  const inserted = await supabase.from('approvals').insert({
    artifact_id: artifactId,
    approved_by: session.userId,
    role: 'owner',
    gate_type: next.gateType,
  });
  if (inserted.error) throw new Error(inserted.error.message);

  const after = await loadQueueInput(supabase);
  if (remainingGates(after, projectId).length === 0) {
    const approved = await supabase
      .from('artifacts')
      .update({ status: 'approved' })
      .eq('id', artifactId);
    if (approved.error) throw new Error(approved.error.message);
    const stage = next.stage;
    const nextStage = STAGES[STAGES.indexOf(stage) + 1];
    if (!nextStage) throw new Error(`No stage follows ${stage}`);
    const advanced = await supabase.rpc('advance_stage', {
      p_project: projectId,
      p_next: nextStage,
    });
    if (advanced.error) throw new Error(advanced.error.message);
  }
  revalidatePath('/owner', 'layout');
}
