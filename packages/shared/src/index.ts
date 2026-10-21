// Stage and gate types derived from docs/spec arrive in P1-T03/P1-T04.
export { STAGES } from './stages';
export type { Stage } from './stages';
import type { Stage } from './stages';

// Compile-time check: the hand-written Stage union equals the generated enum (P1-T04).
import type { Database } from './database.types';
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const stageTypesAgree: Equal<Stage, Database['public']['Enums']['stage']> = true;
export type { Database, Json } from './database.types';
export { Constants } from './database.types';

export * from './queue';
