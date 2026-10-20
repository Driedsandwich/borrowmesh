# Submission fields

| Devpost field | Value |
| --- | --- |
| Project name | BorrowMesh |
| Tagline | Borrow a complete, compatible tool kit and workshop bench in one booking. |
| Primary track | Alexa+ |
| Mini challenges | AWS Builder — Kiro Crew used as a development tool during the hackathon (how it was used: Product feedback › Kiro Crew) |
| Built with | TypeScript; Node.js; npm; MCP TypeScript SDK 1.32.1; MCP specification 2025-11-25; Streamable HTTP; Express; Zod; Vite; Vitest; happy-dom; Playwright; Chromium; tsx; concurrently; ffmpeg; ffprobe; Kokoro (kokoro-onnx); Python; Kiro Crew; Kiro CLI; HTML; CSS |
| Try it out | https://github.com/Driedsandwich/borrowmesh |
| Video demo link | TODO_VIDEO_URL |
| Team / development disclosure | Solo entrant; built during the submission period with AI coding agents. One agent implemented written specifications; a second reviewed the code, ran the browser walkthrough, recorded the video, and verified results. A Kiro Crew task-runner run implemented the check-in domain function, which was reviewed and corrected before merging. |
| Existing-project explanation | New project, built on October 20, 2026 (JST), during the hackathon submission period. |

## Project story

# BorrowMesh

## Inspiration

A tool reservation is useful only if the whole working set is available. A drill without matching power or bits, or tools without a bench, cannot complete the intended project. BorrowMesh makes the **complete working set the unit of borrowing**: plan, hold, book, repair, and cancel the set together.

The fictional scenario is specific. Priya wants to build a planter box on Saturday, October 24, 2026, between 13:00 and 17:00 at Maple Lane Tool Library. She needs a wood saw, a drill with 3 mm and 6 mm bits, two clamps, safety glasses, and a workshop bench. Her preferred platform A cordless drill is on loan until Sunday. Finding another drill alone does not solve the problem; its accessories and bench time must work together.

## What it does

BorrowMesh is a **simulated Alexa+-style experience, not affiliated with Amazon, with fictional data**. Its web workbench pairs conversation and suggested requests with item tiles, complete-kit cards, and a bench timeline. The browser makes real calls to the local server. Requests can be typed, picked from suggestions, or spoken where the browser supports speech recognition, and replies can be read aloud with the browser's speech synthesis.

Priya can compare three complete options: “Plug-in kit · standard clamps,” “Battery kit · platform B · standard clamps,” and “Plug-in kit · wide-jaw clamps.” Cards explain substitutions, bench times, and return deadlines. Choosing the plug-in kit holds its tools, extension cord, and bench together. After explicit consent to the changed setup, the booking includes seven catalog items, including a two-clamp pair, and the 14:00–16:30 bench slot.

Reloading retrieves the saved booking. “The clamps are broken” replaces only the clamp item and preserves the other reservations. “Cancel my booking” releases the entire set and bench; in the canonical scenario, Jonas on the fictional waitlist receives a complete booking.

The fictional waitlisted borrower Jonas joined the waitlist accepting compatible substitutions, so releasing a booking can book a complete kit for him without a new dialog.

## How we built it

The TypeScript application uses the Model Context Protocol (MCP), a standard for connecting clients to tools and data. The MCP TypeScript SDK 1.32.1 supplies the server and browser client over Streamable HTTP, negotiating protocol 2025-11-25. Eight tools cover state, search, holds, commit, release, issue reporting, booking retrieval, and reset. JSON resources expose the catalog and bookings. The `plan-weekend-project` prompt describes the planning workflow.

Search deterministically checks drill and battery compatibility, required bits, availability, bench slots, and return deadlines. It ranks feasible bundles by fewer substitutions, earlier bench time, and shorter loan duration, returning up to three options.

