"use client";

import { MEMO_PROGRAM_ID, LAMPORTS_PER_SOL_NUMBER } from "@/lib/constants";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction, type Connection } from "@solana/web3.js";
import { Buffer } from "buffer";

export async function buildPaymentTransaction(params: {
  connection: Connection;
  payer: PublicKey;
  recipient: string;
  amountSol: number;
  memo: string;
}) {
  const recipient = new PublicKey(params.recipient);
  const lamports = Math.max(1, Math.round(params.amountSol * LAMPORTS_PER_SOL_NUMBER));
  const transaction = new Transaction();

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: params.payer,
      toPubkey: recipient,
      lamports
    })
  );

  transaction.add(
    new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(params.memo, "utf8")
    })
  );

  const { blockhash, lastValidBlockHeight } = await params.connection.getLatestBlockhash("finalized");
  transaction.feePayer = params.payer;
  transaction.recentBlockhash = blockhash;

  return { transaction, lastValidBlockHeight };
}
