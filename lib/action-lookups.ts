import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BOUNTIES_TABLE, SUBMISSIONS_TABLE } from "@/lib/constants";
import { seededState } from "@/lib/seed";
import { createSupabaseFetch, normalizeSupabaseKey } from "@/lib/supabase-fetch";
import { getServerSupabase } from "@/lib/supabase-server";
import type { Bounty, Submission } from "@/lib/types";

export type ActionSubmissionInfo = {
  bounty: Bounty;
  submission: Submission;
};

type LookupClient = {
  client: SupabaseClient;
  label: string;
};

export class ActionLookupError extends Error {
  status: number;

  constructor(message: string, status = 404) {
    super(message);
    this.name = "ActionLookupError";
    this.status = status;
  }
}

export async function getActionSubmissionInfo(submissionId: string): Promise<ActionSubmissionInfo> {
  for (const { client, label } of getLookupClients()) {
    try {
      const result = await lookupSubmissionInfo(client, submissionId);
      if (result) {
        return result;
      }
    } catch (error) {
      console.warn(`[action-lookup] ${label} lookup failed`, error);
    }
  }

  const seededResult = lookupSeededSubmissionInfo(submissionId);
  if (seededResult) {
    return seededResult;
  }

  throw new ActionLookupError(`Submission ${submissionId} was not found.`, 404);
}

function getLookupClients() {
  const clients: LookupClient[] = [];
  const serviceClient = getServerSupabase();
  const publicClient = getPublicSupabase();

  if (serviceClient) {
    clients.push({ client: serviceClient, label: "service-role" });
  }

  if (publicClient) {
    clients.push({ client: publicClient, label: "public-anon" });
  }

  return clients;
}

function getPublicSupabase() {
  const url = normalizeSupabaseKey(process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = normalizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false
    },
    global: {
      fetch: createSupabaseFetch(anonKey)
    }
  });
}

async function lookupSubmissionInfo(client: SupabaseClient, submissionId: string): Promise<ActionSubmissionInfo | null> {
  const { data: submission, error: submissionError } = await client
    .from(SUBMISSIONS_TABLE)
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) {
    throw submissionError;
  }

  if (!submission) {
    return null;
  }

  const { data: bounty, error: bountyError } = await client
    .from(BOUNTIES_TABLE)
    .select("*")
    .eq("id", submission.bounty_id)
    .maybeSingle();

  if (bountyError) {
    throw bountyError;
  }

  if (!bounty) {
    throw new ActionLookupError(`Bounty ${submission.bounty_id} was not found for submission ${submissionId}.`, 404);
  }

  return { submission: submission as Submission, bounty: bounty as Bounty };
}

function lookupSeededSubmissionInfo(submissionId: string): ActionSubmissionInfo | null {
  const submission = seededState.submissions.find((item) => item.id === submissionId);

  if (!submission) {
    return null;
  }

  const bounty = seededState.bounties.find((item) => item.id === submission.bounty_id) || seededState.bounties[0];

  return { bounty, submission };
}
