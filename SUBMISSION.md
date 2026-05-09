# Project Vox Submission

## Problem

Audiobook narration is hard for independent authors to source and pay for. Voice actors also need lightweight ways to prove work, receive direct payouts, and share auditions beyond a closed marketplace.

## Solution

Project Vox lets authors post narration bounties, narrators upload or record auditions, and authors or fans pay narrators directly with Solana devnet SOL.

## Open Source

Project Vox is licensed under `AGPL-3.0-only` with the full license text included in `LICENSE`.

## What Works

- Browse seeded or live Supabase bounties.
- Create a new bounty.
- Upload or record an audio audition.
- Select a narrator for a bounty.
- Pay a narrator from Phantom or Solflare on devnet.
- Verify payment server-side before marking a bounty paid.
- Retry pending payment verification if RPC was temporarily unavailable.
- View explorer receipts.
- Open a Solana Action/Blink endpoint for narrator tipping.

## Solana Usage

- Direct SOL transfers through `@solana/web3.js`.
- Memo program links each payment to one bounty and one submission.
- Server verifier checks recipient, amount, and memo from the devnet transaction, then stores the receipt through the Supabase service key.
- Solana Actions endpoint returns metadata and a base64 transaction for tipping.
- No custom program or escrow in this MVP.

## Demo Checklist

- Deployed app URL:
- Devnet wallet funded:
- Supabase env vars configured:
- `auditions` storage bucket created:
- `supabase/schema.sql` applied:
- `/api/actions/submissions/submission-luz/tip` returns Action metadata:
- `/api/payments/verify` tested with a fake signature and a real devnet signature:

## Known Limitations

- Payments are direct transfers, not escrow.
- Public demo Supabase policies are permissive and should be tightened before production.
- Server verification depends on devnet RPC availability.
- Local fallback state is for rehearsal only; full product persistence requires Supabase.
- Browser recording support depends on the user's browser and microphone permissions.
