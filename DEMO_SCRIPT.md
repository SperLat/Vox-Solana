# Project Vox 90-Second Demo Script

## 0-10 seconds: Problem

Independent authors need audiobook narration, but hiring voice talent is slow, opaque, and payment proof is usually detached from the creative work.

## 10-25 seconds: Product

Project Vox is a narration bounty marketplace. An author posts a paid audition award plus the expected full-book narration budget. Narrators submit real audio auditions with their wallet. The author selects a voice and pays the audition award directly on Solana devnet.

## 25-45 seconds: Live Flow

1. Open the bounty board.
2. Select "The Red Library".
3. Play an audition.
4. Show the selected narrator and wallet.
5. Connect Phantom or Solflare on devnet.
6. Click Pay award.

## 45-65 seconds: Solana Proof

The payment uses a direct SOL transfer and a memo:

```txt
project-vox:bounty=<id>:submission=<id>
```

The app calls a server verifier before marking the audition award paid. Verified receipts show as paid; unreachable RPC or mismatched transactions stay pending or failed. Pending receipts can be retried when RPC is available.

## 65-80 seconds: Blinks

Open the Blink link for an audition. The Action endpoint returns metadata and a signable transaction so fans can tip a narrator from Blink-enabled surfaces.

## 80-90 seconds: Close

This is a functional MVP: live bounties, audio upload or browser recording, persistent Supabase data, direct devnet payment, verification, explorer receipts, and shareable Solana Actions.