Holds expire after ten simulated minutes. MCP form elicitation requests explicit consent when a setup change requires it. After consent, the server revalidates every resource. Mutations run serially within one server process; atomic commit saves the whole booking or books nothing. A conflict cancels the hold and returns fresh alternatives. Declining consent releases the hold. Full cancellation uses `release_bundle` to roll back the reservation by releasing all booked resources together.

JSON persistence writes a temporary file and renames it atomically. The deterministic intent router maps supported requests to actions without a language model. The Protocol inspector shows actual JSON-RPC messages, including initialization, tool discovery, calls, and elicitation. Vite builds the browser app; Vitest covers domain behavior, client flow, HTTP integration, and process restart. Playwright records the working browser flow; local speech synthesis and ffmpeg produce the video. During the hackathon, a Kiro Crew task-runner run implemented the check-in domain function and its tests from a written spec; we reviewed its commits and fixed three defects before merging.

## Challenges we ran into

Consent creates a gap between checking availability and committing. The implementation rechecks after the response; tests cover a resource becoming unavailable during a hold and a reset while consent is pending.

During video assembly, our timing check rejected a segment by 51 ms. Encoded-frame measurements had 40 ms resolution. Allowing two frames of measurement error corrected the check; the next audio segment started 360 ms later, so audio did not overlap.

## Accomplishments that we're proud of

The real-browser walkthrough completed search, hold, consent, booking, reload, clamp replacement, cancellation, and waitlist service with zero browser console errors. A fresh-copy installation passed the build and all 92 tests. The recorded demonstration is 157.2 seconds long.

## What we learned

This implementation demonstrates why complete-kit availability must be checked again at commit, even after a hold and a consent dialog. It also shows the value of keeping compatibility rules in the domain logic and exposing actual protocol traffic for inspection.

## Potential impact

For a community tool library, complete-kit planning could help borrowers avoid incomplete reservations and help staff coordinate accessories and workspace. Releasing a whole booking could make a usable set available to the next borrower. In the canonical scenario, the preferred cordless drill is out on loan; searching for a drill alone would not tell Priya that the corded alternative also needs an extension cord and an outlet bench, while BorrowMesh returns only kits that are complete for her time window. These are potential benefits; there are no measured savings or real-user results.

## Scope and limitations

All borrowers, inventory, and reservations are fictional. There is no real Alexa integration, authenticated consent, library connection, payment, notification, or AWS runtime service. No account, API key, or paid API is needed to run the demo. The router supports a small set of requests and two project templates. Scheduling uses fictional times; JSON storage supports one local server process. Physical check-in exists in the domain layer with tests but is not yet exposed as an MCP tool or in the workbench.

## What's next

Expose check-in, which already handles missing and damaged parts in the domain layer, as an MCP tool and in the workbench. Before a real-library pilot, add authenticated borrowers, production storage, and real inventory integration, then evaluate complete-kit planning with library staff and borrowers.

## Product feedback

# Product feedback

The observations below concern this local, fictional BorrowMesh demo. Proposed improvements are requests, not claims that a tool failed. No AWS service is called at runtime; Kiro Crew was used as a development tool (last section).

## MCP TypeScript SDK 1.32.1

- **Use:** Server registration, browser client, Streamable HTTP sessions, structured tool results, and form elicitation for consent.
- **Worked well:** The browser walkthrough completed the booking flow with real MCP exchanges. HTTP integration tests cover discovery, competing sessions, consent, and cancellation.
- **Improve:** Add an end-to-end booking example that holds multiple resources, pauses for consent, revalidates, and commits or releases everything. BorrowMesh implements that coordination in its application code.
- **Onboarding:** A fresh-copy `npm ci`, build, and test run succeeded. No separate first-hello-world account was recorded, so there is no claim about setup speed.
- **Use again:** Yes, for a TypeScript client/server integration with explicit consent and inspectable traffic.

## MCP specification 2025-11-25

