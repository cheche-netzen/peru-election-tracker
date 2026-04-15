import { useState, useEffect, useRef, useCallback } from "react";

// ─── Color palette ────────────────────────────────────────────────
const PALETTE = [
  "#E63946", "#457B9D", "#2A9D8F", "#E9C46A",
  "#F4A261", "#A8DADC", "#6D6875", "#B5838D",
  "#11B5E4", "#8338EC",
];

const CANDIDATE_COLORS = {};
const getColor = (name) => {
  if (!CANDIDATE_COLORS[name]) {
    const idx = Object.keys(CANDIDATE_COLORS).length % PALETTE.length;
    CANDIDATE_COLORS[name] = PALETTE[idx];
  }
  return CANDIDATE_COLORS[name];
};

// ─── Seed snapshots (real ONPE data, April 14 2026) ──────────────
const SEED_SNAPSHOTS = [
  {
    ts: Date.now() - 7200000,
    pct: 65.27,
    actas_total: 92766,
    actas_counted: 60548,
    candidates: [
      { name: "Keiko Fujimori",    party: "Fuerza Popular",           votes: 2050000, pct: 16.91 },
      { name: "Rafael López Aliaga", party: "Renovación Popular",     votes: 1550000, pct: 12.78 },
      { name: "Jorge Nieto",        party: "Partido del Buen Gobierno", votes: 1420000, pct: 11.71 },
      { name: "Roberto Sánchez",    party: "Juntos por el Perú",      votes: 1280000, pct: 10.55 },
      { name: "Ricardo Belmont",    party: "Partido Cívico Obras",    votes: 1200000, pct: 9.89  },
      { name: "Carlos Álvarez",     party: "País Para Todos",         votes: 950000,  pct: 7.83  },
      { name: "Pablo López Chau",   party: "Ahora Nación",            votes: 890000,  pct: 7.34  },
      { name: "María Pérez Tello",  party: "Primero la Gente",        votes: 440000,  pct: 3.63  },
      { name: "Alfonso Espá",       party: "Partido Sicreo",          votes: 432000,  pct: 3.56  },
    ],
  },
  {
    ts: Date.now() - 3600000,
    pct: 74.96,
    actas_total: 92766,
    actas_counted: 69533,
    candidates: [
      { name: "Keiko Fujimori",    party: "Fuerza Popular",           votes: 2150000, pct: 16.89 },
      { name: "Rafael López Aliaga", party: "Renovación Popular",     votes: 1640000, pct: 12.88 },
      { name: "Jorge Nieto",        party: "Partido del Buen Gobierno", votes: 1500000, pct: 11.78 },
      { name: "Roberto Sánchez",    party: "Juntos por el Perú",      votes: 1370000, pct: 10.75 },
      { name: "Ricardo Belmont",    party: "Partido Cívico Obras",    votes: 1280000, pct: 10.05 },
      { name: "Carlos Álvarez",     party: "País Para Todos",         votes: 1010000, pct: 7.93  },
      { name: "Pablo López Chau",   party: "Ahora Nación",            votes: 945000,  pct: 7.42  },
      { name: "María Pérez Tello",  party: "Primero la Gente",        votes: 462000,  pct: 3.63  },
      { name: "Alfonso Espá",       party: "Partido Sicreo",          votes: 452000,  pct: 3.55  },
    ],
  },
  {
    ts: Date.now() - 1800000,
    pct: 79.976,
    actas_total: 90223,
    actas_counted: 72157,
    candidates: [
      { name: "Keiko Fujimori",    party: "Fuerza Popular",           votes: 2294230, pct: 16.888 },
      { name: "Rafael López Aliaga", party: "Renovación Popular",     votes: 1704502, pct: 12.547 },
      { name: "Jorge Nieto",        party: "Partido del Buen Gobierno", votes: 1590919, pct: 11.711 },
      { name: "Roberto Sánchez",    party: "Juntos por el Perú",      votes: 1436898, pct: 10.577 },
      { name: "Ricardo Belmont",    party: "Partido Cívico Obras",    votes: 1364041, pct: 10.041 },
      { name: "Carlos Álvarez",     party: "País Para Todos",         votes: 1095278, pct: 8.063  },
      { name: "Pablo López Chau",   party: "Ahora Nación",            votes: 1025922, pct: 7.552  },
      { name: "María Pérez Tello",  party: "Primero la Gente",        votes: 490693,  pct: 3.612  },
      { name: "Alfonso Espá",       party: "Partido Sicreo",          votes: 481417,  pct: 3.544  },
    ],
  },
  {
    ts: Date.now() - 900000,
    pct: 82.24,
    actas_total: 90223,
    actas_counted: 74175,
    candidates: [
      { name: "Keiko Fujimori",    party: "Fuerza Popular",           votes: 2396594, pct: 16.879 },
      { name: "Rafael López Aliaga", party: "Renovación Popular",     votes: 1756688, pct: 12.372 },
      { name: "Jorge Nieto",        party: "Partido del Buen Gobierno", votes: 1635815, pct: 11.521 },
      { name: "Roberto Sánchez",    party: "Juntos por el Perú",      votes: 1567495, pct: 11.040 },
      { name: "Ricardo Belmont",    party: "Partido Cívico Obras",    votes: 1431972, pct: 10.085 },
      { name: "Carlos Álvarez",     party: "País Para Todos",         votes: 1132921, pct: 7.979  },
      { name: "Pablo López Chau",   party: "Ahora Nación",            votes: 1066241, pct: 7.510  },
      { name: "María Pérez Tello",  party: "Primero la Gente",        votes: 501000,  pct: 3.59   },
      { name: "Alfonso Espá",       party: "Partido Sicreo",          votes: 491000,  pct: 3.52   },
    ],
  },
];

