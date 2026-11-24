'use server';
// The owner's backlog (P4-T07, P4-T08, D-298): answer a question, accept the agent's assumption, mark an item
// ask-client and later enter the client's answer (relayed outside the pipeline) with what it should trigger.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import type { Database } from '@wpe/shared';
import { createClient } from '@/lib/supabase/server';

const MAX = 4000;
function back(projectId: string, key: 'notice' | 'error', text: string): never {
  revalidatePath(`/owner/projects/${projectId}/backlog`);
  redirect(`/owner/projects/${projectId}/backlog?${key}=${encodeURIComponent(text)}`);
}

export async function actOnBacklog(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  const action = String(formData.get('action') ?? '');
  const text = String(formData.get('text') ?? '').trim();
  await requireRole('owner', `/owner/projects/${projectId}/backlog`);
  const supabase = await createClient();
  const item = await supabase
    .from('backlog_items')
    .select('id, status, ask_client, question, round')
    .eq('id', itemId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (item.error) throw new Error(item.error.message);
  if (!item.data) return back(projectId, 'error', 'That item is not in this project.');
  if (text.length > MAX) return back(projectId, 'error', `Keep it under ${MAX} characters.`);
  const open = item.data.status === 'open';
  let patch: Database['public']['Tables']['backlog_items']['Update'];
  if (action === 'answer') {
    // An item sent to the client takes the client's answer only, which goes to the Builder through the reader.
    if (item.data.ask_client)
      return back(projectId, 'error', "This item is with the client: enter the client's answer.");
    if (!text) return back(projectId, 'error', 'Write the answer first.');
    patch = { owner_answer: text, status: 'answered' };
  } else if (action === 'accept_assumption') {
    patch = { status: 'assumption_accepted' };
  } else if (action === 'ask_client') {
    if (!open) return back(projectId, 'error', 'Only an open item can go to the client.');
    patch = { ask_client: true };
  } else if (action === 'next_round' || action === 'immediate_fix') {
    if (!item.data.ask_client) return back(projectId, 'error', 'Mark the item ask-client first.');
    if (!text) return back(projectId, 'error', "Enter the client's answer first.");
    patch = { client_answer: text, answer_action: action, status: 'answered' };
  } else {
    return back(projectId, 'error', 'Choose what to do.');
  }
  const done = await supabase
    .from('backlog_items')
    .update(patch)
    .eq('id', itemId)
    .eq('status', item.data.status)
    .select('id');
  if (done.error) throw new Error(done.error.message);
  if ((done.data ?? []).length === 0)
    return back(projectId, 'error', 'The item changed meanwhile; look again.');
  if (action === 'immediate_fix') {
    // An immediate fix is a Feedback version of the round in review, carrying the client's answer (P4-T07). The
    // database checks the round's Feedback limit; the answer stays recorded either way.
    const art = await supabase
      .from('artifacts')
      .select('id, content')
      .eq('project_id', projectId)
      .eq('type', 'round_summary')
      .eq('status', 'draft')
      .order('version', { ascending: false })
      .limit(1);
    if (art.error) throw new Error(art.error.message);
    const a = art.data?.[0];
    if (!a)
      return back(
        projectId,
        'notice',
        'Answer saved; no round is in review, so the next round uses it.',
      );
    const round = Number((a.content as { round?: unknown } | null)?.round);
    const fb = await supabase.rpc('feedback_gate', {
      p_project: projectId,
      p_artifact: a.id,
      ...(Number.isInteger(round) ? { p_round: round } : {}),
      // The client's words reach the Builder only through the reader stage (D-267, D-298), never in this note.
      p_body: `The client answered the question "${item.data.question.slice(0, 300)}". Their answer is in the client fields; apply it to this round.`,
    });
    if (fb.error)
      return back(
        projectId,
        'notice',
        `Answer saved; the immediate fix was refused: ${fb.error.message}`,
      );
    return back(projectId, 'notice', 'Answer saved and sent to the round in review as Feedback.');
  }
  // Triage can unblock the next round (P4-T01): queue a build-rounds run; one already queued or running is fine.
  const q = await supabase.rpc('enqueue_run', { p_project: projectId, p_stage: 'build_rounds' });
  if (q.error && !/already|not at|stage/.test(q.error.message))
    return back(projectId, 'notice', `Saved; the next run was not queued: ${q.error.message}`);
  return back(projectId, 'notice', 'Saved.');
}
