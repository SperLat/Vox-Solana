import { PublicKey } from "@solana/web3.js";

export const APP_NAME = "Project Vox";
export const LAMPORTS_PER_SOL_NUMBER = 1_000_000_000;
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const SOLANA_EXPLORER_CLUSTER = "devnet";
export const BOUNTIES_TABLE = "project_vox_bounties";
export const SUBMISSIONS_TABLE = "project_vox_submissions";
export const PAYMENTS_TABLE = "project_vox_payments";
export const STORAGE_BUCKET = "project-vox-auditions";

export const DEMO_AUTHOR_WALLET = "7p1RKdQbJnW2A4dzJns7cLGtYGbTRTuv7RRv9pZV4nEP";
export const DEMO_NARRATOR_WALLET = process.env.NEXT_PUBLIC_DEMO_RECIPIENT_WALLET || "9xQeWvG816bUx9EPa3gKB8Z3fLkWjGNxuz9bSWrH4MM";

export function paymentMemo(bountyId: string, submissionId: string) {
  return `project-vox:bounty=${bountyId}:submission=${submissionId}`;
}

export function explorerTxUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_EXPLORER_CLUSTER}`;
}
