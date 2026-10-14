# Content format

`npm run content:validate` checks everything below; `npm run content:sync` writes it to the DB.

## Who owns what
| Owned by the **content file** (synced every time) | Owned by the **admin panel** (Admin → Content) |
|---|---|
| title, summary, brief, type, category, audiences, difficulty, points, estimated time, questions + answers, submission, rubric, grader notes | `status`, `required_for`, `due_at` |

- The file's `status`, `required_for` and `due_at` are **starting values**: `content:sync` uses them
  only when it **creates** a challenge. After that it never writes them — change them in
  Admin → Content (saves instantly, every change is in the challenge's change history).
- If a file disagrees with the DB on one of them, `content:sync` prints it under "Settings managed
  in the admin panel" (file value ignored, DB wins). Editing those lines in the file does nothing.
- Content changes bump `version`; settings changes never do.
- A file removed from `/content` still archives its challenge (recorded in the change history as
  `content:sync`). Restoring the file doesn't un-archive it — publish it again in the admin panel.
- **Placeholders:** a challenge whose content still contains `TODO` or `TODO_SOMETHING` (e.g.
  `TODO_FIGMA_URL`) anywhere — brief, questions, submission, rubric or grader notes — can't be
  published: the admin panel refuses with the reason, and `content:validate` fails a file that says
  `status: published`. Keep such challenges `draft` until the placeholder is filled in.

## Tracks and audiences
Tracks: `strategist`, `designer`, `motion_designer`, `account_manager`, `assistant`, `management`
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
    image: wireframing.webp    # optional default card artwork for the category's challenges
```

`image` is a file name (no folders; lowercase `.png`, `.jpg`, `.webp` or `.avif`) that must exist in
`public/challenges/`. A challenge's own `image` wins; with neither, the card has no image. Images are
display-only: they are not part of the content hash, so changing one never bumps a challenge's `version`.

## content/challenges/<slug>.md
Markdown file with YAML frontmatter. The body is the brief shown to the user.

```yaml
---
slug: same-brief-three-tools       # must match filename
title: Same brief, three tools
category: wireframing              # must exist in categories.yaml
audiences: [strategist]            # optional, defaults to the category's audiences;
                                   # may narrow the category's audiences, never widen them
required_for: [strategist]         # initial value* — optional: all | [track, ...]; omitted = optional
due_at: 2026-11-01T17:00:00Z       # initial value* — optional deadline (ISO 8601 with offset)
type: mixed                        # quiz | screenshot | figma | mixed | acknowledge
difficulty: 2                      # 1 easy, 2 medium, 3 hard (not used by acknowledge)
points: 30                         # MUST equal sum of question points + rubric points
estimated_minutes: 90
image: three-tools.webp            # optional card artwork in public/challenges/ (overrides the category's)
tip: Start with the brief's last paragraph; it lists what is scored.   # optional hint above the questions (markdown, up to 1000 chars)
status: draft                      # initial value* — draft | published | archived
questions:                         # optional
  - id: q1
    kind: single                   # single | multi | order (auto-graded) | text (AI-reviewed)
    prompt: Which tool is cheapest for early exploration?
    options: [{ id: a, label: Claude Code }, { id: b, label: Figma Make }]
    answer: b                      # single: id; multi: [ids]; order / text: omit
    points: 5
  - id: q2
    kind: order                    # learners drag `items` into the right order
    prompt: Put the steps of a risk message in order.
    items:                         # list them in the CORRECT order — learners see them shuffled
      - { id: observe, label: Observation }
      - { id: consequence, label: Consequence }
      - { id: next, label: Next step }
    points: 4
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
An `order` question needs at least 2 items with different ids and different labels. You write `items`
in the correct order; `content:sync` stores them shuffled (the same fixed shuffle every time, never the
correct order), and the correct order lives only in the private key. It is graded like `multi`:
all-or-nothing, so one item in the wrong place scores 0. Learners move items by dragging, or with the
Move up / Move down buttons on each item (and from the keyboard). Changing the items changes the
challenge `version`.

`submission.screenshots.min: 0` makes the screenshots optional (the Stepper shows "Optional"); use it when the
Figma link alone shows the work, and write the rubric so the link can earn full marks.

Links in a brief (`[text](https://…)`) to other sites (Drive, Figma, …) open in a new tab with an
external-link icon. Links into the app open in the same tab, with no icon: link to another challenge with
`/challenges/<slug>`, to a category with `/categories/<slug>`, or use `#anchor`.

`tip` is a short markdown hint shown in a subtle box above the questions (on the first questions step
of a stepped challenge). It is display-only, like `image`: changing it never bumps the `version`, and it
can't contain a `TODO…` placeholder in a published challenge.

\* Used only when the challenge is first synced; afterwards these are managed in Admin → Content
(see "Who owns what").

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
- After creation, `required_for` and `due_at` (like `status`) are changed in Admin → Content. The
  picker only offers tracks that can see the challenge (same rule as validation). Changing them
  never bumps the challenge `version`.

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
