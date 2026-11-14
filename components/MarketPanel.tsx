import type { EtfSnapshot } from '@/lib/markets/snapshot';
import type { PetrolSnapshot } from '@/lib/markets/petrol';

function Change({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span>–</span>;
  return <span className="tabular-nums">{value > 0 ? '+' : value < 0 ? '−' : ''}{Math.abs(value).toFixed(2)}{suffix}</span>;
}
const dateLabel = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

export default function MarketPanel({ etfs, petrol }: { etfs: EtfSnapshot | null; petrol: PetrolSnapshot | null }) {
  const quotes = etfs?.quotes.filter((q): q is Extract<typeof q, { day: number | null }> => !('error' in q)) ?? [];
  const latest = petrol?.weeks[0]; const previous = petrol?.weeks[1];
  const diff = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null ? Math.round((a - b) * 1000) / 10 : null;
  if (!quotes.length && !latest) return null;
  return <aside className="text-ui text-[var(--ink)]">
    <div className="flex gap-5 overflow-x-auto whitespace-nowrap border-y border-[var(--rule)] bg-[var(--wash)] py-3 md:hidden" aria-label="Your markets">
      {quotes.map((q) => <span key={q.isin}>{q.name} <strong><Change value={q.day} /></strong></span>)}
      {latest?.super95 != null && <span>Super 95 <strong>{latest.super95.toFixed(3)} €</strong></span>}
    </div>
    <div className="hidden border-t-[3px] border-[var(--ink)] pt-3 md:block">
      <h2 className="mb-3 text-label font-bold uppercase tracking-[1.2px]">Your markets</h2>
      {quotes.length > 0 && <><table className="w-full whitespace-nowrap text-left text-meta tabular-nums"><thead><tr className="border-b border-[var(--ink)] text-[var(--meta)]"><th className="pb-2 font-normal">Fund</th><th className="pb-2 text-right font-normal">Day</th><th className="pb-2 text-right font-normal">1 month</th><th className="pb-2 text-right font-normal">This year</th></tr></thead><tbody>
        {quotes.map((q) => <tr key={q.isin} className="border-b border-[var(--rule)]"><td className="py-2 pr-2">{q.name}</td><td className="py-2 text-right"><Change value={q.day} /></td><td className="py-2 text-right"><Change value={q.month} /></td><td className="py-2 text-right"><Change value={q.ytd} /></td></tr>)}
      </tbody></table><p className="mt-2 text-meta text-[var(--meta)]">Xetra, EUR, close of {dateLabel(quotes[0].lastDate)}; market performance, not your returns.</p></>}
      {latest && <table className="mt-5 w-full whitespace-nowrap text-left text-meta tabular-nums"><thead><tr className="border-b border-[var(--ink)] text-[var(--meta)]"><th className="pb-2 font-normal">Petrol in Germany</th><th className="pb-2 text-right font-normal">Per litre</th><th className="pb-2 text-right font-normal">Week</th></tr></thead><tbody>{([['Super 95', latest.super95, previous?.super95], ['Diesel', latest.diesel, previous?.diesel]] as const).map(([label, now, before]) => now != null && <tr key={label} className="border-b border-[var(--rule)]"><td className="py-2">{label}</td><td className="py-2 text-right font-semibold">{now.toFixed(3)} €</td><td className="py-2 text-right"><Change value={diff(now, before)} suffix=" ct" /></td></tr>)}</tbody></table>}
      {latest && <p className="mt-2 text-meta text-[var(--meta)]">Petrol: national average incl. taxes{latest.date ? `, week of ${dateLabel(latest.date)}` : ''}.</p>}
    </div>
  </aside>;
}
