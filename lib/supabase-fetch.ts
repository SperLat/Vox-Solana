type SupabaseFetch = typeof fetch;

export function createSupabaseFetch(apiKey: string): SupabaseFetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    const authorization = headers.get("authorization");

    if (apiKey.startsWith("sb_") && authorization === `Bearer ${apiKey}`) {
      headers.delete("authorization");
    }

    return fetch(input, {
      ...init,
      headers
    });
  };
}
