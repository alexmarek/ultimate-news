// lib/config/portfolio.ts
// The ETFs shown in the "Your ETFs" panel. Only market performance in % is shown
// (day, 1 month, year to date) - never holdings or amounts: the site is public.
// Prices are the Xetra listing in EUR.

export interface EtfDef {
  isin: string;
  /** Short display name. */
  name: string;
  /** Xetra ticker (Stooq: `<ticker>.de`, Yahoo: `<TICKER>.DE`). */
  xetra: string;
}

// [Unverified] Matched from the broker's display names; ISINs to be confirmed by the owner.
export const PORTFOLIO_ETFS: EtfDef[] = [
  { isin: 'IE00BK5BQT80', name: 'FTSE All-World (Acc)', xetra: 'VWCE' },
  { isin: 'IE00BYPLS672', name: 'Cyber Security (Acc)', xetra: 'USPY' },
  { isin: 'IE00B0M62S72', name: 'Euro Dividend (Dist)', xetra: 'IQQA' },
  { isin: 'IE00BYX2JD69', name: 'MSCI World SRI (Acc)', xetra: '2B7K' },
];
