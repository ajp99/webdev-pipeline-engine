// Loads an intake template JSON file into the intake_templates table (P2-T01).
// A (industry, version) pair is immutable: loading the same content again does nothing, and
// different content under the same version is refused (change the version number instead).
import { isDeepStrictEqual } from 'node:util';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateTemplate, type Database, type Json } from '@wpe/shared';

export type StoredTemplate = { sections: unknown; status: string };

export type TemplateDeps = {
  find(industry: string, version: number): Promise<StoredTemplate | null>;
  insert(industry: string, version: number, sections: Json): Promise<void>;
};

export type LoadResult =
  | { outcome: 'loaded'; industry: string; version: number }
  | { outcome: 'unchanged'; industry: string; version: number }
  | { outcome: 'refused'; reason: string }
  | { outcome: 'invalid'; errors: string[] };

export async function loadTemplate(deps: TemplateDeps, raw: unknown): Promise<LoadResult> {
  const check = validateTemplate(raw);
  if (!check.ok) return { outcome: 'invalid', errors: check.errors };
  const { industry, version, sections } = check.template;
  const existing = await deps.find(industry, version);
  if (existing) {
    // Compare after validating the stored value too, so defaults do not cause false differences.
    const stored = validateTemplate({ industry, version, sections: existing.sections });
    if (stored.ok && isDeepStrictEqual(stored.template.sections, sections))
      return { outcome: 'unchanged', industry, version };
    return {
      outcome: 'refused',
      reason: `${industry} version ${version} is already loaded with different content; increase the version number to publish a change`,
    };
  }
  await deps.insert(industry, version, sections as unknown as Json);
  return { outcome: 'loaded', industry, version };
}

export function supabaseTemplateDeps(admin: SupabaseClient<Database>): TemplateDeps {
  return {
    async find(industry, version) {
      const { data, error } = await admin
        .from('intake_templates')
        .select('sections, status')
        .eq('industry', industry)
        .eq('version', version)
        .maybeSingle();
      if (error) throw new Error(`Could not read intake_templates: ${error.message}`);
      return data;
    },
    async insert(industry, version, sections) {
      const { error } = await admin
        .from('intake_templates')
        .insert({ industry, version, sections: sections as NonNullable<Json>, status: 'approved' });
      if (error) throw new Error(`Could not insert the template: ${error.message}`);
    },
  };
}
