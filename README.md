# 🇵🇪 Monitor Electoral ONPE 2026

Monitor en tiempo real del escrutinio oficial de las Elecciones Generales Perú 2026.

## Features

- **Live data** — Fetches latest official ONPE results on demand
- **Anomaly detection** — Statistical z-score analysis flags candidates with unusual vote-share swings per batch
- **Sparklines** — Per-candidate trend history across snapshots
- **Auto-refresh** — Optional 2-minute polling
- **Snapshot log** — Full history of every data pull

## Tech stack

- React 18 + Vite
- Claude API (web search tool) for live data fetching
- Deployed on Vercel

## Data source

[resultadoelectoral.onpe.gob.pe](https://resultadoelectoral.onpe.gob.pe/main/resumen)  
Results are official preliminary counts — not polls or quick counts.

## Anomaly detection

For each new data batch, the app computes the average and standard deviation of percentage-point changes across all candidates. Any candidate whose shift exceeds **±1.8σ** from the batch mean is flagged as anomalous.

## Local development

```bash
npm install
npm run dev
```

## Deploy

Linked to Vercel — every push to `main` triggers a new deployment.
