// The reader step (P4-T13, D-267): one JSON call with no tools over the client's content. The Builder's prompt
// is built from `builderView(result.fields)` only; the flags go to the owner (round summary and run log).
import {
  buildReaderPrompt,
  parseReaderReply,
  READER_JSON_SCHEMA,
  READER_SYSTEM,
  type ReaderFields,
  type ReaderInput,
} from '@wpe/shared';
import { generateChecked, type ModelClient } from './model';
import { promptHash } from './prompt-hash';

export const readerPromptHash = () => promptHash(READER_SYSTEM, READER_JSON_SCHEMA);

export async function runReader(
  model: ModelClient,
  input: ReaderInput,
  io: { signal?: AbortSignal; progress?: () => void } = {},
): Promise<{ fields: ReaderFields; tokens: number; promptHash: string }> {
  const { system, user } = buildReaderPrompt(input);
  const { value, tokens } = await generateChecked(
    model,
    { system, user, schema: READER_JSON_SCHEMA, ...io },
    (raw) => parseReaderReply(raw, input),
  );
  return { fields: value, tokens, promptHash: readerPromptHash() };
}