// ─── Anomaly detection (z-score per batch) ───────────────────────
function detectAnomalies(snapshots) {
  const anomalies = [];
  if (snapshots.length < 2) return anomalies;
  const prev = snapshots[snapshots.length - 2];
  const curr = snapshots[snapshots.length - 1];

  const movements = curr.candidates.map((c) => {
    const p = prev.candidates.find((x) => x.name === c.name);
    return p ? { name: c.name, delta: c.pct - p.pct } : null;
  }).filter(Boolean);

  const avg = movements.reduce((s, m) => s + m.delta, 0) / movements.length;
  const std = Math.sqrt(movements.reduce((s, m) => s + (m.delta - avg) ** 2, 0) / movements.length);

  movements.forEach((m) => {
    const z = std > 0 ? (m.delta - avg) / std : 0;
    if (Math.abs(z) > 1.8) {
      anomalies.push({
        type: m.delta > avg ? "SURGE" : "DROP",
        candidate: m.name,
        delta: m.delta,
        z,
        at: curr.pct,
        fromPct: prev.pct,
        msg: `${m.name}: ${m.delta > 0 ? "+" : ""}${m.delta.toFixed(3)}% (z=${z.toFixed(2)}) en el lote ${prev.pct.toFixed(2)}%→${curr.pct.toFixed(2)}%`,
      });
    }
  });
  return anomalies;
}

// ─── Live data fetch (via same-origin serverless proxy) ──────────
// First try /api/onpe (direct scrape of ONPE's internal backend). That's the
// source of truth and gives deterministic numbers, but it's gated by a flaky
// CloudFront cache, so we fall back to /api/elections (Claude web-search proxy)
// whenever the ONPE call can't confirm it got real JSON.
async function tryEndpoint(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error) detail = err.error;
    } catch {}
    throw new Error(detail);
  }
  const parsed = await res.json();
  parsed.ts = parsed.ts || Date.now();
  return parsed;
}

async function fetchLiveData() {
  try {
    return await tryEndpoint("/api/onpe");
  } catch (onpeErr) {
    try {
      const data = await tryEndpoint("/api/elections");
      return { ...data, source: data.source ?? "claude" };
    } catch (llmErr) {
      throw new Error(`ONPE: ${onpeErr.message} · Claude: ${llmErr.message}`);
    }
  }
}

