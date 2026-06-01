type QueryValue = string | number | boolean | null | undefined;

type SupabaseOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
  prefer?: string;
};

export class SupabaseRestError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new SupabaseRestError(500, "Missing Supabase environment variables", {
      required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    });
  }

  return { url: url.replace(/\/$/, ""), key };
}

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY));
}

export async function supabaseTable<T>(table: string, options: SupabaseOptions = {}) {
  const { url, key } = getConfig();
  const requestUrl = new URL(`${url}/rest/v1/${table}`);

  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null) {
      requestUrl.searchParams.set(name, String(value));
    }
  }

  const { request } = await import("node:https");

  return await new Promise<T>((resolve, reject) => {
    const req = request(
      requestUrl,
      {
        method: options.method ?? "GET",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: options.prefer ?? "return=representation",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const data = text ? JSON.parse(text) : null;

          if ((res.statusCode ?? 500) >= 400) {
            reject(new SupabaseRestError(res.statusCode ?? 500, "Supabase request failed", data));
            return;
          }

          resolve(data as T);
        });
      },
    );

    req.on("error", reject);

    if (options.body !== undefined) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

export function handleSupabaseError(error: unknown) {
  if (error instanceof SupabaseRestError) {
    return Response.json({ error: error.message, details: error.details }, { status: error.status });
  }

  return Response.json({ error: "Unexpected server error" }, { status: 500 });
}
