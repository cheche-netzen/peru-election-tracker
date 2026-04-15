// Vercel serverless function — fetches live presidential results directly from
// ONPE's internal backend (`/presentacion-backend/*`), the same API the official
// Angular SPA at resultadoelectoral.onpe.gob.pe talks to.
//
// The endpoints are publicly reachable from a server (no API key, no auth) but
// CloudFront sometimes caches the SPA's index.html for the same path, so we:
//   1. always cache-bust with a random query string,
//   2. validate that the response is actually JSON,
//   3. retry a couple of times with GET and POST variants,
//   4. surface a 502 with a clear reason if ONPE returns the HTML shell.
//
// Reverse-engineered from the live JS bundle at
// https://resultadoelectoral.onpe.gob.pe/main-*.js (2026-04-14):
//   - `ID_ELECCION_PRESIDENCIAL` = 10
//   - `idAmbitoGeografico` = 1  (nationwide / "PERÚ")
//   - Totals endpoint:        GET/POST /presentacion-backend/resumen-general/totales
//     Body/query: { idEleccion, tipoFiltro: "eleccion" }
//   - Candidates (bars chart) endpoint: /presentacion-backend/resumen-general/participantes
//     Body/query: { idEleccion, tipoFiltro: "eleccion", idAmbitoGeografico: 1 }

const BASE = "https://resultadoelectoral.onpe.gob.pe/presentacion-backend";
const ID_ELECCION_PRESIDENCIAL = 10;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  Origin: "https://resultadoelectoral.onpe.gob.pe",
  Referer: "https://resultadoelectoral.onpe.gob.pe/",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Dest": "empty",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

// Attempt a request and return parsed JSON, or null if ONPE returned the HTML
// shell (CloudFront cache fallthrough) or the body isn't valid JSON.
async function tryJson(url, init) {
  const res = await fetch(url, init);
  const contentType = res.headers.get("content-type") || "";
  // ONPE/CloudFront sometimes returns HTTP 200 with text/html (the SPA shell)
  // instead of the API response. Reject anything that isn't JSON.
  if (!contentType.includes("application/json")) return null;
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Fetch one ONPE endpoint with GET+query and POST+body fallback. Returns the
// `data` field of the ONPE envelope `{ success, message, data }`, or null.
async function fetchOnpeEndpoint(path, params) {
  const qs = new URLSearchParams({
    ...params,
    // Cache-buster — forces CloudFront to consult origin rather than serving a
    // stale SPA-shell cached response under the same path.
    _: Date.now().toString() + Math.random().toString(36).slice(2, 8),
  }).toString();

  // 1) GET with query string (what worked in manual testing).
  const getResult = await tryJson(`${BASE}/${path}?${qs}`, {
    method: "GET",
    headers: BROWSER_HEADERS,
  });
  if (getResult?.success && getResult.data) return getResult.data;

  // 2) POST with JSON body (what the Angular client sends).
  const postResult = await tryJson(`${BASE}/${path}`, {
    method: "POST",
    headers: { ...BROWSER_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (postResult?.success && postResult.data) return postResult.data;

  return null;
}

// Map ONPE's response shape to the shape the React app already consumes.
function shapeResponse(totales, participantes) {
  const candidates = (Array.isArray(participantes) ? participantes : [])
    .map((p) => ({
      name: (p.nombreCandidato ?? "").trim(),
      party: (p.nombreAgrupacionPolitica ?? "").trim(),
      votes: Number(p.totalVotosValidos ?? 0),
      pct: Number(p.porcentajeVotosValidos ?? 0),
    }))
    .filter((c) => c.name)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 9);

  return {
    pct: Number(totales.actasContabilizadas ?? 0),
    actas_total: Number(totales.totalActas ?? 0),
    actas_counted: Number(totales.contabilizadas ?? 0),
    ts: Number(totales.fechaActualizacion) || Date.now(),
    candidates,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Both endpoints accept the same election-level filter.
    const totalesParams = {
      idEleccion: ID_ELECCION_PRESIDENCIAL,
      tipoFiltro: "eleccion",
    };
    const participantesParams = {
      idEleccion: ID_ELECCION_PRESIDENCIAL,
      tipoFiltro: "eleccion",
      idAmbitoGeografico: 1,
    };

    const [totales, participantes] = await Promise.all([
      fetchOnpeEndpoint("resumen-general/totales", totalesParams),
      fetchOnpeEndpoint("resumen-general/participantes", participantesParams),
    ]);

    if (!totales || !participantes) {
      return res.status(502).json({
        error:
          "ONPE respondió con la shell SPA en lugar de JSON (caché CloudFront). Intenta de nuevo.",
        source: "onpe",
        gotTotales: !!totales,
        gotParticipantes: !!participantes,
      });
    }

    const shaped = shapeResponse(totales, participantes);
    if (shaped.candidates.length === 0) {
      return res.status(502).json({
        error: "ONPE devolvió totales pero la lista de candidatos está vacía",
        source: "onpe",
      });
    }

    // Don't let CloudFront/Vercel cache this — the whole point is freshness.
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({ ...shaped, source: "onpe" });
  } catch (e) {
    return res.status(500).json({ error: e?.message ?? "Unknown error" });
  }
}
