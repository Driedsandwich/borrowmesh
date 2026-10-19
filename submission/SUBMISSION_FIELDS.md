# Submission fields

| Devpost field | Value |
| --- | --- |
| Project name | BorrowMesh |
| Tagline | Borrow a complete, compatible tool kit and workshop bench in one booking. |
| Primary track | Alexa+ |
| Mini challenges | TODO_AWS_BUILDER |
| Built with | TypeScript; Node.js; npm; MCP TypeScript SDK 1.32.1; MCP specification 2025-11-25; Streamable HTTP; Express; Zod; Vite; Vitest; happy-dom; Playwright; Chromium; tsx; concurrently; ffmpeg; ffprobe; macOS speech synthesis; HTML; CSS |
| Try it out | https://github.com/Driedsandwich/borrowmesh |
| Video demo link | TODO_VIDEO_URL |
| Team / development disclosure | Solo entrant; built during the submission period with AI coding agents. One agent implemented written specifications; a second reviewed the code, ran the browser walkthrough, recorded the video, and verified results. |
| Existing-project explanation | New project, built on October 20, 2026 (JST), during the hackathon submission period. |

## Project story

# BorrowMesh

## Inspiration

A tool reservation is useful only if the whole working set is available. A drill without matching power or bits, or tools without a bench, cannot complete the intended project. BorrowMesh makes the **complete working set the unit of borrowing**: plan, hold, book, repair, and cancel the set together.

The fictional scenario is specific. Priya wants to build a planter box on Saturday, October 24, 2026, between 13:00 and 17:00 at Maple Lane Tool Library. She needs a wood saw, a drill with 3 mm and 6 mm bits, two clamps, safety glasses, and a workshop bench. Her preferred platform A cordless drill is on loan until Sunday. Finding another drill alone does not solve the problem; its accessories and bench time must work together.

## What it does

BorrowMesh is a **simulated Alexa+-style experience, not affiliated with Amazon, with fictional data**. Its web workbench pairs conversation and suggested requests with item tiles, complete-kit cards, and a bench timeline. The browser makes real calls to the local server.

Priya can compare three complete options: “Plug-in kit · standard clamps,” “Battery kit · platform B · standard clamps,” and “Plug-in kit · wide-jaw clamps.” Cards explain substitutions, bench times, and return deadlines. Choosing the plug-in kit holds its tools, extension cord, and bench together. After explicit consent to the changed setup, the booking includes seven catalog items, including a two-clamp pair, and the 14:00–16:30 bench slot.

Reloading retrieves the saved booking. “The clamps are broken” replaces only the clamp item and preserves the other reservations. “Cancel my booking” releases the entire set and bench; in the canonical scenario, Jonas on the fictional waitlist receives a complete booking.

## How we built it

The TypeScript application uses the Model Context Protocol (MCP), a standard for connecting clients to tools and data. The MCP TypeScript SDK 1.32.1 supplies the server and browser client over Streamable HTTP, negotiating protocol 2025-11-25. Eight tools cover state, search, holds, commit, release, issue reporting, booking retrieval, and reset. JSON resources expose the catalog and bookings. The `plan-weekend-project` prompt describes the planning workflow.

Search deterministically checks drill and battery compatibility, required bits, availability, bench slots, and return deadlines. It ranks feasible bundles by fewer substitutions, earlier bench time, and shorter loan duration, returning up to three options.

Holds expire after ten simulated minutes. MCP form elicitation requests explicit consent when a setup change requires it. After consent, the server revalidates every resource. Mutations run serially within one server process; atomic commit saves the whole booking or books nothing. A conflict cancels the hold and returns fresh alternatives. Declining consent releases the hold. Full cancellation uses `release_bundle` to roll back the reservation by releasing all booked resources together.

JSON persistence writes a temporary file and renames it atomically. The deterministic intent router maps supported requests to actions without a language model. The Protocol inspector shows actual JSON-RPC messages, including initialization, tool discovery, calls, and elicitation. Vite builds the browser app; Vitest covers domain behavior, client flow, HTTP integration, and process restart. Playwright records the working browser flow; local speech synthesis and ffmpeg produce the video.

## Challenges we ran into

Consent creates a gap between checking availability and committing. The implementation rechecks after the response; tests cover a resource becoming unavailable during a hold and a reset while consent is pending.

During video assembly, our timing check rejected a segment by 51 ms. Encoded-frame measurements had 40 ms resolution. Allowing two frames of measurement error corrected the check; the next audio segment started 360 ms later, so audio did not overlap.

