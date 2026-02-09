# Security Notes (MVP)

## Assumptions

- Verifier is trusted to assess work quality for MVP.
- Requester/Worker/Verifier keys are controlled by each participant.
- XMTP messages are coordination signals; contract state is source of truth.

## Threat Model

### In Scope

- Reentrancy on payout/refund paths.
- ERC20 transfer edge cases (non-standard return values).
- Double accept, submit, and release attempts.
- Deadline misuse and timeout reclaim logic.

### Out of Scope (MVP)

- Cryptographic fraud-proof disputes.
- Sybil-resistant identity/reputation systems.
- Privacy-preserving encrypted on-chain metadata.

## Controls Implemented

- `nonReentrant` guard on payment/refund methods.
- Checks-effects-interactions ordering.
- Explicit state machine transitions.
- Safe token transfer wrappers with return-data checks.
- Deadline must be future at creation.
- Timeout reclaim requires `deadline + gracePeriod`.

## Operational Guidance

- Prefer hardware wallets for production keys.
- Use restricted RPC credentials.
- Pin dependency versions and monitor advisories.
- Keep verifier fee bounded (`<= 10000` bps).
