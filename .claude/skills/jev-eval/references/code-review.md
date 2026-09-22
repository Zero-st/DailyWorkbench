# Review a diff and its completion evidence

Use this mode through `jev-eval`. Adapt [the request template](../assets/code-review.json)
to the actual evidence and criteria, then follow the parent skill's setup and runtime instructions.

## Workflow

1. Collect the actual diff, relevant source and tests, acceptance criteria and real command receipts. Mark unavailable evidence as missing.
2. Separate concerns such as correctness, compatibility and test coverage. Select concrete hunks before attaching severity to a finding.
3. Use test receipts to check completion claims; a passing altered test is not evidence for the original behavior.
4. Return each lead with its hunk/source ID, concern, uncertainty and a concrete verification step. A Jev label alone is not proof of a defect.
5. Keep compilers, static analysis and original tests. Do not merge, publish, change review protections or edit tests merely because the judgment suggests approval.

## Context and parallelism

Jev does not inherit the agent's history. Give every request sufficient context:
requirements, the actual diff, surrounding source and relevant callers, invariants,
tests and their receipts. A hunk alone may hide the reason for a change; preserve
cross-file dependencies. Mark missing evidence and omit unrelated files and secrets.

Batch independent review criteria over the same diff instead of serial LLM calls.
Use bounded concurrency for independent change groups, with hunk/question IDs,
rate limits and a cost/time budget; include shared dependencies in each request.
The host schedules calls; the CLI has no parallel scheduler. Questions cannot read
other answers in the same request: a finding-dependent verification needs a later
call with its receipt. Jev's low latency helps broad screening, not patch generation
or replacing tests and deeper review.

## Make it yours

Replace the example's evidence, candidate IDs and criteria together. Preserve a
no-match route when the real task can fall outside the labels. Agree on how the
host or person consumes each answer before enabling any automatic effect.

## Precedent

[Related project or author example](https://github.com/devagrawal09/jev-review). Our workflow is an adaptation,
not that project's code, an automatic installer, or a reproduced benchmark.
[OpenRouter request contract](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request).
