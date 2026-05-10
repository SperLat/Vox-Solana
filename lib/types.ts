export type BountyStatus = "open" | "awarded" | "paid";
export type PaymentStatus = "verified" | "pending_verification" | "verification_failed";

export type Bounty = {
  id: string;
  title: string;
  excerpt: string;
  genre: string;
  reward_sol: number;
  author_wallet: string;
  status: BountyStatus;
  cover_art?: string | null;
  created_at?: string;
};

export type Submission = {
  id: string;
  bounty_id: string;
  narrator_name: string;
  narrator_wallet: string;
  audio_url: string;
  note: string;
  selected: boolean;
  created_at?: string;
};

export type Payment = {
  id: string;
  bounty_id: string;
  submission_id: string;
  payer_wallet: string;
  recipient_wallet: string;
  amount_sol: number;
  tx_signature: string;
  memo: string;
  status: PaymentStatus;
  verified_at?: string | null;
  verification_error?: string | null;
  created_at?: string;
};

export type MarketplaceState = {
  bounties: Bounty[];
  submissions: Submission[];
  payments: Payment[];
};

export type NewBountyInput = Pick<Bounty, "title" | "excerpt" | "genre" | "reward_sol" | "author_wallet" | "cover_art">;

export type NewSubmissionInput = Pick<Submission, "bounty_id" | "narrator_name" | "narrator_wallet" | "note">;

export type NewPaymentInput = Pick<
  Payment,
  | "bounty_id"
  | "submission_id"
  | "payer_wallet"
  | "recipient_wallet"
  | "amount_sol"
  | "tx_signature"
  | "memo"
  | "status"
  | "verified_at"
  | "verification_error"
>;

export type VerificationResponse = {
  status: PaymentStatus;
  payer_wallet: string;
  recipient_wallet: string;
  amount_sol: number;
  memo: string;
  verified_at: string | null;
  verification_error: string | null;
  payment_id: string | null;
  persisted: boolean;
};
