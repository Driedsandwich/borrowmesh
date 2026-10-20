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
- **Improve:** A recording example that exposes encoded-frame timing for narration alignment would fit this workflow. The timing-check issue described in the project story belonged to our own video builder, not Playwright.
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