- **Use:** Protocol negotiation, tools, resources, prompts, and form elicitation.
- **Worked well:** Tests discover eight tools, two resources, and a planning prompt. The browser verifies the negotiated version and displays the actual messages in the Protocol inspector.
- **Improve:** Provide a worked guide for consent across expiring holds, stale state, unsupported elicitation, and cancellation. Transport success and domain-level booking success need separate handling in this project.
- **Onboarding:** The repository's tests exercise version negotiation, initialization, and session headers. No documentation-reading time or specification defect was recorded.
- **Use again:** Yes, for exposing assistant actions through a common protocol while retaining domain rules on the server.

## Hackathon Alexa+ track guidance and FAQ

- **Use:** Choosing a self-hosted MCP server and a simulated web experience, with local run instructions and a demonstration video.
- **Worked well:** The supplied guidance explicitly permits simulation. The FAQ explains that the preview developer tools are unavailable to participants and that a locally runnable repository plus video is sufficient without hosting.
- **Improve:** Put the simulation route and preview-access limits together at the top of every relevant setup guide. Provide one checklist covering protocol, transport, source, video, and feedback requirements.
- **Onboarding:** The FAQ gives an entry route that does not require preview access or physical Alexa hardware. No attempted preview signup or access failure is claimed.
- **Use again:** Yes, for a local prototype under the documented simulation route. This is not a claim of eligibility approval or a tested Alexa deployment.

## Vite

- **Use:** Local web development, proxying `/mcp` to port 3002, and production bundling.
- **Worked well:** The fresh-copy production build succeeded, and the recorded browser flow used the web app.
- **Improve:** A recipe combining a strict local port, an MCP proxy, and a session-based client would match this setup. No Vite defect was recorded.
- **Onboarding:** The repository provides npm scripts and a proxy configuration; the fresh-copy build verified that path.
- **Use again:** Yes, for this small TypeScript web client.

## Vitest and happy-dom

- **Use:** Vitest runs domain, router, palette, HTTP, and process-restart tests. happy-dom supplies a simulated document environment for client-flow tests.
- **Worked well:** The verified fresh-copy run passed all 92 tests. The client tests explicitly use deterministic responses rather than a real browser.
- **Improve:** Keep examples clear about which checks need a real browser. BorrowMesh uses Playwright separately; no runner or document-emulation defect was recorded.
- **Onboarding:** `npm test` runs the configured suite after dependency installation.
- **Use again:** Yes, alongside real-browser checks rather than treating document emulation as browser verification.

## Playwright and Chromium

- **Use:** Driving and recording the full browser flow at 1280×800, including reload, consent, clamp replacement, release, and protocol inspection.
- **Worked well:** The verified walkthrough used Playwright 1.64.1 and Chromium build 1248, completed the flow, and recorded zero browser console errors.
- **Improve:** A recording example that exposes encoded-frame timing for narration alignment would fit this workflow. The timing-check issue described in the project story belonged to our own video builder, not Playwright.
- **Onboarding:** Chromium needs a separate installation. The recording instructions specify `PLAYWRIGHT_BROWSERS_PATH=./data/browser-cache npx playwright install chromium`; ports 3002 and 5174 must be free.
- **Use again:** Yes, for repeatable UI checks and a demonstration recorded from actual interactions.

## ffmpeg and ffprobe

- **Use:** Measuring media, normalizing speech clips, assembling original title and closing cards, and encoding H.264/AAC output.
- **Worked well:** The finished video is 157.2 seconds at 1280×800. The verified audio measurements are mean −19.0 dB and peak −1.9 dB.
- **Improve:** Our builder's timing tolerance needed to account for encoded-frame resolution. No ffmpeg or ffprobe failure was recorded.
- **Onboarding:** Both executables must be installed before media generation. The scripts check their availability and validate media manifests and output.
- **Use again:** Yes, for local, scripted video assembly and measurement.

## Kokoro text-to-speech (kokoro-onnx)

