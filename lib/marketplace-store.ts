"use client";

import { BOUNTIES_TABLE, PAYMENTS_TABLE, STORAGE_BUCKET, SUBMISSIONS_TABLE } from "@/lib/constants";
import { seededState } from "@/lib/seed";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import type {
  Bounty,
  MarketplaceState,
  NewBountyInput,
  NewPaymentInput,
  NewSubmissionInput,
  Payment,
  Submission,
  VerificationResponse
} from "@/lib/types";

const STORAGE_KEY = "project-vox-marketplace-v1";

function cloneSeed(): MarketplaceState {
  return JSON.parse(JSON.stringify(seededState)) as MarketplaceState;
}

function readLocalState(): MarketplaceState {
  if (typeof window === "undefined") {
    return cloneSeed();
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const state = cloneSeed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  try {
    return normalizeState(JSON.parse(stored) as MarketplaceState);
  } catch {
    const state = cloneSeed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }
}

function normalizeState(state: MarketplaceState): MarketplaceState {
  return {
    ...state,
    bounties: state.bounties.map((bounty) => ({ ...bounty, reward_sol: Number(bounty.reward_sol) })),
    payments: state.payments.map((payment) => ({
      ...payment,
      amount_sol: Number(payment.amount_sol),
      status: payment.status || "verified",
      verified_at: payment.verified_at || null,
      verification_error: payment.verification_error || null
    }))
  };
}

function writeLocalState(updater: (state: MarketplaceState) => MarketplaceState) {
  const nextState = updater(readLocalState());
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export async function loadMarketplaceState(): Promise<MarketplaceState> {
  const supabase = getBrowserSupabase();

  if (!supabase) {
    return readLocalState();
  }

  const [bounties, submissions, payments] = await Promise.all([
    supabase.from(BOUNTIES_TABLE).select("*").order("created_at", { ascending: false }),
    supabase.from(SUBMISSIONS_TABLE).select("*").order("created_at", { ascending: false }),
    supabase.from(PAYMENTS_TABLE).select("*").order("created_at", { ascending: false })
  ]);

  if (bounties.error || submissions.error || payments.error) {
    console.warn("Supabase read failed, using demo state", bounties.error || submissions.error || payments.error);
    return readLocalState();
  }

  return normalizeState({
    bounties: (bounties.data || []) as Bounty[],
    submissions: (submissions.data || []) as Submission[],
    payments: (payments.data || []) as Payment[]
  });
}

export async function createBounty(input: NewBountyInput, coverFile?: File | null): Promise<Bounty> {
  const id = crypto.randomUUID();
  const coverArt = coverFile ? await uploadBountyCover(coverFile, id) : input.cover_art || "/covers/river-manual.svg";
  const bounty: Bounty = {
    id,
    ...input,
    status: "open",
    cover_art: coverArt,
    created_at: new Date().toISOString()
  };

  const supabase = getBrowserSupabase();
  if (!supabase) {
    writeLocalState((state) => ({ ...state, bounties: [bounty, ...state.bounties] }));
    return bounty;
  }

  const { data, error } = await supabase.from(BOUNTIES_TABLE).insert(bounty).select("*").single();
  if (error) {
    throw error;
  }

  return data as Bounty;
}

async function uploadBountyCover(file: File, bountyId: string) {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    return fileToDataUrl(file);
  }

  const extension = file.name.split(".").pop() || "png";
  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, "-").toLowerCase();
  const path = `covers/${bountyId}/${safeName || `cover.${extension}`}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "image/png",
    upsert: true
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadAudio(file: File, submissionId: string) {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    return fileToDataUrl(file);
  }

  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, "-").toLowerCase();
  const path = `${submissionId}/${safeName}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function createSubmission(input: NewSubmissionInput, file: File): Promise<Submission> {
  const id = crypto.randomUUID();
  const audioUrl = await uploadAudio(file, id);
  const submission: Submission = {
    id,
    ...input,
    audio_url: audioUrl,
    selected: false,
    created_at: new Date().toISOString()
  };

  const supabase = getBrowserSupabase();
  if (!supabase) {
    writeLocalState((state) => ({ ...state, submissions: [submission, ...state.submissions] }));
    return submission;
  }

  const { data, error } = await supabase.from(SUBMISSIONS_TABLE).insert(submission).select("*").single();
  if (error) {
    throw error;
  }

  return data as Submission;
}

export async function markSubmissionSelected(submissionId: string, bountyId: string): Promise<void> {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    writeLocalState((state) => ({
      ...state,
      bounties: state.bounties.map((bounty) => (bounty.id === bountyId ? { ...bounty, status: "awarded" } : bounty)),
      submissions: state.submissions.map((submission) => ({
        ...submission,
        selected: submission.bounty_id === bountyId && submission.id === submissionId
      }))
    }));
    return;
  }

  const [clearResult, selectResult, bountyResult] = await Promise.all([
    supabase.from(SUBMISSIONS_TABLE).update({ selected: false }).eq("bounty_id", bountyId),
    supabase.from(SUBMISSIONS_TABLE).update({ selected: true }).eq("id", submissionId),
    supabase.from(BOUNTIES_TABLE).update({ status: "awarded" }).eq("id", bountyId)
  ]);

  if (clearResult.error || selectResult.error || bountyResult.error) {
    throw clearResult.error || selectResult.error || bountyResult.error;
  }
}

export async function recordPayment(input: NewPaymentInput): Promise<Payment> {
  const payment: Payment = {
    id: crypto.randomUUID(),
    ...input,
    created_at: new Date().toISOString()
  };

  const supabase = getBrowserSupabase();
  if (!supabase) {
    writeLocalState((state) => ({
      ...state,
      payments: [payment, ...state.payments],
      bounties: state.bounties.map((bounty) =>
        bounty.id === input.bounty_id && input.status === "verified" ? { ...bounty, status: "paid" } : bounty
      )
    }));
    return payment;
  }

  return payment;
}

export async function updatePaymentVerification(
  paymentId: string,
  bountyId: string,
  verification: VerificationResponse
): Promise<void> {
  const update = {
    status: verification.status,
    payer_wallet: verification.payer_wallet,
    recipient_wallet: verification.recipient_wallet,
    amount_sol: verification.amount_sol,
    memo: verification.memo,
    verified_at: verification.verified_at,
    verification_error: verification.verification_error
  };

  const supabase = getBrowserSupabase();
  if (!supabase) {
    writeLocalState((state) => ({
      ...state,
      payments: state.payments.map((payment) => (payment.id === paymentId ? { ...payment, ...update } : payment)),
      bounties: state.bounties.map((bounty) =>
        bounty.id === bountyId && verification.status === "verified" ? { ...bounty, status: "paid" } : bounty
      )
    }));
    return;
  }

  void update;
  void bountyId;
}

export function resetLocalDemoState() {
  const state = cloneSeed();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export async function verifyPayment(input: {
  tx_signature: string;
  bounty_id: string;
  submission_id: string;
}): Promise<VerificationResponse> {
  const response = await fetch("/api/payments/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = (await response.json().catch(() => null)) as VerificationResponse | { error?: string } | null;

  if (!response.ok || !payload) {
    throw new Error("Payment verification failed.");
  }

  if (isVerificationError(payload)) {
    throw new Error(payload.error || "Payment verification failed.");
  }

  return payload;
}

function isVerificationError(payload: VerificationResponse | { error?: string }): payload is { error?: string } {
  return "error" in payload;
}
