# BorrowMesh

BorrowMesh reserves a complete, compatible working set from a fictional neighborhood tool library: the tools, their supporting parts, and a workshop bench slot in one booking.

Borrowing one tool is easy. Borrowing a set that works together is harder. A missing battery or an unavailable bench can make an otherwise useful reservation fail. BorrowMesh treats the whole project as the unit of planning, holding, booking, repair, and cancellation. The demo supports planter-box and shelf-repair requests, then coordinates all resources for the selected project. Any money or waste savings are potential benefits, not measured outcomes.

The project includes a self-hosted Model Context Protocol (MCP) server and a **simulated Alexa+-style web experience, not affiliated with Amazon**. The browser is a real MCP client, not a mock tool-call display. There is no real Alexa integration, Amazon account connection, or cloud dependency. All library data is fictional.

## Run locally

Use **Node.js 22.12 or later within the Node 22 series**, with npm.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5174**. The MCP endpoint is **http://127.0.0.1:3002/mcp**. Both bind to `127.0.0.1`. No account, API key, paid API, or device is needed. **Ports 3002 and 5174 must be free**; the web server fails instead of silently changing its port.

```sh
npm run build       # TypeScript checks and Vite production bundle
npm test            # Domain, intent-router, client, and real-HTTP integration tests
npm run demo:reset  # Restore the fictional canonical scenario
```

`npm run dev:server` and `npm run dev:web` start the two services separately. `npm start` starts only the MCP server; `npm run preview` serves the built browser app on port 4174 after `npm run build`.

The default state file is `data/library.json`, excluded from source control. Writes use a temporary file and atomic rename. Restarting the server loads that saved state. `DATA_FILE` can select another state file **inside this project**. `PORT` changes the server port, but the browser demo and recording tools use the default port 3002.

## How it works

1. Read the project requirements and compare complete bundles. Search checks compatible power sources, bit sizes, item availability, bench availability, and return deadlines. Ranking prefers fewer substitutions, then an earlier feasible bench, then a shorter loan.
2. Select a bundle to hold all its items and its bench together. A hold expires after ten minutes of **simulated time**. The fictional clock ticks with elapsed real time only while the server runs and resumes from the saved simulated time after a restart. Tests can also advance it deterministically. It does not represent a live library clock.
3. Commit the selected hold. If a substitute changes the requested setup, the MCP server requests form consent. Declining or cancelling books nothing. After acceptance the server revalidates all resources and saves the booking once, or books nothing and explains the conflict.
4. Retrieve the saved booking after reconnecting. If an item breaks or runs late, re-plan only that affected item and retain the other resources.
5. Cancel to release every item and the bench together. The server attempts to serve compatible waitlisted borrowers and reports the result.

The fictional waitlisted borrower Jonas joined the waitlist accepting compatible substitutions, so releasing a booking can book a complete kit for him without a new dialog.

The workbench places conversation and suggested utterances on the left, with item tiles and a bench timeline on the right. Bundle cards compare complete options horizontally. Browser speech synthesis can read English responses; text input and chips remain available. Microphone input uses `SpeechRecognition` only when the browser supports it. The separate deterministic intent router has no language-model dependency.

The collapsible Protocol inspector displays the actual JSON-RPC requests and responses, including initialization, tool discovery, tool calls, and consent elicitation. The SDK negotiates MCP protocol version **2025-11-25** with the bundled browser client. Compatibility behavior for older client versions is tested separately.

## Canonical demo

The fictional Maple Lane Tool Library has three fictional borrowers. Priya wants a planter box on **Saturday, October 24, 2026, 13:00–17:00**. The preferred platform A drill is already on loan until Sunday. A complete kit needs a saw, a drill with 3 mm and 6 mm bits, two clamps, safety glasses, and a bench slot.

Use the following sequence, with browser speech optionally enabled:

1. Select **Reset demo**.
2. Ask **“What do I need to build a planter box on Saturday afternoon?”**
3. Ask **“Find me a kit”** and compare the complete cards, substitutions, bench times, and return deadlines.
4. Choose the first, corded kit. Its items become held. Select **Book the complete kit** to commit the hold.
5. Read the consent dialog about the corded drill and outlet bench, then accept. The complete kit becomes booked. Decline or cancel instead to demonstrate that nothing is booked.
6. Reload the browser and ask **“What did I book?”** The persisted booking is retrieved from the server.
7. Ask **“The clamps are broken”**. Only the clamp item changes; the other items and bench stay booked.
8. Ask **“Cancel my booking”**. The whole booking is released and the waitlist result identifies Jonas.
9. Open **Protocol inspector** to inspect the negotiated version and raw MCP exchanges.

