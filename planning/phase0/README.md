# Phase 0 proof package

This package defines the controlled MVP and gives implementation agents exact interfaces, fixtures, proof procedures, and acceptance checks. Consult the final [readiness audit](evidence/readiness.md) for actual status; the existence of these files does not itself mean PASS.

- [Accounting](ACCOUNTING.md): D01–D04 and D11, exact units/math/safety and quote semantics.
- [Integrations](INTEGRATIONS.md): D05–D07 and D13, pinned primary sources and qualification.
- [Data](DATA.md): D08, shared Graph query, schema and bounded mapping.
- [Operations](OPERATIONS.md): D09–D10, ownership, permission matrix and failure scenarios.
- [Proof procedures](PROOFS.md): D12, environments, commands to implement and F1–F4 assertions.
- [Traceability](TRACEABILITY.md): requirements, tests, commands, evidence and handoff.

Existing Phase 0 validation command: `python3 scripts/planning/validate_phase0.py`. Phase 1 strategy and simulated E2E commands are now implemented; see [Phase 1 handoff](../phase1/README.md). Later phase commands remain planned and must not be reported as executed.

D14 decision: this tracked `planning/` package is the canonical shared technical specification. Existing ignored `docs/` and AGENTS.md remain local orchestration notes. Shareable requirements and proof commands must not depend on those ignored files. This avoids changing the local-doc publication policy while giving fresh clones the implementation contract and verification fixtures.
