// lib/config/reader.ts
// Who the digest is for. Claude uses this to rate how much each story matters
// (importance) and to write the "Why it matters to you" line (forYou).
// Keep it to facts that change what is relevant; no amounts or account details.

export const READER_PROFILE = [
  'Lives in Germany and reads in English.',
  'Invests long-term in global equity ETFs (MSCI World type), a euro-area dividend ETF and a cybersecurity ETF.',
  'Buys petrol in Germany, so fuel prices matter.',
].join(' ');
