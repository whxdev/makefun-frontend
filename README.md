[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/whxdev/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/whxdev/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

# make.fun Live — a makefun-frontend-01 entry

A dependency-free static frontend for make.fun's public API: a live bounty board, bounty pages with live rewards,
leaderboards and public profiles. Plain ES modules and CSS in `app/`, no build step, no framework, no network fetches
beyond `https://make.fun/api`.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080. `--port <n>` serves another port.

## How it is handed in

```sh
node main.ts
```

This copies `app/` and `screenshots/` beside itself into `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes
`/output/dossier.json` with the vendored `vendor/makefun-frontend.ts` library. Leave `vendor/` untouched: the scorer
requires `dossier.json` to be byte for byte what its own copy writes.

## License

MIT — see `LICENSE`.
