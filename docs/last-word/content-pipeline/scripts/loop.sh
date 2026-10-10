#!/bin/bash
# Keeps the gated pipeline going across Gemini quota windows: run, and if it stopped, wait 30 minutes and try again.
cd "/d/VH Website/last-word-content"
until grep -q "ALL DONE" logs/batches.log; do
  node run-gen.mjs source/flippable-ids.json 6 3 >> logs/run.log 2>&1
  grep -q "critic gate failed" <(tail -1 logs/batches.log) && break   # a real quality stop needs a human, not a retry
  sleep 600
done
