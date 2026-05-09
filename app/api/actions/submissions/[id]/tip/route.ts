import { LAMPORTS_PER_SOL_NUMBER, MEMO_PROGRAM_ID, paymentMemo } from "@/lib/constants";
import { getActionSubmissionInfo } from "@/lib/action-lookups";
import { clusterApiUrl, Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { NextResponse } from "next/server";

const ACTIONS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding"
};

const FALLBACK_BLOCKHASH = "11111111111111111111111111111111";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function OPTIONS() {
  return new Response(null, {
    headers: ACTIONS_HEADERS
  });
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { bounty, submission } = await getActionSubmissionInfo(id);
  const origin = new URL(request.url).origin;

  return NextResponse.json(
    {
      type: "action",
      icon: `${origin}/action-icon.svg`,
      title: `Tip ${submission.narrator_name}`,
      description: `Send devnet SOL to support this narration audition for "${bounty.title}". Payments are direct wallet transfers, not escrow.`,
      label: `Tip ${Math.min(0.05, bounty.reward_sol).toFixed(2)} SOL`,
      links: {
        actions: [
          {
            label: "Tip 0.03 SOL",
            href: `${origin}/api/actions/submissions/${id}/tip?amount=0.03`
          },
          {
            label: "Tip 0.05 SOL",
            href: `${origin}/api/actions/submissions/${id}/tip?amount=0.05`
          },
          {
            label: "Pay bounty",
            href: `${origin}/api/actions/submissions/${id}/tip?amount=${bounty.reward_sol}`
          }
        ]
      }
    },
    { headers: ACTIONS_HEADERS }
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(request.url);
  const amountSol = Number(url.searchParams.get("amount") || "0.05");
  const body = (await request.json().catch(() => null)) as { account?: string } | null;

  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400, headers: ACTIONS_HEADERS });
  }

  if (!body?.account) {
    return NextResponse.json({ error: "Missing account" }, { status: 400, headers: ACTIONS_HEADERS });
  }

  let payer: PublicKey;
  try {
    payer = new PublicKey(body.account);
  } catch {
    return NextResponse.json({ error: "Invalid account" }, { status: 400, headers: ACTIONS_HEADERS });
  }
  const { bounty, submission } = await getActionSubmissionInfo(id);
  let recipient: PublicKey;
  try {
    recipient = new PublicKey(submission.narrator_wallet);
  } catch {
    return NextResponse.json({ error: "Invalid recipient wallet" }, { status: 400, headers: ACTIONS_HEADERS });
  }
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet"), "confirmed");
  const transaction = new Transaction();

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipient,
      lamports: Math.max(1, Math.round(amountSol * LAMPORTS_PER_SOL_NUMBER))
    })
  );

  transaction.add(
    new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(paymentMemo(bounty.id, submission.id), "utf8")
    })
  );

  let blockhash = FALLBACK_BLOCKHASH;
  let usedLiveBlockhash = true;
  try {
    const latestBlockhash = await connection.getLatestBlockhash("finalized");
    blockhash = latestBlockhash.blockhash;
  } catch {
    usedLiveBlockhash = false;
  }
  transaction.feePayer = payer;
  transaction.recentBlockhash = blockhash;

  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false
  });

  return NextResponse.json(
    {
      transaction: serialized.toString("base64"),
      message: usedLiveBlockhash
        ? `Tip ${submission.narrator_name} ${amountSol.toFixed(2)} devnet SOL for ${bounty.title}.`
        : `Preview transaction for ${submission.narrator_name}. The local server could not reach devnet RPC, so refresh this Action when RPC is available before broadcasting.`
    },
    { headers: ACTIONS_HEADERS }
  );
}
