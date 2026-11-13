# Agent rules for this repository

## Credit every contributor

- Every merged pull request, adopted idea and confirmed bug report gets a line in `ACKNOWLEDGEMENTS.md` under Code, Ideas or Bug reports, naming the GitHub handle, what they gave and the PR or issue number
- A feature rebuilt from someone's pull request or suggestion still credits them under Ideas, even when none of their code shipped
- Release notes credit the same people: each line that comes from a contributor ends with `(@handle, #n)`
- Add the attribution in the same change that lands the work; a release is not cut while `ACKNOWLEDGEMENTS.md` is missing someone in it
- The `credits` workflow fails a pull request whose author, commit authors or closed-issue reporters (other than the owner and bots) have no line there

## Colors

- Every color the plugin picks itself (a hex value: shimmer tones, treemap fills and labels) passes `bun scripts/contrast.ts`, and the `contrast` workflow runs it on any change under `hooks/`; fix the color, never lower the gate
- One owner-approved exception: the Desktop mustard for modified files (`DESK_GIT_TEXT` M and T) is checked on every background except the selected row, where no single mustard reaches 3:1 in both light and dark mode
- Text, git and line-count colors are terminal palette indices and muted text is the engine's `dimColor`, so the user's terminal and Claude themes own them; the script asserts they stay that way and reports their contrast in the known themes without gating on it

## Types and lint

- `tsconfig.json` checks `hooks`, `tests` and `types` against the engine types vendored in `types/engine/`; the `lint` workflow runs `tsc` and oxlint on every change
- When Claude Code updates, hot-reload the mod so the engine rewrites `.claude-plugin/types/`, copy `claude-code/index.d.ts` and `claude-code-tools/index.d.ts` from there over the same paths under `types/engine/`, and fix what `tsc -p tsconfig.json` reports. Never vendor `claude-code-mcp`: it lists the local session's MCP tools

## Tests

- Run tests with `claude plugin test .`, never `bun test`: `claude-code/testing` only exists inside that harness, so bun fails to resolve it

## Branches

- `master` is the main branch. Every change starts on its own branch cut from `master`, such as `fix/<what>` or `feat/<what>`
- A branch goes into `master` once `claude plugin test .` passes locally and its CI is green, through a pull request or a merge
- A branch never changes the version: it keeps `master`'s version in `.claude-plugin/plugin.json` and the README badge, and `.githooks/pre-push` and the version-bump workflow refuse one that does; after a release, merge `master` into the branch

## Releases

- Release when the owner decides; there is no schedule
- A release is a commit on `master` that sets the new version in `.claude-plugin/plugin.json` and the README badge (`chore: release 0.3.1`): the patch number for fixes only, the minor number when a feature, a setting or a behaviour changed
- Tag that commit with an annotated `v<version>` tag, push it, and publish the GitHub release from the tag
- The release notes cover every change merged into `master` since the last release
