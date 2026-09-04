export interface Instrument {
  symbol: string;
  companyName: string;
  sector: string;
}

export const INSTRUMENTS: Instrument[] = [
  { symbol: "RELIANCE", companyName: "Reliance Industries", sector: "Energy" },
  { symbol: "TCS", companyName: "Tata Consultancy Services", sector: "IT" },
  { symbol: "INFY", companyName: "Infosys", sector: "IT" },
  { symbol: "HDFCBANK", companyName: "HDFC Bank", sector: "Financials" },
  { symbol: "ICICIBANK", companyName: "ICICI Bank", sector: "Financials" },
  { symbol: "SBIN", companyName: "State Bank of India", sector: "Financials" },
  { symbol: "ITC", companyName: "ITC", sector: "FMCG" },
  { symbol: "LT", companyName: "Larsen & Toubro", sector: "Industrials" },
  { symbol: "MARUTI", companyName: "Maruti Suzuki India", sector: "Auto" },
  { symbol: "AXISBANK", companyName: "Axis Bank", sector: "Financials" },
  { symbol: "BHARTIARTL", companyName: "Bharti Airtel", sector: "Telecom" },
  { symbol: "SUNPHARMA", companyName: "Sun Pharmaceutical Industries", sector: "Pharma" },
  { symbol: "WIPRO", companyName: "Wipro", sector: "IT" },
  { symbol: "ADANIENT", companyName: "Adani Enterprises", sector: "Conglomerate" },
  { symbol: "TATAMOTORS", companyName: "Tata Motors", sector: "Auto" },
];

const BY_SYMBOL = new Map(INSTRUMENTS.map((i) => [i.symbol, i]));

export function findInstrument(symbol: string): Instrument | undefined {
  return BY_SYMBOL.get(symbol.trim().toUpperCase());
}

export function isSupportedSymbol(symbol: string): boolean {
  return BY_SYMBOL.has(symbol.trim().toUpperCase());
}

export function searchInstruments(query: string): Instrument[] {
  const q = query.trim().toLowerCase();
  if (!q) return INSTRUMENTS;
  return INSTRUMENTS.filter(
    (i) => i.symbol.toLowerCase().includes(q) || i.companyName.toLowerCase().includes(q),
  );
}
