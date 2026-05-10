# Project Vox Submission

## Problem

Audiobook narration is hard for independent authors to source and pay for. Voice actors also need lightweight ways to prove work, receive direct payouts, and share auditions beyond a closed marketplace.

## Solution

Project Vox lets authors post paid narration auditions with a visible full-book budget, narrators upload or record auditions, and authors or fans pay narrators directly with Solana devnet SOL.

## Open Source

Project Vox is licensed under `AGPL-3.0-only` with the full license text included in `LICENSE`.

## What Works

- Browse seeded or live Supabase bounties.
- Connect a wallet and save an author/narrator profile.
- Create a new bounty with an audition award and full narration budget.
- Upload or record an audio audition.
- Use My workspace to see wallet-specific bounties, auditions, and receipts.
- Select a narrator for a bounty.
- Pay a narrator from Phantom or Solflare on devnet.
- Verify payment server-side before marking a bounty paid.
- Retry pending payment verification if RPC was temporarily unavailable.
- View explorer receipts.
- Open a Solana Action/Blink endpoint for narrator tipping.

## Solana Usage

- Direct SOL transfers through `@solana/web3.js`.
- Memo program links each audition-award payment to one bounty and one submission.
- Server verifier checks recipient, amount, and memo from the devnet transaction, then stores the receipt through the Supabase service key.
- Solana Actions endpoint returns metadata and a base64 transaction for tipping.
- No custom program or escrow in this MVP.
- Wallet ownership gates product actions: only the author wallet can grade, select, verify, or pay that bounty's award.

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
- The full narration budget is shown for marketplace intent; milestone contracts for the full book are not automated yet.
- Public demo Supabase policies are permissive and should be tightened before production.
- Server verification depends on devnet RPC availability.
- Local fallback state is for rehearsal only; full product persistence requires Supabase.
- Browser recording support depends on the user's browser and microphone permissions.
