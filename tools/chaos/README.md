# tools/chaos - k6 + Playwright chaos workspace

Scope (later story, SC-6 / VAL-9): load generation (k6 0.50.x), network fault
injection (toxiproxy), container-level chaos (Pumba), and headless citation
sampling against the rendered output path.

**Story 1.1:** shim only - no chaos logic, no `pyproject.toml`. k6 scripts,
Playwright samplers, and Docker Compose fault profiles land in a later story.

NOT a pnpm workspace member (STR-12). k6 is a Go binary invoked directly via
Homebrew / `go install`, not `pnpm add`.
