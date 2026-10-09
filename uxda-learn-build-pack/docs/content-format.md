# Content format

## content/categories.yaml
```yaml
categories:
  - slug: wireframing          # kebab-case, unique
    title: Wireframing & Flows
    audience: strategist       # all | strategist | designer
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
audience: strategist               # optional, defaults to the category's audience
type: mixed                        # quiz | screenshot | figma | mixed
difficulty: 2                      # 1 easy, 2 medium, 3 hard
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

## Points guideline
| Difficulty | Points |
|---|---|
| 1 easy | 10 |
| 2 medium | 20–30 |
| 3 hard | 40–60 |
