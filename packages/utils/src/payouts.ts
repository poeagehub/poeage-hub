/**
 * Payout balance maths, shared by the vendor, driver and admin apps so every screen agrees.
 *
 *   available = earned − paid − pending
 *
 *  - `earned`  : money from orders that are already DELIVERED (vendor earning or driver earning).
 *  - `paid`    : payout requests an admin has marked paid.
 *  - `pending` : requests still waiting for the admin (this money is reserved, it cannot be requested twice).
 *  - rejected / cancelled requests give the money back, so they are ignored.
 */
export interface PayoutLike {
  amount: number;
  status: string;
}

export interface PayoutBalance {
  earned: number;
  paid: number;
  pending: number;
  available: number;
}

export function summarizePayoutBalance(earned: number, requests: readonly PayoutLike[]): PayoutBalance {
  const sum = (status: string) => requests.filter((r) => r.status === status).reduce((s, r) => s + (r.amount || 0), 0);
  const paid = sum('paid');
  const pending = sum('pending');
  return { earned, paid, pending, available: Math.max(0, earned - paid - pending) };
}

/** Why a requested amount (in paise) is not allowed, or null when it is fine. */
export function payoutAmountError(amount: number, available: number, minimum: number, fmt: (paise: number) => string): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter the amount you want to withdraw.';
  if (!Number.isInteger(amount)) return 'Enter a valid amount (up to 2 decimals).';
  if (amount < minimum) return `The minimum payout is ${fmt(minimum)}.`;
  if (amount > available) return `You can withdraw up to ${fmt(available)} right now.`;
  return null;
}

export const PAYOUT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending review',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
