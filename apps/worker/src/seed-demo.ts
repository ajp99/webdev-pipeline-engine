// Creates a dummy project and a dummy intake record for the gate demonstration (P1-T09).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@wpe/shared';

export type SeedDeps = {
  createProject(name: string): Promise<string>;
  createArtifact(
    projectId: string,
    type: string,
    content: { [key: string]: Json },
  ): Promise<string>;
};

export async function seedDemo(
  deps: SeedDeps,
  label: string,
): Promise<{ projectId: string; artifactId: string }> {
  const projectId = await deps.createProject(`Gate demo ${label}`);
  const artifactId = await deps.createArtifact(projectId, 'intake_record', {
    dummy: true,
    note: 'Dummy intake record for the phase 1 gate demonstration. Delete the project afterwards.',
  });
  return { projectId, artifactId };
}

export function supabaseSeedDeps(admin: SupabaseClient<Database>): SeedDeps {
  return {
    async createProject(name) {
      // The project starts at the default stage, intake, and is active.
      const { data, error } = await admin.from('projects').insert({ name }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    async createArtifact(projectId, type, content) {
      const { data, error } = await admin
        .from('artifacts')
        .insert({ project_id: projectId, type, version: 1, status: 'draft', content })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
  };
}