The simulated date is fixed for repeatable demos. Calendar times are fictional schedule values, not a time-zone-aware reservation service. Tests also exercise a resource being taken between hold and commit: the failed commit must book nothing.

## MCP surface

The TypeScript server uses the official `@modelcontextprotocol/sdk` **1.32.1** at runtime. Its Streamable HTTP transport supports `POST`, `GET`, and `DELETE /mcp`, with `Mcp-Session-Id` sessions. It validates browser origins against the local demo origins. The Vite browser bundle uses SDK `Client` and `StreamableHTTPClientTransport` at runtime.

Every successful tool response includes human-readable text and `structuredContent` for client rendering. Tool argument names are shown below.

| Tool | Arguments | Purpose |
| --- | --- | --- |
| `get_library_state` | none | Read fictional catalog, templates, availability, holds, bookings, and waitlist. |
| `find_compatible_kit` | `project`, `date`, `start`, `end` | Find up to three complete bundles; date is `YYYY-MM-DD`, times are `HH:mm` on a 30-minute grid. |
| `hold_resources` | `bundleId` | Hold every resource in a selected bundle together. |
| `commit_bundle` | `holdId` | Request consent when needed, then book all resources or nothing. |
| `release_bundle` | `bookingId` | Cancel and release the full booking; report waitlist service. |
| `report_issue` | `bookingId`, `itemId`, `kind` | Replace an affected item; `kind` is `broken` or `late`. |
| `get_booking` | `bookingId` | Retrieve an ID or `"mine"` for the fictional Priya. |
| `reset_demo` | none | Restore the canonical fictional scenario. |

Resources: `borrowmesh://catalog` exposes the catalog and `borrowmesh://bookings` exposes bookings, both as JSON. The `plan-weekend-project` prompt guides an assistant through complete-kit planning and consent.

The optional Agent Skill [`skills/tool-library-kits/SKILL.md`](skills/tool-library-kits/SKILL.md) gives an assistant a safe workflow for these tools. It is a local instruction artifact; no third-party assistant installation or integration is claimed.

**Check-in in the domain layer: `check_in_bundle`.** Returning a booking, flagging missing or damaged parts, freeing a bench early, and serving the waitlist are implemented in `src/domain/library.ts` with tests. This function was built during the hackathon by a Kiro Crew task-runner run from a written spec, then reviewed and corrected (see the commit history). It is not yet registered as an MCP tool or shown in the workbench, so the demo video does not include it. In the UI, cancellation with `release_bundle` is the way to give a set back; it is not a physical return or inventory inspection.

## Use it from an existing AI assistant

These are generic connection steps, not a claim of a tested third-party integration:

1. Start BorrowMesh locally using `npm run dev:server`.
2. In an assistant that supports local MCP servers over **Streamable HTTP**, configure the endpoint `http://127.0.0.1:3002/mcp`. Do not select the legacy HTTP+SSE transport or stdio.
3. Let the client initialize, retain the returned `Mcp-Session-Id`, and list tools. A client supporting MCP 2025-11-25 and form elicitation can complete the substitution flow.
4. Read the library state, search for a complete kit, compare options, hold only the chosen bundle, and commit its hold. Consent must come from the borrower. A client without form elicitation cannot commit a substitution that needs consent.

A remote or cloud assistant generally cannot reach your machine's loopback address. Public hosting, authentication, network exposure, and production deployment are outside this implementation. Do not expose this unauthenticated fictional demo as a real library service.

## Prepare a demo video