- **Use:** Generating narration (voice `am_michael`) and assistant responses (voice `af_heart`) locally, across 18 clips in 11 segments. We chose it because its model weights are Apache-2.0 licensed; macOS system voices are licensed for personal, non-commercial use only.
- **Worked well:** One Python process loads the model once and writes every clip; our scripts measure each clip and normalize the audio. No network service, account, or API key is needed.
- **Improve:** At the default speed the raw recording was 164.8 seconds, so the finished video would have exceeded our 140–165 second target; we set speed 1.1. A documented speaking-rate figure for each voice would make narration planning easier.
- **Onboarding:** Install `kokoro-onnx` and `soundfile` into a Python environment and download two model files (about 205 MB) from the kokoro-onnx release page.
- **Use again:** Yes, for local narration that can be published.

## Node.js, npm, TypeScript, and tsx

- **Use:** Node.js runs the application and scripts; npm installs dependencies and invokes commands; TypeScript checks types; tsx executes TypeScript entry points.
- **Worked well:** The fresh-copy installation, build, tests, and demo reset exited successfully. The build runs the type checker before bundling.
- **Improve:** Make the supported Node.js range prominent in setup instructions. The project requires Node.js 22.12 or later within the Node 22 series; no runtime or package-manager defect was recorded.
- **Onboarding:** Install that Node.js version, run `npm ci`, then use the documented npm commands. No installation-duration claim is available.
- **Use again:** Yes, for a shared language across browser, server, domain logic, and media scripts.

## Express and Zod

- **Use:** Express hosts the local HTTP application. Zod defines tool-input schemas through the MCP SDK.
- **Worked well:** HTTP integration tests exercise local-origin checks, sessions, methods, and protocol headers. Schemas specify the arguments exposed by the tools; domain logic adds compatibility and calendar validation.
- **Improve:** A combined schema-and-domain-validation example would fit this project. No Express or Zod defect was recorded.
- **Onboarding:** Both are installed as application dependencies; no separate onboarding experience was recorded.
- **Use again:** Yes, for local HTTP routing and typed input validation.

## concurrently

- **Use:** Starting the MCP server and Vite together through `npm run dev`, with the other process stopped when one exits.
- **Worked well:** The command configuration provides one development entry point. No separate reliability measurement was recorded.
- **Improve:** No specific tool improvement is supported by the available observations.
- **Onboarding:** Installed with the development dependencies; the README provides the command.
- **Use again:** Yes, for a two-process local development setup.

## Browser speech APIs

- **Use:** Optional speech output and microphone input in the web client. Microphone input is conditional on browser support.
- **Worked well:** Text and suggested requests remain available independently of voice. Browser speech was disabled for recording to avoid duplicating the generated narration.
- **Improve:** Broader voice and microphone portability would help; no cross-browser compatibility result is claimed.
- **Onboarding:** These controls depend on browser and operating-system support. The verified recording does not establish microphone or live speech-output success.
- **Use again:** Yes, as optional controls with text retained.

## AI coding agents

- **Use:** One agent implemented written specifications; a second reviewed the code, exercised the real browser, recorded the video, and verified results. The entrant is solo.
- **Worked well:** The supplied verification records build/test success and a complete browser walkthrough.
- **Improve:** Keep implementation claims separate from independently executed checks and unfinished features. No product-specific onboarding observation was recorded.
- **Onboarding:** No separate setup experience was recorded.
- **Use again:** Yes, with executable checks and explicit development disclosure.

## Kiro Crew (AWS Builder)