// ─── Sub-components ───────────────────────────────────────────────
function MiniBar({ pct, color, max }) {
  return (
    <div style={{ background: "#1a1a2e", borderRadius: 4, height: 8, overflow: "hidden", flex: 1, minWidth: 60 }}>
      <div style={{
        width: `${Math.min((pct / max) * 100, 100)}%`,
        background: color, height: "100%", borderRadius: 4,
        transition: "width 0.8s ease",
      }} />
    </div>
  );
}

function Sparkline({ data, color }) {
  if (data.length < 2) return <span style={{ color: "#444", fontSize: 11 }}>—</span>;
  const W = 80, H = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 0.01;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`
  ).join(" ");
  return (
    <svg width={W} height={H}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#12132a", borderRadius: 10,
      padding: "16px 18px", borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 10, color: "#666", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
  const [snapshots, setSnapshots] = useState(SEED_SNAPSHOTS);
  const [allAnomalies, setAllAnomalies] = useState([]);
  const [latestAnomalies, setLatestAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [lastSource, setLastSource] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const timerRef = useRef(null);

  const latest = snapshots[snapshots.length - 1];
  const maxPct = Math.max(...(latest?.candidates ?? []).map((c) => c.pct));
  const actas_remaining = latest ? latest.actas_total - latest.actas_counted : 0;
  const pct_remaining = latest ? (100 - latest.pct) : 0;

  const fmt = (n) => n?.toLocaleString("es-PE") ?? "—";
  const fmtTime = (d) => d?.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "—";

  const getTrend = (name) => {
    if (snapshots.length < 2) return null;
    const p = snapshots[snapshots.length - 2]?.candidates.find((c) => c.name === name);
    const c = latest?.candidates.find((x) => x.name === name);
    return p && c ? c.pct - p.pct : null;
  };

  const getHistory = (name) =>
    snapshots.map((s) => s.candidates.find((c) => c.name === name)?.pct).filter((v) => v != null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await fetchLiveData();
      setSnapshots((prev) => {
        const updated = [...prev, snap].slice(-20);
        const detected = detectAnomalies(updated);
        setLatestAnomalies(detected);
        setAllAnomalies((all) => [...detected, ...all].slice(0, 100));
        return updated;
      });
      setLastFetch(new Date());
      setLastSource(snap.source ?? "onpe");
    } catch (e) {
      setError("No se pudo obtener datos en vivo. " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setAllAnomalies(detectAnomalies(SEED_SNAPSHOTS));
    setLatestAnomalies(detectAnomalies(SEED_SNAPSHOTS));
  }, []);

  useEffect(() => {
    if (autoRefresh) timerRef.current = setInterval(refresh, 120000);
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [autoRefresh, refresh]);

  const sorted = [...(latest?.candidates ?? [])].sort((a, b) => b.pct - a.pct);

  return (
    <div style={{ fontFamily: "'Courier New', Courier, monospace", background: "#0b0c1a", color: "#e0e0f0", minHeight: "100vh", paddingBottom: 60 }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{
        background: "linear-gradient(135deg,#12132a,#1c1e3e)",
        borderBottom: "2px solid #E63946",
        padding: "18px 28px",
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", flexWrap: "wrap", gap: 14,
        alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 10, color: "#E63946", letterSpacing: 3, fontWeight: 700 }}>
            🇵🇪 ONPE OFICIAL — ELECCIONES GENERALES 2026
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, marginTop: 3 }}>
            MONITOR DE ESCRUTINIO
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: "#888", textAlign: "right" }}>
            Última actualización<br />
            <span style={{ color: "#e0e0f0" }}>{lastFetch ? fmtTime(lastFetch) : "Datos iniciales cargados"}</span>
            {lastSource && (
              <span style={{
                marginLeft: 8,
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 9,
                letterSpacing: 1,
                background: lastSource === "onpe" ? "#0f2e28" : "#2e0f28",
                color: lastSource === "onpe" ? "#2A9D8F" : "#E63946",
                border: `1px solid ${lastSource === "onpe" ? "#2A9D8F" : "#E63946"}`,
              }}>
                {lastSource === "onpe" ? "ONPE" : "IA"}
              </span>
            )}
          </div>
          <button onClick={refresh} disabled={loading} style={{
            background: loading ? "#222" : "#E63946", color: "#fff",
            border: "none", borderRadius: 6, padding: "8px 18px",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit", fontWeight: 700, fontSize: 12,
            transition: "background 0.2s",
          }}>
            {loading ? "⟳ ACTUALIZANDO…" : "⟳ ACTUALIZAR"}
          </button>
          <button onClick={() => setAutoRefresh((a) => !a)} style={{
            background: autoRefresh ? "#2A9D8F" : "#1c1e3e",
            color: autoRefresh ? "#fff" : "#888",
            border: `1px solid ${autoRefresh ? "#2A9D8F" : "#333"}`,
            borderRadius: 6, padding: "8px 14px",
            cursor: "pointer", fontFamily: "inherit", fontSize: 12,
            transition: "all 0.2s",
          }}>
            {autoRefresh ? "⏵ AUTO ON" : "⏵ AUTO OFF"}
          </button>
        </div>
      </header>

      <main style={{ padding: "22px 28px", maxWidth: 1100, margin: "0 auto" }}>

        {error && (
          <div style={{
            background: "#1e0808", border: "1px solid #E63946", borderRadius: 8,
            padding: "10px 16px", marginBottom: 18, fontSize: 12, color: "#f08080",
          }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Stat cards ─────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 22 }}>
          <StatCard label="Actas contabilizadas" value={`${latest?.pct?.toFixed(3) ?? "—"}%`} sub={`${fmt(latest?.actas_counted)} actas`} color="#2A9D8F" />
          <StatCard label="Actas pendientes"     value={`${pct_remaining.toFixed(3)}%`}         sub={`${fmt(actas_remaining)} actas`}         color="#E9C46A" />
          <StatCard label="Total actas"          value={fmt(latest?.actas_total)}               sub="universo electoral"                      color="#457B9D" />
          <StatCard label="Snapshots grabados"   value={snapshots.length}                        sub="historial disponible"                    color="#6D6875" />
        </div>

        {/* ── Progress bar ────────────────────────────────────────── */}
        <div style={{ background: "#12132a", borderRadius: 10, padding: "14px 18px", marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666", marginBottom: 8 }}>
            <span>AVANCE DE ESCRUTINIO</span>
            <span>{latest?.pct?.toFixed(3) ?? 0}% procesado</span>
          </div>
          <div style={{ background: "#1a1a2e", borderRadius: 6, height: 14, overflow: "hidden" }}>
            <div style={{
              width: `${latest?.pct ?? 0}%`,
              background: "linear-gradient(90deg,#2A9D8F,#457B9D)",
              height: "100%", borderRadius: 6, transition: "width 1s ease",
            }} />
          </div>
        </div>

        {/* ── Anomaly panel ───────────────────────────────────────── */}
        {allAnomalies.length > 0 && (
          <div style={{
            background: "#140808", border: "1px solid #E63946",
            borderRadius: 10, padding: "16px 18px", marginBottom: 22,
          }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#E63946", fontWeight: 700, marginBottom: 14 }}>
              ⚡ COMPORTAMIENTO ANÓMALO DETECTADO ({allAnomalies.length} eventos)
            </div>
            {allAnomalies.slice(0, 10).map((a, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "8px 10px", borderRadius: 6, marginBottom: 6,
                background: a.type === "SURGE" ? "#1e1100" : "#0a0a1e",
                borderLeft: `3px solid ${a.type === "SURGE" ? "#E9C46A" : "#457B9D"}`,
              }}>
                <span style={{ fontSize: 14 }}>{a.type === "SURGE" ? "▲" : "▼"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: a.type === "SURGE" ? "#E9C46A" : "#9EC8E8", fontWeight: 700 }}>
                    {a.type} — {a.candidate}
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{a.msg}</div>
                </div>
                <div style={{ fontSize: 11, color: "#444", whiteSpace: "nowrap" }}>z={a.z?.toFixed(2)}</div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "#444", marginTop: 10 }}>
              * Anomalía definida como variación &gt; 1.8σ respecto al promedio del lote de actas
            </div>
          </div>
        )}

        {/* ── Candidate table ─────────────────────────────────────── */}
        <div style={{ background: "#12132a", borderRadius: 10, overflow: "hidden", marginBottom: 22 }}>
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid #1e2040",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#888", fontWeight: 700 }}>RESULTADOS PRESIDENCIALES</div>
            <div style={{ fontSize: 10, color: "#444" }}>% de votos válidos</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#0e0f20" }}>
                  {["#", "Candidato", "Partido", "Votos", "% Válidos", "Δ Tendencia", "Historial"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#444", fontWeight: 700, letterSpacing: 1, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => {
                  const color = getColor(c.name);
                  const trend = getTrend(c.name);
                  const hist = getHistory(c.name);
                  const isAnomaly = latestAnomalies.some((a) => a.candidate === c.name);
                  return (
                    <tr key={c.name} style={{
                      borderTop: "1px solid #15162a",
                      background: isAnomaly
                        ? "rgba(230,57,70,0.07)"
                        : i % 2 === 0 ? "transparent" : "#0d0e1e",
                    }}>
                      <td style={{ padding: "12px 14px", color: "#444", width: 36 }}>
                        {i + 1}{isAnomaly && <span style={{ color: "#E63946", marginLeft: 5 }}>⚡</span>}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, whiteSpace: "nowrap" }}>
                        <span style={{
                          display: "inline-block", width: 9, height: 9,
                          borderRadius: "50%", background: color, marginRight: 8,
                        }} />
                        {c.name}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#666", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.party}</td>
                      <td style={{ padding: "12px 14px", color: "#aaa", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(c.votes)}</td>
                      <td style={{ padding: "12px 14px", minWidth: 150 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color, fontWeight: 700, width: 56, display: "inline-block" }}>{c.pct.toFixed(3)}%</span>
                          <MiniBar pct={c.pct} color={color} max={maxPct} />
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap", textAlign: "center" }}>
                        {trend !== null ? (
                          <span style={{ color: trend > 0 ? "#2A9D8F" : trend < 0 ? "#E63946" : "#555", fontWeight: 700 }}>
                            {trend > 0 ? "▲" : trend < 0 ? "▼" : "─"} {Math.abs(trend).toFixed(3)}%
                          </span>
                        ) : <span style={{ color: "#333" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <Sparkline data={hist} color={color} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Snapshot log ────────────────────────────────────────── */}
        <div style={{ background: "#12132a", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e2040" }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#888", fontWeight: 700 }}>HISTORIAL DE SNAPSHOTS ({snapshots.length})</div>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {[...snapshots].reverse().map((s, i) => (
              <div key={i} style={{
                padding: "10px 18px",
                borderTop: i > 0 ? "1px solid #14152a" : "none",
                display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap",
                fontSize: 11, color: "#666",
              }}>
                <span style={{ color: "#457B9D", fontWeight: 700 }}>{new Date(s.ts).toLocaleTimeString("es-PE")}</span>
                <span style={{ color: "#2A9D8F" }}>{s.pct?.toFixed(3)}%</span>
                <span>{fmt(s.actas_counted)} / {fmt(s.actas_total)} actas</span>
                <span style={{ color: "#444" }}>
                  Líder: {s.candidates?.[0]?.name} ({s.candidates?.[0]?.pct?.toFixed(2)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        <footer style={{ marginTop: 22, fontSize: 10, color: "#2a2a4a", textAlign: "center", lineHeight: 1.9 }}>
          Datos tomados de resultadoelectoral.onpe.gob.pe · Auto-refresh cada 2 min cuando activo<br />
          Anomalías detectadas por z-score (umbral ±1.8σ por lote de actas)<br />
          Resultados OFICIALES PRELIMINARES — no son encuesta ni conteo rápido
        </footer>
      </main>
    </div>
  );
}
