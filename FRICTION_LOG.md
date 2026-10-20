# BorrowMesh friction log

This log is for friction with the tools and guidance this project depends on (the MCP TypeScript SDK and specification, the hackathon's Alexa+ track material, and Kiro Crew, the AWS development tool used during the hackathon). Each entry records the task, steps, expected and actual results, severity, workaround, and an actionable suggestion.

No friction with the MCP SDK, the specification, or the track material was observed while building BorrowMesh. Problems in this project's own code or video tooling are described in the project story instead. The entries below come from using Kiro Crew 0.9.0 with Kiro CLI 2.32.0 on macOS on October 20, 2026, to implement the `check_in_bundle` domain function.

## 1. `kirocrew run` worked in an empty folder instead of the repository

- **Task:** Implement `check_in_bundle` from a written spec with the Kiro Crew task runner.
- **Steps:** Installed Kiro CLI and signed in with GitHub; from the repository folder, ran `kirocrew run <spec>.md --timeout 3600`.
- **Expected:** The run edits the repository it was started from.
- **Actual:** With `taskrunner.workspace_dir` unset, the run used a new per-run folder. The agent reported "The working directory has no source files — only `.kiro` config", and no repository file changed.
- **Severity:** High — the run produced nothing.
- **Workaround:** `kirocrew config set taskrunner.workspace_dir <repository path>`.
- **Suggestion:** Default CLI runs to the current git repository, or stop and ask when the workspace has no source files.

## 2. CLI runs cannot write files or run commands, and report it only in the log

- **Task:** The same implementation, run again with the workspace set.
- **Steps:** Ran `kirocrew run` with a narrower spec. Also added the tool names to `hooks.auto_approve_tools` in `config.json` (`kirocrew config set hooks.auto_approve_tools` answered "Unknown key").
- **Expected:** Either a per-run approval option on the CLI, like the dashboard's "auto-approve tool calls", or a clear stop before planning.
- **Actual:** File writes and shell commands were refused ("write, shell, read, and glob are all blocked on this task runner surface"), while the run kept planning, re-planning and reviewing. The `auto_approve_tools` entry made no difference for these runs. The first two runs used 24.79 of the 50 free monthly credits without a code change.
- **Severity:** High — credits were spent with no possible result.
- **Workaround:** Started the run from the dashboard's Task Runner with "auto-approve tool calls" checked for that run. That run implemented the function and its tests.
- **Suggestion:** Add a scoped `--auto-approve` to `kirocrew run`, and fail fast before spending credits when no write tool can be approved.

## 3. A run reported success although no code changed

- **Task:** The second CLI run above.
- **Steps:** Read the run summary and the run's git branch.
- **Expected:** "Task completed" only when the requested changes exist and the tests pass.
- **Actual:** The summary said "Task completed", and the branch had commits named "step 1: Add CheckInResult type…" and "step 2: Implement check_in_bundle…", but they only changed files under `.kiro/settings/`. The agent's own output said that tasks 1–3 "were never actually implemented". In the later, successful run, a commit message said "89/89" tests passed while our own run of the suite showed 91.
- **Severity:** Medium — a reader of the summary could merge a no-op believing the feature exists.
- **Workaround:** Read `git diff` of the run's branch and run the tests ourselves before merging.
- **Suggestion:** Base completion on a non-empty diff in the requested files and on the test command's exit code, and flag steps that changed nothing.

## 4. Self-review errors and throttling are easy to miss

- **Task:** The first CLI run.
- **Steps:** Read the run log after the run ended.
- **Expected:** A failed self-review or a throttled model call is visible in the run summary.
- **Actual:** Self-review raised `ValueError: BoundedSemaphore released too many times`, and later "Self-review could not verify the step: the review itself failed". Model calls hit "Bedrock is throttling requests" twice and were retried. These appeared only in the log.
- **Severity:** Low.
- **Workaround:** Reviewed the diff and ran the tests ourselves.
- **Suggestion:** Show unverified steps and throttling retries, with their credit use, in the run summary.
