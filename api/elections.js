// Vercel serverless function — proxies the Anthropic API so the key stays server-side
// and the browser avoids CORS. The client hits /api/elections from the same origin.

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY no está configurado en el servidor",
    });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `Search for the very latest ONPE Peru 2026 election results right now.
Return ONLY valid JSON — no prose, no markdown fences — with this exact shape:
{
  "pct": <number>,
  "actas_total": <integer>,
  "actas_counted": <integer>,
  "ts": <unix ms>,
  "candidates": [
    { "name": "<Nombre Apellido>", "party": "<partido>", "votes": <integer>, "pct": <float> }
  ]
}
Include the top 9 candidates ordered by vote percentage. Use real numbers only.`,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res
        .status(upstream.status)
        .json({ error: `Anthropic API ${upstream.status}`, detail: errText });
    }

    const data = await upstream.json();
    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      return res.status(502).json({
        error: "Respuesta del modelo no es JSON válido",
        raw: clean.slice(0, 500),
      });
    }

    parsed.ts = parsed.ts || Date.now();

    // Cache briefly at the edge — fresh enough for a 2-min poll, cheap on API usage
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message ?? "Unknown error" });
  }
}
