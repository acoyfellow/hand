# Finish everything: status

Proof for each item, newest first. "Waiting on Jordan" lines say the exact click.

1. **/lab restored.** Live version 1e4b3e61 shows `data-chart="finished"` and `data-chart="cost"`, sections desk-3 and desk-4; no "hand finished the most", "Claude computer use finished the most" or "against Claude Opus" in the prose. Home copy has no competitor claims.
2. **hand speedups on main.** Commit 15e4158: mouse-first where presses are ignored, 150 ms settle with one retry, injection and danger checks in parallel, injection check reused when screen text is unchanged, `steps` tool, shortcut notes. `bun run check`: 50 pass.
3. **Type at the cursor.** Commit 19ae7b5: `type` with `mode: "insert"`, refused on devices that cannot do it. Tests in test/insert-mode.test.ts. Live check in the VM: " — 14°C, light rain" landed at the end of the Lisbon line in Notes and the item was ticked (Clef p=0.99 on the tick, 0.01 on the unticked item).
4. **Finder rename.** Commit 9f488fd. Setting the name field only changed the label, not the file; hand now selects, presses return, types and presses return, then checks Finder lists the new name. `mac-finder-rename`: PASS in 67.2 s, 23 turns, $0.0837 (lab/desk/one-task.ts).
5. **hand-cursor committed.** Commit 0ad396c on mac-cursor, merged into main as 9219dc1. Includes typing through System Events with paste for non-ASCII, because synthetic unicode key events never reached Notes.
6. **hand-site merged.** site-foldkit merged into main as c766980 and pushed.
7. **CI.** .github/workflows/check.yml. Run 42211447843 on 73eea53: success in 1m2s.
8. **v0.1.0.** Tag v0.1.0 on a89df58. https://github.com/acoyfellow/hand/releases/tag/v0.1.0 returns 200. Fresh download of hand-ax-0.1.0-macos-arm64.tar.gz matches SHA256SUMS and runs `ax apps`. Not signed: no Apple Developer ID; the README and release notes say how to open it.
9. **Codex and cua on desk-3.**
   - cua: Accessibility and Screen Recording both granted to com.trycua.driver on sandbox-1 (check_permissions). The desk entrant was a placeholder that always reported not installed; it is now a real adapter (lab/desk/entrants.ts `cuaDriverWith`: the planner calls `cua-driver call <tool> <json>`, with the makers' overview guide as its instructions) and its install check reports READY. Smoke run on `mac-textedit-edit-line` with gpt-6.1-sol: FAIL in 164.5 s, 30 turns (turn limit), $0.6718. It never located the TextEdit window: it pressed cmd+n and cmd+space and listed windows of the wrong pid. The full desk-3 cua rows have not been run yet.
   - Codex: **waiting on Jordan.** In the sandbox-1 VM window: System Settings → Privacy & Security → Screen & System Audio Recording → click **+** → choose Codex Computer Use → turn it on. Then the same under Accessibility. Its install probe still returns procNotFound.

Spend so far in this loop: under $1 of model calls (one Finder run $0.08, the insert and tick checks, the parallel take $0.23 before the loop).
