# Saker — Development Preview

Saker is an independent, experimental desktop IDE fork based on the MIT-licensed Orca project: https://github.com/stablyai/orca . The original LICENSE and source attribution must be retained.

## Current preview

The desktop rail now exposes labeled Projects, Brain, Search and Settings controls. Brain loads on demand. Open Brain → Index to choose a project, then select **Set up memory** or explicitly choose **Set up with agent guides**. Workspace notes remain in their project folders.

Project notes use revision-checked writes. General memory is scoped to the active Saker profile. If the older shared General Brain exists, Notes offers **Copy earlier note**. To capture an agent contribution, open **Review update** on an initialized project, review the Markdown, and select **Record update** to append it to the project history.

## Current design and features

- Neutral charcoal, steel blue and gray visual system; original animations and terminal infrastructure preserved.
- Saker activity rail and minimized settings/navigation.
- Orca task, automation and mobile shortcuts hidden; promotional onboarding/update/star cards removed from normal workspace chrome. Important sign-out notices remain.
- Original vector brand mark and standalone Windows launcher icons.
- Original Saker vector file and folder glyphs used by the file explorer. All artwork is editable SVG drawn in React, not bitmap emoji.
- File explorer defaults to hiding dotfiles and common generated folders. Both can be shown via Explorer > More actions.
- Saker Brain: Graph / Notes / Index tabs.
- Graph (Obsidian-inspired): an actual force-directed 2D graph using D3 Force, rendered on an antialiased Canvas. Small, flat vector circles sized by reference degree; thin links and labels that fade with zoom. Hover highlights immediate relationships, click selects, double-click opens a Brain note, right click opens node actions (local graph, pin/unpin). Global and local graph with depth control. Wheel/keyboard zoom, pan, search, fit, reheat simulation, optional sections/references/orphans and directions. Live Center/Repel/Link Force/Link Distance sliders. Layout and settings saved locally. The graph semantics adapt Saker's General Brain and project Markdown summaries; they are not Obsidian's proprietary implementation.
- Graph responsiveness: bounded D3 warmup produces the initial arrangement before paint; rapid cooling replaces multi-second settling. Physics updates no longer restart when only display options change. Clickable hitboxes are measured in screen pixels at any zoom, including visible labels; clicking empty canvas clears selection.
- The right-side Connections inspector shows the selected node's source Brain file, outgoing relationships, and incoming backlinks. It explicitly identifies headings/tags as references (not verified physical files), supports navigation among related nodes, and can open the owning Brain note. It does not yet scan every code file in a project.
- Notes: Markdown Write, Preview, Split; GFM tables, checklists, headings, code and sanitized rendering.
- Index: summary cards for all tracked local projects and general shared notes.

## Persistent memory

- Global: `brain/general.md` under the active profile directory. The project index is derived on read. The earlier shared note is available for opt-in copy.
- Per registered local project: `.saker/brain.md` and `.saker/updates.md` are created on explicit setup. `.saker/settings.json` is written when preferences change.
- For supported local agents, Saker creates `AGENTS.md` and `CLAUDE.md` guides only if they do not already exist. It never overwrites user-authored agent instructions.
- The generated guides ask agents to read the Brain before work and propose updates for human review. Structured turn completion is a future integration.
- Remote/SSH projects and root/home directories are not automatically modified by the local project Brain service.
- Disabling Brain preserves Markdown files and guides.
- Avoid storing credentials, secrets or personal data in Brain notes.

## Run the dev version (no installer)

The development build loads full locale catalogs. Source scanning for the compact main-process catalog runs on the distribution build path.

Double-click `Iniciar Saker Dev.bat` or use:

```cmd
cd /d "C:\Users\troll\Desktop\Orca Source"
set "ORCA_DEV_USER_DATA_PATH=%APPDATA%\Saker\dev-graph-v0.3"
npx --yes pnpm@12.14.0 dev --worktree-profile
```

The isolated dev profile avoids touching the original Orca profile. Do not run multiple instances with the same custom profile simultaneously.

## Historical preview verification

These results describe earlier builds. The historic CDP scripts target a live dev renderer. The former IPC script exercises the old renderer-supplied catalog. Use the isolated service tests for that contract.

- `pnpm typecheck`: zero TypeScript errors, exit code 0.
- `vitest ... SakerBrainGraph.test.ts`: 4/4 tests passed, including local neighborhood queries and wiki-link resolution.
- CDP in-app smoke: Graph nodes and links rendered; Notes formatted Markdown; Index rendered.
- CDP interaction smoke: drag + persisted positions + reset, Markdown split, explorer SVG icons and dotfile filtering passed.
- Temporary local project Brain smoke: automatic file creation, general index entry, enable/disable, and note preservation passed; test folder removed.
- Visual captures: `out/saker-brain-graph-smoke.png`, `out/saker-brain-notes-smoke.png`, the force-directed graph `out/saker-obsidian-graph-dev.png`, and the inspector `out/saker-graph-inspector-test.png`.
- CDP Obsidian-graph smoke: force-directed Canvas rendered, seven physics/display sliders, four filters, zoom and local graph verified.
- Graph inspector smoke in a clean dev profile: initial Brain appeared in under one second, node click displayed 3 outgoing references, empty-canvas click cleared the selection, and the Brain API read completed in about 28 ms on that device. No console exceptions.
- Graph hitbox/relationships: 9/9 Vitest tests passing (zoom-sensitive circles, label selection even at low zoom, empty-canvas deselection contract, backlinks and local graph).

No production installer was built for this preview. Branch: `saker/brand-v1`.

## Remaining work

- Validate with multiple real user projects, including nested worktrees, and handle remote/SSH project memory safely.
- Fully automated agent completion hooks and project-memory changes with user review (beyond agent guide instructions).
- Further full-service rebranding of deep internal modules, documentation links, telemetry and update infrastructure; do not remove the MIT attribution.
- Accessibility and responsiveness testing across resolutions; graph performance with large catalogs and thousands of notes. The current Brain still indexes one main note per project plus headings, tags and wiki-links, rather than every Markdown file in an Obsidian vault.
