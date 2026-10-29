import type { Answer, FileAnswer, LinkAnswer, TemplateQuestion } from '@wpe/shared';
import { field, linkNoteField, linkUrlField, noneField } from '../lib/intake-form';
import { styleCardFor } from '../lib/style-cards';

const input = 'rounded border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50';

/** One question of the intake form. Plain HTML inputs; the section form posts them together. */
export function IntakeQuestion({
  q,
  value,
  fileCount,
  disabled,
}: {
  q: TemplateQuestion;
  value: Answer | null | undefined;
  fileCount: number;
  disabled: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1" disabled={disabled}>
      <legend className="text-sm font-medium">
        {q.label}
        {q.required ? <span className="ml-1 text-red-700">*</span> : null}
      </legend>
      {q.help ? <p className="text-xs text-neutral-600">{q.help}</p> : null}
      <Control q={q} value={value} fileCount={fileCount} />
    </fieldset>
  );
}

function Control({
  q,
  value,
  fileCount,
}: {
  q: TemplateQuestion;
  value: Answer | null | undefined;
  fileCount: number;
}) {
  switch (q.type) {
    case 'short_text':
      return (
        <input
          name={field(q.id)}
          defaultValue={typeof value === 'string' ? value : ''}
          maxLength={300}
          className={input}
        />
      );
    case 'long_text':
      return (
        <textarea
          name={field(q.id)}
          defaultValue={typeof value === 'string' ? value : ''}
          maxLength={5000}
          rows={4}
          className={input}
        />
      );
    case 'single_choice':
      return (
        <div className="flex flex-col gap-1">
          {q.options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field(q.id)}
                value={o.value}
                defaultChecked={value === o.value}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    case 'multiple_choice':
      return (
        <div className="flex flex-col gap-1">
          {q.max_selections ? (
            <p className="text-xs text-neutral-600">Pick up to {q.max_selections}.</p>
          ) : null}
          {q.options.map((o) => {
            const card = styleCardFor(q.id, o.value);
            return (
              <label
                key={o.value}
                className={
                  card
                    ? 'flex flex-col gap-1 rounded border border-neutral-300 p-2 text-sm'
                    : 'flex items-center gap-2 text-sm'
                }
              >
                {card ? (
                  <img src={card.image} alt="" width={240} height={160} className="h-auto w-60" />
                ) : null}
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={field(q.id)}
                    value={o.value}
                    defaultChecked={Array.isArray(value) && (value as string[]).includes(o.value)}
                  />
                  {o.label}
                </span>
                {card ? <span className="text-xs text-neutral-600">{card.blurb}</span> : null}
              </label>
            );
          })}
        </div>
      );
    case 'links': {
      const links = Array.isArray(value) ? (value as LinkAnswer[]) : [];
      return (
        <div className="flex flex-col gap-2">
          {Array.from({ length: q.max_links }, (_, n) => (
            <div key={n} className="flex flex-col gap-1 sm:flex-row">
              <input
                name={linkUrlField(q.id, n)}
                defaultValue={links[n]?.url ?? ''}
                placeholder="https://"
                inputMode="url"
                className={`${input} flex-1`}
              />
              {q.note_per_link ? (
                <input
                  name={linkNoteField(q.id, n)}
                  defaultValue={links[n]?.note ?? ''}
                  placeholder="What the client likes about it"
                  className={`${input} flex-1`}
                />
              ) : null}
            </div>
          ))}
        </div>
      );
    }
    case 'file_upload': {
      const none = (value as FileAnswer | null | undefined)?.none === true;
      return (
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-xs text-neutral-600">
            {fileCount} file{fileCount === 1 ? '' : 's'} added. Accepted: {q.accept.join(', ')}. Add
            files in the Files box under the form.
          </p>
          {q.none_allowed ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" name={noneField(q.id)} defaultChecked={none} />
              The client has none
            </label>
          ) : null}
        </div>
      );
    }
  }
}