## Accomplishments that we're proud of

The real-browser walkthrough completed search, hold, consent, booking, reload, clamp replacement, cancellation, and waitlist service with zero browser console errors. A fresh-copy installation passed the build and tests: 73 passed, with three check-in cases left as todo. The recorded demonstration is 147.0 seconds long.

## What we learned

This implementation demonstrates why complete-kit availability must be checked again at commit, even after a hold and a consent dialog. It also shows the value of keeping compatibility rules in the domain logic and exposing actual protocol traffic for inspection.

## Potential impact

For a community tool library, complete-kit planning could help borrowers avoid incomplete reservations and help staff coordinate accessories and workspace. Releasing a whole booking could make a usable set available to the next borrower. These are potential benefits; there are no measured savings or real-user results.

## Scope and limitations

All borrowers, inventory, and reservations are fictional. There is no real Alexa integration, authenticated consent, library connection, payment, notification, or AWS runtime service. No account, API key, or paid API is needed to run the demo. The router supports a small set of requests and two project templates. Scheduling uses fictional times; JSON storage supports one local server process. Physical check-in remains an unregistered throwing stub with todo tests.

## What's next

Implement physical check-in with missing-part and damage handling. Before a real-library pilot, add authenticated borrowers, production storage, and real inventory integration, then evaluate complete-kit planning with library staff and borrowers.

## Product feedback

# Product feedback

The observations below concern this local, fictional BorrowMesh demo. Proposed improvements are requests, not claims that a tool failed. No AWS service is called at runtime.

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
- **Worked well:** The verified fresh-copy run passed 73 tests, with three planned check-in tests marked todo. The client tests explicitly use deterministic responses rather than a real browser.
- **Improve:** Keep examples clear about which checks need a real browser. BorrowMesh uses Playwright separately; no runner or document-emulation defect was recorded.
- **Onboarding:** `npm test` runs the configured suite after dependency installation. The three todo cases represent unfinished project work.
- **Use again:** Yes, alongside real-browser checks rather than treating document emulation as browser verification.

## Playwright and Chromium

- **Use:** Driving and recording the full browser flow at 1280×800, including reload, consent, clamp replacement, release, and protocol inspection.
- **Worked well:** The verified walkthrough used Playwright 1.64.1 and Chromium build 1248, completed the flow, and recorded zero browser console errors.
- **Improve:** A recording example that exposes encoded-frame timing for narration alignment would fit this workflow. The timing-check issue described in the friction log belonged to our builder, not Playwright.
- **Onboarding:** Chromium needs a separate installation. The recording instructions specify `PLAYWRIGHT_BROWSERS_PATH=./data/browser-cache npx playwright install chromium`; ports 3002 and 5174 must be free.
- **Use again:** Yes, for repeatable UI checks and a demonstration recorded from actual interactions.

## ffmpeg and ffprobe

- **Use:** Measuring media, normalizing speech clips, assembling original title and closing cards, and encoding H.264/AAC output.
- **Worked well:** The finished video is 147.0 seconds at 1280×800. The verified audio measurements are mean −18.1 dB and peak −2.0 dB.
- **Improve:** Our builder's timing tolerance needed to account for encoded-frame resolution. No ffmpeg or ffprobe failure was recorded.
- **Onboarding:** Both executables must be installed before media generation. The scripts check their availability and validate media manifests and output.
- **Use again:** Yes, for local, scripted video assembly and measurement.

## macOS speech synthesis

- **Use:** Generating narration with Tom (Enhanced) and assistant responses with Ava (Premium), across 18 clips in 11 segments.
- **Worked well:** The completed video contains both locally synthesized voices. The scripts measure clip duration and normalize the audio.
- **Improve:** A portable voice setup would make reproduction on other operating systems easier. That is a limitation of our current workflow, not an observed speech-engine error.
- **Onboarding:** Suitable voices must be installed. The scripts check voices, provide setup guidance, and define Samantha as an assistant fallback; this does not claim that fallback was used.
- **Use again:** Yes, for a local macOS demonstration with measured clips.

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

TODO_KIRO_FEEDBACK

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

## Friction log

# BorrowMesh friction log

This log is for friction with the tools and guidance this project depends on (the MCP TypeScript SDK and specification, the hackathon's Alexa+ track material, and the AWS development tools used during the hackathon). Each entry records the task, steps, expected and actual results, severity, workaround, and an actionable suggestion.

No such friction has been observed while building BorrowMesh so far. Problems in this project's own code or video tooling are described in the project story instead, not here.
