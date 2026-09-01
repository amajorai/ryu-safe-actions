<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./icon-dark.png" />
    <img src="./icon-light.png" alt="Safe Actions" width="144" />
  </picture>
</p>

<div align="center">

# Safe Actions

</div>

A policy, review, and receipt Companion for Core's typed, deterministic, fail-closed tool-plan verifier.

> **The public home of `ryu-safe-actions`.** Source, builds, and releases live here —
> a self-contained Companion archive is attached to each release.
>
> This tree is generated from the Ryu monorepo, so commits pushed here
> directly are replaced on the next sync. **Pull requests are welcome** —
> open them here and they are ported into the monorepo, then flow back out.
> Ryu as a whole: https://github.com/amajorai/ryu

## Install

**App:** [Install](ryu://apps/@ryu/safe-actions) (opens the Ryu desktop app and asks you to confirm)

**CLI:**

```bash
ryu apps add @ryu/safe-actions
```

## Source & build

The **source of record** for this standalone Companion lives in `sidecar/`.
It has no native service: `cd sidecar && bun install && bun run build` produces
the static UI under `sidecar/dist/`. Each release attaches a self-contained
archive whose `manifest.json` resolves `./sidecar/dist/index.html`.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
