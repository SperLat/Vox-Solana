import { LAMPORTS_PER_SOL_NUMBER, MEMO_PROGRAM_ID, paymentMemo } from "@/lib/constants";
import { ActionLookupError, getActionSubmissionInfo, type ActionSubmissionInfo } from "@/lib/action-lookups";
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

function getPublicOrigin(request: Request) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, "");
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || "https";

  if (host && !host.startsWith("0.0.0.0")) {
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  let info: ActionSubmissionInfo;
  try {
    info = await getActionSubmissionInfo(id);
  } catch (error) {
    return actionLookupErrorResponse(error);
  }
  const { bounty, submission } = info;
  const origin = getPublicOrigin(request);
  const icon = absoluteUrl(bounty.cover_art || "/action-icon.svg", origin);

  return NextResponse.json(
    {
      type: "action",
      icon,
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
            label: `Tip ${bounty.reward_sol.toFixed(2)} SOL`,
            href: `${origin}/api/actions/submissions/${id}/tip?amount=${bounty.reward_sol}`
          }
        ]
      }
    },
    { headers: ACTIONS_HEADERS }
  );
}

function absoluteUrl(value: string, origin: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
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
  let info: ActionSubmissionInfo;
  try {
    info = await getActionSubmissionInfo(id);
  } catch (error) {
    return actionLookupErrorResponse(error);
  }
  const { bounty, submission } = info;
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
        ? `Send ${submission.narrator_name} ${amountSol.toFixed(2)} devnet SOL for ${bounty.title}.`
        : `Preview transaction for ${submission.narrator_name}. The local server could not reach devnet RPC, so refresh this Action when RPC is available before broadcasting.`
    },
    { headers: ACTIONS_HEADERS }
  );
}

function actionLookupErrorResponse(error: unknown) {
  if (error instanceof ActionLookupError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: ACTIONS_HEADERS });
  }

  throw error;
}
