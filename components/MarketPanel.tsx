import { Fuel, LineChart } from 'lucide-react';
import type { EtfSnapshot } from '@/lib/markets/snapshot';
import type { PetrolSnapshot } from '@/lib/markets/petrol';

/** `lowerIsBetter`: prices you pay (petrol) are green when they fall and red when they rise. */
function Change({ value, suffix = '%', lowerIsBetter = false }: { value: number | null; suffix?: string; lowerIsBetter?: boolean }) {
  if (value === null) return <span className="text-[var(--text-faint)]">–</span>;
  const up = value > 0;
  const down = value < 0;
  const good = lowerIsBetter ? down : up;
  const bad = lowerIsBetter ? up : down;
  return (
    <span className={`tabular-nums font-medium ${good ? 'text-[var(--success)]' : bad ? 'text-[var(--error)]' : 'text-[var(--text-body)]'}`}>
      {up ? '▲' : down ? '▼' : ''} {Math.abs(value).toFixed(2)}{suffix}
    </span>
  );
}

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

/** Market performance of the reader's ETFs (in % only, never amounts) and German pump prices. */
export default function MarketPanel({ etfs, petrol }: { etfs: EtfSnapshot | null; petrol: PetrolSnapshot | null }) {
  const quotes = etfs?.quotes.filter((q): q is Extract<typeof q, { day: number | null }> => !('error' in q)) ?? [];
  const latest = petrol?.weeks[0];
  const previous = petrol?.weeks[1];
  const diffCt = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null ? Math.round((a - b) * 1000) / 10 : null);

  if (!quotes.length && !latest) return null;

  return (
    <aside className="bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] p-5 space-y-6">
      {quotes.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-body-sm font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">
            <LineChart aria-hidden="true" className="w-4 h-4" /> Your ETFs
          </h2>
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-[var(--text-faint)] text-left">
                <th className="font-normal pb-1">Fund</th>
                <th className="font-normal pb-1 text-right">Day</th>
                <th className="font-normal pb-1 text-right">1M</th>
                <th className="font-normal pb-1 text-right">YTD</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.isin} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-2 text-[var(--text)]">{q.name}</td>
                  <td className="py-2 text-right"><Change value={q.day} /></td>
                  <td className="py-2 text-right"><Change value={q.month} /></td>
                  <td className="py-2 text-right"><Change value={q.ytd} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-body-sm text-[var(--text-faint)]">
            Xetra prices in EUR, last close {dateLabel(quotes[0].lastDate)}. Market performance, not your returns.
          </p>
        </div>
      )}

      {latest && (
        <div>
          <h2 className="flex items-center gap-2 text-body-sm font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">
            <Fuel aria-hidden="true" className="w-4 h-4" /> Petrol in Germany
          </h2>
          <dl className="space-y-2 text-body-sm">
            {([['Super 95', latest.super95, previous?.super95], ['Diesel', latest.diesel, previous?.diesel]] as const).map(([label, now, before]) =>
              now != null ? (
                <div key={label} className="flex items-baseline justify-between gap-2">
                  <dt className="text-[var(--text)]">{label}</dt>
                  <dd className="flex items-baseline gap-3">
                    <span className="tabular-nums font-semibold text-[var(--text)]">{now.toFixed(3)} €/L</span>
                    <Change value={diffCt(now, before)} suffix=" ct" lowerIsBetter />
                  </dd>
                </div>
              ) : null,
            )}
          </dl>
          <p className="mt-2 text-body-sm text-[var(--text-faint)]">
            National average incl. taxes{latest.date ? `, week of ${dateLabel(latest.date)}` : ''}; change vs previous week. Source: EU Weekly Oil Bulletin.
          </p>
        </div>
      )}
    </aside>
  );
}
