export interface MarketStatus {
  isOpen: boolean;
  label: string;
  detail: string;
}

/** NSE regular session: 09:15–15:30 IST, Monday to Friday. */
export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60_000);
  const day = ist.getUTCDay();
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const open = 9 * 60 + 15;
  const close = 15 * 60 + 30;
  const weekday = day >= 1 && day <= 5;

  if (weekday && minutes >= open && minutes <= close) {
    return { isOpen: true, label: "Market open", detail: "NSE regular session · 09:15–15:30 IST" };
  }
  if (!weekday) {
    return { isOpen: false, label: "Market closed", detail: "Weekend — prices are unchanged, not missing" };
  }
  return {
    isOpen: false,
    label: "Market closed",
    detail: minutes < open ? "Pre-open — session starts 09:15 IST" : "Session ended at 15:30 IST",
  };
}

export function formatIst(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function formatIstDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}
