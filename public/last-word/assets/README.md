# Last Word assets

Drop files here using the exact names and folders in
[`docs/last-word/ASSETS_NEEDED.md`](../../../docs/last-word/ASSETS_NEEDED.md), then run:

```sh
npm run last-word:validate-assets -- --write
```

Only files that pass are listed in `available.json` (generated, not committed); the game loads those
and uses its built-in procedural placeholder for everything else. No code changes are needed.
