import { Fragment } from 'react';
import { parseInline, parseSummary, type SummaryBlock } from '@/lib/summary';

/** Inline **bold** / *italic* as React elements (never raw HTML). */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) => (
        <Fragment key={i}>
          {t.bold ? (
            <strong className="font-semibold text-[var(--text)]">{t.text}</strong>
          ) : t.italic ? (
            <em>{t.text}</em>
          ) : (
            t.text
          )}
        </Fragment>
      ))}
    </>
  );
}

const SECTION_HEADING = 'pt-2 text-body-sm font-semibold uppercase tracking-wide text-[var(--text-body)]';

/** Bulleted key points in a beige panel, with an optional small uppercase heading ("Key points" by default). */
function KeyPoints({ heading, items }: { heading?: string; items: string[] }) {
  return (
    <section className="rounded-[14px] bg-[var(--panel)] px-[18px] pb-2 pt-[18px]">
      <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.8px] text-[var(--text-body)]">{heading ?? 'Key points'}</h3>
      <ul>
        {items.map((item, j) => (
          <li key={j} className="flex gap-3 py-2 text-[16px] leading-6 text-[var(--text)]">
            <span aria-hidden="true" className="mt-[9px] h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[var(--highlight)]" />
            <span>
              <Inline text={item} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Renders a stored summary (see lib/summary.ts for the format): a serif lead, short paragraphs,
 * small uppercase sub-headings, and bulleted key points in a beige panel.
 */
export default function SummaryView({ summary }: { summary: string | null | undefined }) {
  const blocks = parseSummary(summary);
  if (blocks.length === 0) return null;

  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block: SummaryBlock = blocks[i];
    switch (block.type) {
      case 'lead':
        out.push(
          <p
            key={i}
            className="font-serif text-headline-lg font-semibold text-[var(--text)] border-l-4 border-[var(--highlight)] pl-4"
          >
            <Inline text={block.text} />
          </p>,
        );
        break;
      case 'heading': {
        const next = blocks[i + 1];
        if (next?.type === 'list') {
          // A heading directly above a list becomes that list's panel title.
          out.push(<KeyPoints key={i} heading={block.text} items={next.items} />);
          i++;
        } else {
          out.push(
            <h3 key={i} className={SECTION_HEADING}>
              {block.text}
            </h3>,
          );
        }
        break;
      }
      case 'list':
        out.push(<KeyPoints key={i} items={block.items} />);
        break;
      default:
        out.push(
          <p key={i} className="text-body-lg text-[var(--text-body)]">
            <Inline text={block.text} />
          </p>,
        );
    }
  }

  return <div className="space-y-4">{out}</div>;
}
