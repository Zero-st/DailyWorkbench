---
name: jev
description: Design Jev questions from a task or an existing prompt. Set up a provider, batch independent decisions, and handle custom judgments, agent checkpoints, tool routing or context checks. Read only the guide needed for this task.
license: MIT
metadata:
  requirements: Jev API mode needs Python 3.10+, network access and either OPENROUTER_API_KEY or TYPESAFE_API_KEY for the selected provider. API calls incur charges. No MCP server required. User-approved host-agent simulation needs no Jev API key or CLI.
---

# Design a small decision

Jev chooses, classifies and scores. The host collects evidence, writes code and
checks outcomes. Use code for exact rules; keep text generation with a generative
model. Choose one task below, not the whole reference library.

| Task | Read | Start with |
|---|---|---|
| Convert a prompt or plain requirement | [Prompt to Jev](references/prompt-to-jev.md) | [Request](assets/prompt-to-jev.json) |
| Set up or update | [Setup](references/setup.md) | No paid call needed |
| Check a long task | [Checkpoints](references/checkpoints.md) | [Checkpoint](assets/checkpoint.json) |
| Choose a tool or model | [Routing](references/routing.md) | [Request](assets/routing.json) |
| Review what context to keep | [Context](references/context.md) | [Request](assets/context.json) |
| Batch independent questions | [Batching](references/context-and-throughput.md) | [Two records](assets/batch-triage.json) |
| Define new labels or a rubric | [Question design](references/question-design.md) | [Rubric](assets/rubric.json) |

## Use safely

Choose the service once and keep that choice. If unset, ask **A: real Jev** via
OpenRouter (`OPENROUTER_API_KEY`) or TypeSafe (`TYPESAFE_API_KEY`), or **B: simulation**
with this agent or an explicitly chosen available model such as DeepSeek. Wait for
consent; errors do not authorize switching. Check key presence only, never values.
Real calls send evidence and cost money; get approval before sending private data.

For B, skip CLI/API calls. Mark `agent_simulation` or `model_simulation`, identify
the actual model when available, set `jev_called: false`, `probability: null` and
`confidence: null`. Return a value, evidence-based reason and `needs_review`; use
null/review when evidence is missing. Do not invent Jev output or probabilities.
Choice uses supplied labels, Noul uses booleans, Score uses integer rubric indices.

For A, use the existing `jev-decide` CLI with the chosen `--provider openrouter`
or `--provider typesafe`. If absent, explain the dependency; do not silently install.
`--dry-run` is offline validation, not a judgment. Exit 0 means selected/scored,
2 means review, 1 means error. Read each value: false Noul remains false. Selection
is not permission, and confidence is not accuracy. Keep unknown/review paths.

## Ask only what is needed

Jev does not inherit the host's context. Include the goal, criteria, original
evidence and valid candidates for this judgment; separate trusted rules from
untrusted content. Keep enough evidence, not unrelated conversation history.
One question does one thing. Put independent questions in the same request;
questions cannot read each other's answers. Wait for new evidence for dependent
steps. Use bounded concurrency only across independent requests: the host owns
IDs, budgets and scheduling; this CLI has no parallel scheduler.

## Run

Resolve `<skill-dir>` to this installed folder. The bundled Python 3.10+ script
or the installed `jev-decide` CLI uses the same request contract:

```bash
python3 <skill-dir>/scripts/jev.py decide <skill-dir>/assets/prompt-to-jev.json --dry-run
# After approval, use the selected provider:
python3 <skill-dir>/scripts/jev.py decide request.json --provider openrouter
```

Missing evidence or ambiguity means review, not another call until it agrees.
For repeated failures read [pitfalls](references/pitfalls.md). Before scaling a
large job, agree on a small pilot; [pilot guidance](https://github.com/wuyoscar/jev-skill/blob/main/skills/jev-triage/references/smoke-test.md)
is optional task guidance, not a required second skill call.

Use a focused skill only when the task calls for it: `jev-triage` for records,
`jev-documents` for evidence, `jev-eval` for output checks, `jev-act` for actions.
They are independent entry points, not an automatic chain. If absent, do not
install them silently. More sources live in the optional [reference index](references/index.md).

## Examples

[Goal-drift checkpoint](https://github.com/wuyoscar/jev-skill#sc-a01) · [Stuck-loop recovery](https://github.com/wuyoscar/jev-skill#sc-a02) · [Postmortem failure attribution](https://github.com/wuyoscar/jev-skill#sc-a27)

[More tasks and local templates](references/scenarios.md). Open only the matching row;
there is no need to read the full README before a judgment.
