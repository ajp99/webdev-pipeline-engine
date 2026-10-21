'use server';

import { redirect } from 'next/navigation';
import { validateTemplate } from '@wpe/shared';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const back = (error: string): never =>
  redirect(`/owner/projects/new?error=${encodeURIComponent(error)}`);

/**
 * Creates a project from an approved intake template. The template's sections are copied into the
 * project (D-061), and round 1 opens for the owner to fill in (D-298).
 */
export async function createProject(formData: FormData) {
  await requireRole('owner', '/owner/projects/new');
  const name = String(formData.get('name') ?? '').trim();
  const industry = String(formData.get('industry') ?? '');
  if (name === '') return back('Give the project a name');
  if (name.length > 120) return back('The project name is too long');

  const supabase = await createClient();
  const { data: tpl, error: tplError } = await supabase
    .from('intake_templates')
    .select('id, industry, version, sections')
    .eq('industry', industry)
    .eq('status', 'approved')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tplError) throw new Error(tplError.message);
  if (!tpl) return back('That industry has no approved template');
  const snapshot = { industry: tpl.industry, version: tpl.version, sections: tpl.sections };
  const check = validateTemplate(snapshot);
  if (!check.ok) return back(`The template is not valid: ${check.errors[0]}`);

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name,
      industry: tpl.industry,
      intake_template_id: tpl.id,
      intake_template_snapshot: snapshot,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const round = await supabase.from('intake_rounds').insert({ project_id: project.id, round: 1 });
  if (round.error) {
    // No project without its first round.
    await supabase.from('projects').delete().eq('id', project.id);
    throw new Error(round.error.message);
  }
  redirect(`/owner/projects/${project.id}/intake`);
}
