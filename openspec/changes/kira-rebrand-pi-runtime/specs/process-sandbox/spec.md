> **Deferred** — Agent execution is local (runs on the developer's machine) for this change. Process sandboxing is not required when each user runs their own Kira instance. This spec will be written when Kira moves to server-side multi-tenant agent execution in a future change.
>
> At that point, requirements will cover: Linux user+mount namespace isolation, cgroup v2 resource limits (CPU, memory), network namespace with LLM API egress allowlist, and wall-clock execution timeouts.
