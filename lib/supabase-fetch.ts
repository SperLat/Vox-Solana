type SupabaseFetch = typeof fetch;

export function createSupabaseFetch(apiKey: string): SupabaseFetch {
  const normalizedApiKey = normalizeSupabaseKey(apiKey);

  return async (input, init) => {
    const headers = new Headers(init?.headers);
    const authorization = headers.get("authorization");

    if (normalizedApiKey && !isCompactJws(normalizedApiKey) && authorization === `Bearer ${normalizedApiKey}`) {
      headers.delete("authorization");
    }

    return fetch(input, {
      ...init,
      headers
    });
  };
}

export function normalizeSupabaseKey(value: string | undefined) {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

function isCompactJws(value: string) {
  return value.split(".").length === 3;
}
