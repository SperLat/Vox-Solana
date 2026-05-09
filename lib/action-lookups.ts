import { BOUNTIES_TABLE, DEMO_NARRATOR_WALLET, SUBMISSIONS_TABLE } from "@/lib/constants";
import { seededState } from "@/lib/seed";
import { getServerSupabase } from "@/lib/supabase-server";
import type { Bounty, Submission } from "@/lib/types";

export type ActionSubmissionInfo = {
  bounty: Bounty;
  submission: Submission;
};

export async function getActionSubmissionInfo(submissionId: string): Promise<ActionSubmissionInfo> {
  const supabase = getServerSupabase();

  if (supabase) {
    const { data: submission } = await supabase.from(SUBMISSIONS_TABLE).select("*").eq("id", submissionId).single();
    if (submission) {
      const { data: bounty } = await supabase.from(BOUNTIES_TABLE).select("*").eq("id", submission.bounty_id).single();
      if (bounty) {
        return { submission: submission as Submission, bounty: bounty as Bounty };
      }
    }
  }

  const submission = seededState.submissions.find((item) => item.id === submissionId) || {
    ...seededState.submissions[0],
    id: submissionId,
    narrator_wallet: process.env.NEXT_PUBLIC_DEMO_RECIPIENT_WALLET || DEMO_NARRATOR_WALLET
  };
  const bounty = seededState.bounties.find((item) => item.id === submission.bounty_id) || seededState.bounties[0];

  return { bounty, submission };
}
