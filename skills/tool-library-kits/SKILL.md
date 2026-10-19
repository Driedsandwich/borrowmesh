---
name: tool-library-kits
description: Assemble complete compatible project kits through BorrowMesh MCP tools, including temporary holds, explicit substitution consent, atomic booking, affected-item repair, and whole-booking cancellation. Use for the fictional BorrowMesh tool-library demo, not real inventory or physical returns.
---

# Tool library kits

Help the borrower reserve a complete working set, including supporting parts and a workshop bench. BorrowMesh is a local fictional demonstration. Do not describe its reservations as real loans or claim an Alexa account or device connection.

## Connect and establish the request

Use an MCP client with Streamable HTTP and form elicitation support. The default endpoint is `http://127.0.0.1:3002/mcp`; let the SDK initialize, negotiate the protocol version, and manage the session. Confirm the server exposes the expected tools before calling them.

Call `get_library_state` to read the current catalog, templates, compatibility attributes, availability, and bookings. Establish the project, date, and requested time window. Do not invent inventory, availability, borrowers, consent, or successful results. The canonical fictional borrower is Priya; do not imply authenticated identity.

## Compare complete options

Call `find_compatible_kit` with `project`, `date`, `start`, and `end`. Use a project identifier from the returned templates, a date in `YYYY-MM-DD`, and times in `HH:mm` on the 30-minute grid. Supported templates currently include `planter-box` and `shelf-repair`.

Explain the complete returned bundles using their `structuredContent`: every required item, power source and supporting accessories, the bench slot, substitutions and reasons, and the return deadline. Keep the server's ranking and feasibility results authoritative. A plausible individual tool is not a complete kit. If no complete option fits, explain that nothing is reserved and ask for a changed project or time window.

## Hold the selected bundle

Only after the borrower selects an option, call `hold_resources` with its exact `bundleId`. Report the returned `holdId` and expiry. A temporary hold is not a booking. Holds expire after ten minutes of simulated time; do not advance the clock or silently extend a hold.

If the hold fails or expires, read fresh state or search again. Do not substitute an unrelated bundle ID or reuse an expired hold. Do not hold multiple alternatives merely to keep options open.

## Commit with the borrower's consent

Call `commit_bundle` with the selected `holdId`. When the server issues a form elicitation request, show its actual message and requested fields to the borrower. Only return acceptance when the borrower explicitly accepts the changed setup. Never generate consent on the borrower's behalf, infer it from choosing a kit, or turn decline/cancel into acceptance.

If the client cannot present form elicitation, explain that this option cannot be committed through that client. Do not bypass the consent requirement. A decline or cancellation books nothing and releases the hold.

Inspect the tool result. Report a booking only when the returned result confirms success and includes the booking. The server validates all resources after consent and commits every item and the bench together, or books nothing. If a resource has become unavailable, explain the conflict and offer the fresh alternatives returned by the server; obtain a new selection and hold before another commit.

If a request times out or the outcome is unclear, use `get_booking` before retrying. Do not claim failure or repeat a mutating call solely because the client did not receive a response.

## Retrieve, repair, or cancel

- Use `get_booking` with an exact `bookingId`, or `"mine"` for the fictional Priya, to retrieve persisted bookings. Reconnect and initialize again after a server restart; do not assume the old MCP session remains valid.
- For a reported broken or late item, retrieve the booking and identify the affected catalog item. Call `report_issue` with `bookingId`, `itemId`, and `kind` (`broken` or `late`). Describe the actual replacement and the unaffected resources kept. If no compatible single-item replacement exists, report that limit; do not claim that the kit is repaired or replace the entire booking without a new request.
- When the borrower asks to cancel, call `release_bundle` with the exact active `bookingId`. Confirm the whole-booking release and describe waitlist service only as returned by the server. An item released from Priya's booking may immediately be booked for a waitlisted borrower; do not describe it as unconditionally available to everyone.

`release_bundle` cancels a reservation. It does not record a physical return, inspect inventory, or flag missing parts. `check_in_bundle` is **planned**, not an available tool. Do not call it or pretend its reserved behavior exists.

## Preserve scope

Use `reset_demo` only when the user requests restoration of the fictional demo scenario. It discards demo holds, bookings, issues, and waitlist progress. Do not use it to recover from an ordinary planning failure.

These tools provide local fictional state, not permission to expose the server, publish information, send notifications, contact borrowers, create accounts, or call paid services. Keep credentials and unnecessary personal data out of tool arguments and records. Distinguish a suggested option, a held kit, a confirmed booking, and a cancelled booking in every report.
