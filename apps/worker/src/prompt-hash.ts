// D-283: a run records the SHA-256 of the prompt template it used: the system rules and the JSON schema, never
// the client's data, so the hash changes when the rules change and is the same for every project.
import { createHash } from 'node:crypto';

export function promptHash(system: string, schema: object): string {
  return createHash('sha256')
    .update(system)
    .update('\n')
    .update(JSON.stringify(schema))
    .digest('hex');
}
