import { BOUNTIES_TABLE, LAMPORTS_PER_SOL_NUMBER, MEMO_PROGRAM_ID, PAYMENTS_TABLE, paymentMemo } from "@/lib/constants";
import { getActionSubmissionInfo } from "@/lib/action-lookups";
import { getServerSupabase } from "@/lib/supabase-server";
import type { PaymentStatus, VerificationResponse } from "@/lib/types";
import {
  clusterApiUrl,
  Connection,
  SystemProgram,
  type ParsedInstruction,
  type PartiallyDecodedInstruction
} from "@solana/web3.js";
import { NextResponse } from "next/server";

type VerifyRequest = {
  tx_signature?: string;
  bounty_id?: string;
  submission_id?: string;
};

const VERIFY_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function OPTIONS() {
  return new Response(null, {
    headers: VERIFY_HEADERS
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VerifyRequest | null;

  if (!body?.tx_signature || !body.bounty_id || !body.submission_id) {
    return NextResponse.json({ error: "Missing tx_signature, bounty_id, or submission_id." }, { status: 400, headers: VERIFY_HEADERS });
  }

  const { bounty, submission } = await getActionSubmissionInfo(body.submission_id);

  if (bounty.id !== body.bounty_id || submission.bounty_id !== body.bounty_id) {
    return NextResponse.json(
      { error: "Submission does not belong to the requested bounty." },
      { status: 400, headers: VERIFY_HEADERS }
    );
  }

  const expectedMemo = paymentMemo(body.bounty_id, body.submission_id);
  const expectedRecipient = submission.narrator_wallet;
  const expectedLamports = Math.max(1, Math.round(Number(bounty.reward_sol) * LAMPORTS_PER_SOL_NUMBER));
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet"), "confirmed");

  if (!isLikelySolanaSignature(body.tx_signature)) {
    return persistAndRespond({
      txSignature: body.tx_signature,
      bountyId: body.bounty_id,
      submissionId: body.submission_id,
      status: "verification_failed",
      payerWallet: "",
      recipientWallet: expectedRecipient,
      amountSol: Number(bounty.reward_sol),
      memo: expectedMemo,
      error: "Invalid Solana transaction signature format."
    });
  }

  try {
    const transaction = await connection.getParsedTransaction(body.tx_signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    });

    if (!transaction) {
      return persistAndRespond({
        txSignature: body.tx_signature,
        bountyId: body.bounty_id,
        submissionId: body.submission_id,
        status: "pending_verification",
        payerWallet: "",
        recipientWallet: expectedRecipient,
        amountSol: Number(bounty.reward_sol),
        memo: expectedMemo,
        error: "Transaction is not available on devnet yet."
      });
    }

    const instructions = transaction.transaction.message.instructions;
    const transferInstruction = instructions.find((instruction) => {
      if (!isParsedInstruction(instruction) || instruction.programId.toBase58() !== SystemProgram.programId.toBase58()) {
        return false;
      }

      return instruction.parsed?.type === "transfer";
    });

    const memoInstruction = instructions.find((instruction) => instruction.programId.toBase58() === MEMO_PROGRAM_ID.toBase58());
    const transferInfo = isParsedInstruction(transferInstruction)
      ? (transferInstruction.parsed?.info as { source?: string; destination?: string; lamports?: number } | undefined)
      : undefined;
    const memo = isParsedInstruction(memoInstruction) ? String(memoInstruction.parsed || "") : "";

    const payerWallet = transferInfo?.source || "";
    const recipientWallet = transferInfo?.destination || expectedRecipient;
    const amountSol = Number(((transferInfo?.lamports || 0) / LAMPORTS_PER_SOL_NUMBER).toFixed(9));
    const failures = [
      transferInfo?.destination === expectedRecipient ? "" : "recipient mismatch",
      transferInfo?.lamports === expectedLamports ? "" : "amount mismatch",
      memo === expectedMemo ? "" : "memo mismatch"
    ].filter(Boolean);

    if (failures.length > 0) {
      return persistAndRespond({
        txSignature: body.tx_signature,
        bountyId: body.bounty_id,
        submissionId: body.submission_id,
        status: "verification_failed",
        payerWallet,
        recipientWallet,
        amountSol,
        memo,
        error: failures.join(", ")
      });
    }

    return persistAndRespond({
      txSignature: body.tx_signature,
      bountyId: body.bounty_id,
      submissionId: body.submission_id,
      status: "verified",
      payerWallet,
      recipientWallet,
      amountSol,
      memo,
      verifiedAt: new Date().toISOString(),
      error: null
    });
  } catch {
    return persistAndRespond({
      txSignature: body.tx_signature,
      bountyId: body.bounty_id,
      submissionId: body.submission_id,
      status: "pending_verification",
      payerWallet: "",
      recipientWallet: expectedRecipient,
      amountSol: Number(bounty.reward_sol),
      memo: expectedMemo,
      error: "Devnet RPC was unreachable. Keep this receipt pending and retry verification from the deployed app."
    });
  }
}

function isParsedInstruction(instruction: ParsedInstruction | PartiallyDecodedInstruction | undefined): instruction is ParsedInstruction {
  return Boolean(instruction && "parsed" in instruction);
}

function isLikelySolanaSignature(signature: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(signature);
}

async function persistAndRespond(input: {
  txSignature: string;
  bountyId: string;
  submissionId: string;
  status: PaymentStatus;
  payerWallet: string;
  recipientWallet: string;
  amountSol: number;
  memo: string;
  verifiedAt?: string | null;
  error: string | null;
}) {
  let paymentId: string | null = null;
  let persisted = false;
  const supabase = getServerSupabase();
  const paymentRecord = {
    id: crypto.randomUUID(),
    bounty_id: input.bountyId,
    submission_id: input.submissionId,
    payer_wallet: input.payerWallet,
    recipient_wallet: input.recipientWallet,
    amount_sol: input.amountSol,
    tx_signature: input.txSignature,
    memo: input.memo,
    status: input.status,
    verified_at: input.verifiedAt || null,
    verification_error: input.error
  };

  if (supabase) {
    const { data, error } = await supabase
      .from(PAYMENTS_TABLE)
      .upsert(paymentRecord, { onConflict: "tx_signature" })
      .select("id")
      .single();

    if (!error) {
      paymentId = data?.id || null;
      persisted = true;

      if (input.status === "verified") {
        await supabase.from(BOUNTIES_TABLE).update({ status: "paid" }).eq("id", input.bountyId);
      }
    }
  }

  const payload: VerificationResponse = {
    status: input.status,
    payer_wallet: input.payerWallet,
    recipient_wallet: input.recipientWallet,
    amount_sol: input.amountSol,
    memo: input.memo,
    verified_at: input.verifiedAt || null,
    verification_error: input.error,
    payment_id: paymentId,
    persisted
  };

  return NextResponse.json(payload, { headers: VERIFY_HEADERS });
}
