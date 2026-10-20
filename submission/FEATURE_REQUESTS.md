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
