# BorrowMesh

## Inspiration

A tool reservation is useful only if the whole working set is available. A drill without matching power or bits, or tools without a bench, cannot complete the intended project. BorrowMesh makes the **complete working set the unit of borrowing**: plan, hold, book, repair, and cancel the set together.

The fictional scenario is specific. Priya wants to build a planter box on Saturday, October 24, 2026, between 13:00 and 17:00 at Maple Lane Tool Library. She needs a wood saw, a drill with 3 mm and 6 mm bits, two clamps, safety glasses, and a workshop bench. Her preferred platform A cordless drill is on loan until Sunday. Finding another drill alone does not solve the problem; its accessories and bench time must work together.

## What it does

BorrowMesh is a **simulated Alexa+-style experience, not affiliated with Amazon, with fictional data**. Its web workbench pairs conversation and suggested requests with item tiles, complete-kit cards, and a bench timeline. The browser makes real calls to the local server. Requests can be typed, picked from suggestions, or spoken where the browser supports speech recognition, and replies can be read aloud with the browser's speech synthesis.

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

For a community tool library, complete-kit planning could help borrowers avoid incomplete reservations and help staff coordinate accessories and workspace. Releasing a whole booking could make a usable set available to the next borrower. In the canonical scenario, the preferred cordless drill is out on loan; searching for a drill alone would not tell Priya that the corded alternative also needs an extension cord and an outlet bench, while BorrowMesh returns only kits that are complete for her time window. These are potential benefits; there are no measured savings or real-user results.

## Scope and limitations

All borrowers, inventory, and reservations are fictional. There is no real Alexa integration, authenticated consent, library connection, payment, notification, or AWS runtime service. No account, API key, or paid API is needed to run the demo. The router supports a small set of requests and two project templates. Scheduling uses fictional times; JSON storage supports one local server process. Physical check-in remains an unregistered throwing stub with todo tests.

## What's next

Implement physical check-in with missing-part and damage handling. Before a real-library pilot, add authenticated borrowers, production storage, and real inventory integration, then evaluate complete-kit planning with library staff and borrowers.