The completed demo is **157.2 seconds**, recorded from real browser interactions at **1280×800** and encoded as **H.264/AAC** in `video/demo.mp4`. Watch: [Demo video](https://www.youtube.com/watch?v=MEncWbqHXRM).

The verified browser walkthrough completed requirements, three kit cards, hold, consent, booking, reload, clamp replacement, cancellation with waitlist service, and protocol inspection, with zero browser console errors. A separate fresh-copy installation passed the build, 92 tests, and demo reset. The following commands check recording preparation; they do not repeat that browser verification:

```sh
npm run video:check
npm run video:synth -- --check
npm run video:build -- --check
```

These validate the English storyboard without launching Chromium, invoking Kokoro, or requiring generated media. The narration planning estimate targets **140–165 seconds**, allowing 15 seconds for interaction; the measured completed video is **157.2 seconds**. The check prints separate narrator and assistant word counts and requires short assistant replies for the seven spoken response segments.

To reproduce the recording on macOS, first stop any running BorrowMesh development services. **Ports 3002 and 5174 must be free** because the recorder starts its own services:

```sh
# Install ffmpeg/ffprobe and the Kokoro speech files beforehand (see below).
# Install the Playwright Chromium build into this project:
PLAYWRIGHT_BROWSERS_PATH=./data/browser-cache npx playwright install chromium
npm run video:synth
npm run video:record
npm run video:build -- --validate
npm run video:build
```

Speech is synthesized locally with [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0 model weights) through [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT). macOS system voices are not used because their license limits them to personal, non-commercial use. Install `kokoro-onnx` and `soundfile` into a Python environment (kokoro-onnx brings its own phonemizer dependencies, which are used only while synthesizing and are not part of this repository). Download `kokoro-v1.0.fp16.onnx` and `voices-v1.0.bin` (about 205 MB together) from the kokoro-onnx `model-files-v1.0` release into `data/tts/`, or point `KOKORO_MODEL` and `KOKORO_VOICES` at them; `KOKORO_PYTHON` selects the Python interpreter. The narrator defaults to `am_michael` and the assistant to `af_heart` (`KOKORO_NARRATOR_VOICE`, `KOKORO_ASSISTANT_VOICE`) at speed 1.1 (`KOKORO_SPEED`). Missing model files fail with setup guidance. The synthesizer measures duration and normalizes local clips. It writes `video/audio/timeline.json` only after successful synthesis.

The recorder starts its own server on 3002, Vite on 5174, and isolated fictional state inside `video/raw/`; busy ports fail. It drives the real UI through requirements, comparison, hold, consent, booking, reload, clamp repair, release, and Protocol inspector at 1280×800. It records encoded timing markers to align narration to actual screen states. Browser speech stays off to prevent duplicate audio. Recording verifies a browser reload; separate integration tests cover a server process restart.

The builder checks matching media manifests, timing, dimensions, and codecs. It adds original title/end cards and produces `video/demo.mp4` using H.264/AAC. It rejects a predicted final duration outside the 140–165 second target or a measured output reaching **180 seconds**. Reproducing the video requires the full synthesis, recording, and assembly sequence above.

## Alexa+ track scope

The supplied hackathon guidance asks for a self-hosted MCP server using spec 2025-11-25 or later over Streamable HTTP, or an Agent Skill, and permits a simulated Alexa+ experience. BorrowMesh implements that MCP path and includes a simulation that actually calls the server. It includes source, local setup instructions, and an MIT license. Repository: [BorrowMesh on GitHub](https://github.com/Driedsandwich/borrowmesh). No hosting, submission, eligibility approval, or judging result is claimed.

BorrowMesh is a new project built on October 20, 2026 (JST), during the submission period, by a solo entrant using AI coding agents. One agent implemented written specifications; a second reviewed the code, exercised the browser, recorded the video, and verified the results.

## Limits and feedback

- All borrowers, inventory, availability, and reservations are fictional. There are no real loans, payments, notifications, or library connections.
- The assistant is simulated, the intent router is deterministic, and the supported projects are deliberately small. There is no general natural-language understanding or language model.
- Consent represents the demo borrower; it is not authenticated identity or a real-world authorization system.
- JSON persistence supports this local demo, not multiple independent server processes or a production database.
- Voice and microphone availability depend on the browser and local operating system. Text and chips always remain available.
- `check_in_bundle` exists in the domain layer only; it is not an MCP tool yet. No public hosting, real Alexa device integration, account setup, or publishing is included.

[`FRICTION_LOG.md`](FRICTION_LOG.md) records only issues actually observed with the tools and guidance this project depends on; all of its entries concern Kiro Crew. It does not manufacture feedback or treat unrun paths as successful.

## License

MIT. Copyright (c) 2026 Driedsandwich. See [`LICENSE`](LICENSE).