- **Use:** We used Kiro Crew 0.9.0 with Kiro CLI 2.32.0 on the Kiro Free plan as a development tool during the hackathon. A task-runner run, given a written spec, implemented the `check_in_bundle` domain function and replaced the three planned `todo` tests with five real tests (commits 9740315, 05e5777 and ad75c78). No AWS service is called at runtime; this follows the rule that building with Kiro Crew qualifies on its own.
- **Worked well:** Started from the dashboard's Task Runner with "auto-approve tool calls" for that run, it planned the work, edited three files in a separate git worktree, committed its steps, and the suite passed. The code followed the existing pure-function style of the domain layer. The run took about 13 minutes and used 15.39 credits.
- **Improve:** Two earlier runs started with `kirocrew run` changed no code: the first worked in an empty per-run folder and was refused file writes and shell commands; the second reported "Task completed" although its step commits only touched `.kiro/settings`. Those two runs used 24.79 of the 50 free monthly credits. Our review of the successful run found three defects (missing items became available again, the message always said the bench was freed, and item IDs outside the booking were accepted), fixed in a follow-up commit. The friction log has the details.
- **Onboarding:** The CLI installer copied an app to `/Applications`, and a login launcher was added. Sign-in was a browser flow with GitHub. Telemetry and content sharing could be switched off with `kiro-cli settings`. The dashboard needed a sign-in URL from `kirocrew token`, and its first-run dialog offered to import other agents' setups, which we skipped.
- **Use again:** Yes, for well-scoped tasks started from the dashboard with a per-run approval, after reading the diff and running the tests ourselves.

## Feature requests

# Feature requests

These are requests grounded in BorrowMesh's implementation, not reports of missing protocol guarantees or incidents at a real library.

## 1. Reference workflow for atomic multi-resource booking

**Priority: Important**

**Request:** Add an MCP SDK example that searches a compatible bundle, holds all resources with an expiry, requests consent, revalidates, and either commits everything or releases the hold. Include tests for a resource becoming unavailable and for competing sessions.

**Why it matters:** BorrowMesh coordinates tools, accessories, and a bench inside one serialized server process. Its tests cover conflicts during holds and consent. A reference workflow would help developers implement the same domain guarantees without mistaking a successful tool call for an atomic booking. The application's storage still needs to enforce those guarantees.

## 2. Consent examples that preserve the full booking context

**Priority: Important**

**Request:** Provide an SDK/client example showing the original request, proposed substitution, required accessories, bench slot, return deadline, and hold expiry beside a form-elicitation consent control. Cover decline, cancellation, unsupported clients, and state changes while the form is open.

**Why it matters:** BorrowMesh's corded-drill alternative requires an extension cord and outlet bench. Its browser supplies the surrounding booking UI; the server sends the changed-setup explanation and consent field. A complete example would make it easier to keep the borrower's decision connected to the resources being booked.

## 3. Public Alexa+ simulation starter and submission checklist

**Priority: Nice-to-have**

**Request:** Offer a runnable web starter with Streamable HTTP, protocol 2025-11-25 negotiation, tool cards, form elicitation, and a raw-message inspector. Link it directly from a checklist that distinguishes the simulation route from preview-only tooling.

**Why it matters:** BorrowMesh includes its own browser MCP client, deterministic router, cards, and Protocol inspector. The hackathon FAQ permits this route without preview access. A starter would make that route concrete while leaving project-specific compatibility and booking logic to the entrant. This request does not claim an attempted preview-access failure.

## 4. Per-run approval and fail-fast checks for `kirocrew run`

**Priority: Important**

**Request:** Let `kirocrew run` take the same scoped, per-run tool approval that the dashboard's Task Runner offers, run in the current git repository by default, and stop before planning when no write tool can be approved. Mark a run as not completed when its steps change none of the requested files.

**Why it matters:** BorrowMesh's check-in function was built by a Kiro Crew run only after we moved from the CLI to the dashboard. Two CLI runs changed no code but used 24.79 of 50 free monthly credits, and one reported success. Earlier failure and a diff-based completion check would protect both credits and trust in the result.

## Friction log

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
- **Actual:** Self-review raised `ValueError: BoundedSemaphore released too many times`, and later "Self-review could not verify the step: the review itself failed". Two steps hit "Bedrock is throttling requests" and were retried. These appeared only in the log.
- **Severity:** Low.
- **Workaround:** Reviewed the diff and ran the tests ourselves.
- **Suggestion:** Show unverified steps and throttling retries, with their credit use, in the run summary.
