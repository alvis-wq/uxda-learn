# Content format

`npm run content:validate` checks everything below; `npm run content:sync` writes it to the DB.

## Tracks and audiences
Tracks: `strategist`, `designer`, `motion_designer`, `account_manager`, `assistant`
(labels and leaderboard groups live in `src/lib/tracks.ts`).

An **audience list** is either `all` (everyone, including tracks added later) or a list of
tracks: `audiences: [designer, motion_designer]`. `all` can't be mixed with tracks. The old
single `audience:` key is rejected — use `audiences`.

A learner sees a challenge when it is `published`, its category isn't archived, and **both**
the category's and the challenge's audiences include `all` or their track.

## content/categories.yaml
```yaml
categories:
  - slug: wireframing          # kebab-case, unique
    title: Wireframing & Flows
    audiences: [strategist]    # all | [track, ...]
    description: One sentence.
    sort_order: 10
```

## content/challenges/<slug>.md
Markdown file with YAML frontmatter. The body is the brief shown to the user.

```yaml
---
slug: same-brief-three-tools       # must match filename
title: Same brief, three tools
category: wireframing              # must exist in categories.yaml
audiences: [strategist]            # optional, defaults to the category's audiences;
                                   # may narrow the category's audiences, never widen them
required_for: [strategist]         # optional: all | [track, ...]; omitted = optional for everyone
due_at: 2026-11-01T17:00:00Z       # optional deadline (ISO 8601 with offset)
type: mixed                        # quiz | screenshot | figma | mixed | acknowledge
difficulty: 2                      # 1 easy, 2 medium, 3 hard (not used by acknowledge)
points: 30                         # MUST equal sum of question points + rubric points
estimated_minutes: 90
status: draft                      # draft | published | archived
questions:                         # optional
  - id: q1
    kind: single                   # single | multi (auto-graded) | text (AI-reviewed)
    prompt: Which tool is cheapest for early exploration?
    options: [{ id: a, label: Claude Code }, { id: b, label: Figma Make }]
    answer: b                      # single: id; multi: [ids]; text: omit
    points: 5
submission:                        # optional — omit for quiz-only
  screenshots: { min: 1, max: 6, label: What to capture }
  figma_url: { required: false, label: Link to the final frame (node URL) }
  reflection: { required: true, min_words: 80, prompt: What did each tool get wrong? }
rubric:                            # required if anything needs review
  - id: tool-fit
    criterion: Explains what each tool is good and bad at, with examples
    points: 10
    levels:
      full: Specific strengths and weaknesses per tool, tied to their screens
      partial: Generic or only some tools covered
      none: Missing or unrelated
grader_notes: |                    # PRIVATE — evaluator only, never shown to users
  Common mistakes to watch for...
---
## Brief
...
```

## Required vs optional
- `required_for` uses the same shape as audiences. Everything not listed is optional.
- `required_for: all` means **every** track, so the challenge (and its category) must be visible
  to everyone. Validation fails if any track it's required for can't see it.
- Combine with `due_at` for a deadline. Learners see a "Required" badge, required challenges
  are listed first, and home shows "X of Y required done" plus overdue ones.
- Progress states (learner home + admin "Required progress"):
  - **done** — a published attempt, or acknowledged
  - **pending** — the latest attempt is awaiting review
  - **missing** — not started, or resubmission requested (the learner has to act)
  - **overdue** — missing and `due_at` has passed
- Changing `required_for` (like `status`) does not bump the challenge `version`.

## Acknowledge challenges (`type: acknowledge`)
For "read the new safety rules" style content: the brief plus an "I've read and understood"
button. Confirming completes it immediately and records who confirmed, when, and which
version. Worth 0 points and never on the leaderboard. Admins see who hasn't confirmed under
Admin → Acknowledgements.

```yaml
---
slug: safety-rules-2026
title: New safety rules
category: organization-policies
type: acknowledge
required_for: all                 # optional
due_at: 2026-11-01T17:00:00Z      # optional
estimated_minutes: 5              # optional
status: draft
---
## What changed
...
```
Rules: no `questions`, `submission`, `rubric` or `grader_notes`; `points` may be omitted or `0`;
`difficulty` is not needed. The brief must not be empty.

## Points guideline
| Difficulty | Points |
|---|---|
| 1 easy | 10 |
| 2 medium | 20–30 |
| 3 hard | 40–60 |
| acknowledge | 0 |
