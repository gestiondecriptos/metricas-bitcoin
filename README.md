# Métricas Bitcoin

Panel de métricas on-chain y de mercado para Bitcoin (MVRV, precio realizado, media móvil de 200 semanas, RSI de 14 días, ciclo de halvings, Fear & Greed, Rainbow Chart, ETFs spot de EE. UU. y liquidaciones de Hyperliquid).

## Actualización automática
El workflow `.github/workflows/daily-metrics.yml` ejecuta `scripts/etf.mjs` y `scripts/extra.mjs` dos veces al día (`0 6,18 * * *` UTC) y guarda los resultados en `data/*.json`.
