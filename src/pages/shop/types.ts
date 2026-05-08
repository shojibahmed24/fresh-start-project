export type Package = {
  id: string;
  name: string;
  description: string;
  price: number;
  credits: number;
  is_popular: boolean;
};

export type PaymentMethod = {
  id: string;
  type: "bkash" | "nagad" | "rocket" | "crypto";
  label: string;
  account_number: string;
  instructions: string;
};

export type Order = {
  id: string;
  package_name: string;
  amount: number;
  credits: number;
  payment_method: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  admin_notes: string;
};

export const METHOD_META: Record<PaymentMethod["type"], { label: string; color: string }> = {
  bkash: { label: "bKash", color: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  nagad: { label: "Nagad", color: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  rocket: { label: "Rocket", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  crypto: { label: "Crypto", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

export const STATUS_META: Record<Order["status"], { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
};
