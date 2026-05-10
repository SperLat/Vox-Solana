import type { MarketplaceState } from "@/lib/types";
import { DEMO_AUTHOR_WALLET, DEMO_NARRATOR_WALLET } from "@/lib/constants";

const demoAudio = "/audio/demo-audition.wav";

export const seededState: MarketplaceState = {
  bounties: [
    {
      id: "bounty-mars",
      title: "The Red Library",
      excerpt:
        "At the rim of the old crater, Mara found a library sealed in glass. The books inside were not written for human hands, but every page hummed when she spoke.",
      genre: "Speculative fiction",
      reward_sol: 0.24,
      full_project_budget_sol: 2.4,
      author_wallet: DEMO_AUTHOR_WALLET,
      status: "open",
      cover_art: "/covers/red-library.svg",
      created_at: "2026-05-09T06:00:00.000Z"
    },
    {
      id: "bounty-river",
      title: "River Manual for Lost Cities",
      excerpt:
        "Rule one: never trust a city that refuses to appear on maps. Rule two: if the river knows your name, answer softly and keep walking.",
      genre: "Adventure",
      reward_sol: 0.18,
      full_project_budget_sol: 1.8,
      author_wallet: DEMO_AUTHOR_WALLET,
      status: "open",
      cover_art: "/covers/river-manual.svg",
      created_at: "2026-05-09T06:20:00.000Z"
    },
    {
      id: "bounty-orchid",
      title: "The Orchid Clock",
      excerpt:
        "Every morning the clock bloomed at seven, and every evening it folded away one hour of someone else's life. Ana was the first to notice the missing minutes.",
      genre: "Literary mystery",
      reward_sol: 0.32,
      full_project_budget_sol: 3.2,
      author_wallet: DEMO_AUTHOR_WALLET,
      status: "awarded",
      cover_art: "/covers/orchid-clock.svg",
      created_at: "2026-05-09T06:40:00.000Z"
    }
  ],
  submissions: [
    {
      id: "submission-luz",
      bounty_id: "bounty-mars",
      narrator_name: "Luz Vega",
      narrator_wallet: DEMO_NARRATOR_WALLET,
      audio_url: demoAudio,
      note: "Warm documentary tone with a slightly haunted cadence for the discovery scene.",
      selected: false,
      created_at: "2026-05-09T07:00:00.000Z"
    },
    {
      id: "submission-ari",
      bounty_id: "bounty-river",
      narrator_name: "Ari Sol",
      narrator_wallet: DEMO_NARRATOR_WALLET,
      audio_url: demoAudio,
      note: "Fast, intimate pacing for a serialized adventure opener.",
      selected: false,
      created_at: "2026-05-09T07:10:00.000Z"
    },
    {
      id: "submission-mika",
      bounty_id: "bounty-orchid",
      narrator_name: "Mika Rowan",
      narrator_wallet: DEMO_NARRATOR_WALLET,
      audio_url: demoAudio,
      note: "Quiet literary read with crisp consonants and restrained suspense.",
      selected: true,
      created_at: "2026-05-09T07:20:00.000Z"
    }
  ],
  payments: [
    {
      id: "payment-demo-pending",
      bounty_id: "bounty-orchid",
      submission_id: "submission-mika",
      payer_wallet: DEMO_AUTHOR_WALLET,
      recipient_wallet: DEMO_NARRATOR_WALLET,
      amount_sol: 0.32,
      tx_signature: "demo-pending-signature",
      memo: "project-vox:bounty=bounty-orchid:submission=submission-mika",
      status: "pending_verification",
      verified_at: null,
      verification_error: "Demo receipt awaiting devnet verification.",
      created_at: "2026-05-09T07:30:00.000Z"
    }
  ]
};
