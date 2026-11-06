# What the other tools do about hand's five gaps

Sources, all from 2026-11-06:

- The live tool lists of cua-driver (63 tools) and agent-desktop (about 60 commands), read from the VM. Saved in `bench/runs/rivals/`.
- The desk-3 traces. `bun lab/desk/rival-diff.ts <task>` prints every step each tool took.
- Claude computer use, from its desk-3 traces only. It is a model, not a driver.

## Mac tasks where hand lost and others won (desk-3)

| Task | hand | Who won, and how |
|---|---|---|
| Notes: add a line | failed, 187 s | Claude in 69 s. Click the line, press End, Return, type. |
| Finder: move to Trash | failed, 147 s | cua in 27 s. Click the file's token, then ⌘⌫. |
| Settings: hide Dock | failed, 200 s | cua in 26 s. AXPress on the checkbox, then read the tree diff. |
| Reminders: tick done | failed, 166 s | agent-desktop in 26 s. A `check` command. |
| Finder: move file | failed, 199 s | Claude in 18 s. |

hand also wins some: Finder rename, the calendar event and copy-to-note are passed only by hand. Every other tool claimed false success on them or failed.

## Gap 1: it can only target whole controls

- **What hand does:** it lists controls, then Clef picks one by meaning. A whole note is one control.
- **cua:**
  - Every row in a snapshot gets a token (`snapshot:N`), and the agent sends that exact token.
  - Coordinates in the window screenshot are a first-class fallback.
  - `zoom` crops a region for a closer look, with `from_zoom` clicks.
  - `parse_visual_regions` finds text and icons on canvases.
- **agent-desktop:**
  - `@ref` ids from the snapshot, plus `find` by role, name or text.
  - `get` reads a value or bounds, and `is` checks a state.
- **Claude:** pixel coordinates from screenshots. It got around "one big box" by clicking the visible line, then pressing End.
- **Best idea to take:** keep picking by meaning, but add two paths.
  - **Exact ids:** let the agent send an exact id (`e6`) and skip Clef. cua and agent-desktop both make that the main path. hand's traces show the agent already typing "textbox e6", with Clef then guessing.
  - **Points:** let the agent target a point in the screenshot, as cua and Claude do. That works for one line of a note, a canvas, or an icon with no label.

## Gap 2: no way to put the cursor at a spot inside text

- **cua:** `type_text` writes `kAXSelectedText` at the current selection, so whatever is selected is replaced at the caret. Placing the caret is left to clicks, keys or JavaScript in `run_script`. It has no "after this text" command.
- **agent-desktop:** `type` inserts into a ref, `set-value` replaces the whole value, `clear` empties it. It has no caret placement either.
- **Claude:** clicks the line on screen, then End.
- **Nobody has "insert after this text".** That's an opening.
- **Idea to build:** `type(text, into, after: "…")`.
  1. Set `kAXSelectedTextRange` to just after the match.
  2. Write `kAXSelectedText`.
  3. Read back the whole value and check that only the insert changed.

  hand already sets that range when it selects all (`native/ax.swift:471`), so this is a small extension.

## Gap 3: slow, a model call on every step

- **hand:** Clef picks and Clef checks on every `act`, plus checks for injection and risk. That's 2–4 s a step, and there's no batching of exact ids.
- **cua:** it has no model inside.
  - `run_steps` runs up to N actions in one call and stops at the first failure.
  - With `observe`, the changes come back in the same reply.
  - `run_script` runs JavaScript with loops and checks in one call.
  - Its trash task took 2 calls and 27 s.
- **agent-desktop:** no model inside either. One command per call, and each answers in milliseconds.
- **Best idea to take:**
  - Skip Clef whenever the target is exact: an id, a point, or the field that already has focus.
  - Keep Clef only for picks by meaning.
  - hand has `steps` already; add cua's `observe` so one call acts and reports what changed.

## Gap 4: it doesn't verify its own edits

- **hand:** it reads back what was typed into a field ("delivered_verified"). It doesn't check that nothing else changed, so typing over a whole note went unnoticed.
- **cua:**
  - `verify_state` checks fixed conditions (value, checked, exists) against the window's real state, and answers satisfied, unsatisfied or unknown.
  - Diff reads (`since: latest`) list what was added, changed and removed after each action.
  - `type_text` reports `effect: "unverifiable"` for web content rather than claiming success.
- **agent-desktop:**
  - Every result carries a delivery status (`delivered_unverified`, `not_verified`) and a retry status (`unsafe`).
  - `--wait-for` polls until an element appears.
  - `is` checks a state.
- **Best idea to take:**
  1. cua's **diff after every action**, built into the reply.
  2. cua's **satisfied / unsatisfied / unknown** check, which we can offer as `expect`.
  3. An **edit guard** of our own: after typing, compare the value before and after. If anything outside the edit changed, undo it and report an error. Nobody does this.

## Gap 5: too few verbs

- **hand:** about 11 tools, including act, type, key, steps, look, outline and activate.
- **cua:** 63 tools. The ones hand lacks, and that the traces show matter:
  - `set_value`, for popups, sliders and dates, and for renaming a Finder file through scripting with a read-back from disk.
  - `invoke_menu`, which follows an exact menu path.
  - `drag` and `double_click`.
  - `set_window_frame`.
  - `clipboard_read`/`clipboard_write`.
  - Background input, so the user's front window keeps focus.
  - Recording and replay.
- **agent-desktop:** `check`/`uncheck` (which do nothing if the box is already in that state), `toggle`, `select`, `expand`/`collapse`, `scroll-to`, `triple-click` and `drag`, plus `list-surfaces` for menus, sheets and popovers.
- **Best ideas to take,** in the order the failed tasks need them:
  1. **`check` / `uncheck` that do nothing if already set, reading AXValue.** This fixes Dock and Reminders: hand clicked the box twice and flipped it back.
  2. **`menu("File > New Folder")`,** cua's `invoke_menu`. This fixes Finder's move and new-folder tasks without hunting for icons.
  3. **`set_value`** for popups and dates.
  4. **`double_click` and `drag`.**
  5. **Clipboard read and write,** for copying between apps.

## What to keep that nobody else has

- **Picks by meaning with a probability,** and stopping when unsure. The others need exact ids and leave the choosing to a big model.
- **A safety refusal before risky clicks,** and flags for text on screen that tries to steer the agent.
- **One visible cursor per agent,** with a shared lock for several agents. cua has session cursors too.
- **Cost:** hand's planner calls are small, and on exact paths Clef costs nothing.

## Proposed order of work

Each item has a test, and success is measured on desk-3's 20 Mac tasks plus the real-use note task.

1. **Exact ids and points skip Clef,** and `steps` returns the changes (gaps 1 and 3).
2. **`type … after:`, with an edit guard** (gaps 2 and 4).
3. **`check`/`uncheck` and `menu`** (gap 5).
4. **`expect`,** returning satisfied, unsatisfied or unknown (gap 4).
5. **`set_value`, `double_click`, `drag` and the clipboard** (gap 5).
