# Source: Wireframe Creation Framework — Learning Check

Path slug: `wireframe-framework-check`
Title: Wireframe Creation Framework: Learning Check
Audience: strategist · Category: wireframing · Sequential: yes
Quiz mode for all milestones: instant feedback
Summary: "Check that you know how the wireframe framework works and can use its skills well."
Before you start: "This path has 3 parts, about 10 minutes each. You'll see right away if each
answer is right. A wrong answer? Try again. Full points on the first try, half on the second."

---

## Milestone 1 — Know the system (~10 min)

### Q1 (ORDER) Drag the six phases into the correct order.
Correct order:
1. Research & definition
2. References & inspiration
3. UXDA factor
4. Build and describe
5. Deliver
6. Refine & hand over
Why: These are the six phases of the framework.

### Q2 (ORDER) Drag these steps into the order you complete them.
Correct order:
1. Insights
2. Jobs to be done
3. Key user scenarios
4. References & inspiration
5. Strategic direction
6. Ideas
7. Structure draft
8. Build
Why: Steps 1 to 8 — each one builds on the previous ones.

### Q3 (MATCH) Match each file to its purpose.
- Wireframe creation framework → The guide: what to do in each step, why, quality criteria, and which skill to use
- Wireframe workspace → Where you and Claude fill in the work for each step
- Feedback log → Where you report problems and suggestions about the framework and skills
Why: The framework guides you, the workspace holds the work, and the feedback log improves both.

### Q4 (MC) Where should you fill in the workspace for a client project?
- A. Directly in the template in the Wireframe creation system file
- B. In a copy of the workspace placed in the client's internal file ✅
- C. In a new blank Figma file
- D. In the Claude chat only
Why: Never fill in the template itself — always work in a copy in the client's file.

### Q5 (MATCH) Match each skill to its step.
- /wf-insights → Insights
- /wf-jtbd → Jobs to be done
- /wf-scenarios → Key user scenarios
- /wf-references → References & inspiration
- /wf-direction → Strategic direction
- /wf-ideas → Ideas
- /wf-structure → Structure draft
- /wf-annotations → Add annotations
- /wf-review → Review
Why: One skill per step, from Insights to Review.

### Q6 (MC) Which steps use the UXDA wireframe plugin in Claude Code instead of a /wf- skill?
- A. Insights and Jobs to be done
- B. Build and Naming, formatting & publishing ✅
- C. Ideas and Strategic direction
- D. Review and Handover
Why: Build uses /new-screen, /new-flow and /check; formatting uses /format.

---

## Milestone 2 — Work with the skills (~10 min)

### Q7 (SCENARIO) You are working on two flows at the same time: Cards and Payments. How do you organize your Claude chats?
- A. One chat for both, so Claude knows the whole project
- B. One chat per flow, inside the Claude project, each renamed after its flow ✅
- C. A new chat for every step
- D. Chats outside the project, so they stay separate from research
Why: One chat per screen or flow keeps the context clean.

### Q8 (SCENARIO) /wf-insights finishes and reports: "Evidence for this screen was thin; 2 of 6 insights come from one interview." What do you do?
- A. Move on, since Claude already filled the board
- B. Check those insights against the source, add what you know, and consider adding sources before moving on ✅
- C. Delete all insights and write them yourself
- D. Run the skill again until the warning disappears
Why: Claude's report is an early warning — check before you move on.

### Q9 (TF) If Claude's output looks well written, you can move to the next step without checking it, because the skills follow UXDA's rules.
- True
- False ✅
Why: You are responsible for the result, not the AI. Every output gets checked.

### Q10 (SCENARIO) A skill keeps asking for information you already gave, which slows you down. What do you do?
- A. Stop using the skill
- B. Work around it and say nothing
- C. Add an entry to the Feedback log with the step, skill, what happened, and what you expected ✅
- D. Write your own prompt instead
Why: The Feedback log is how the framework gets better.

---

## Milestone 3 — Judgment calls (~10 min)
Intro: "Each question describes a real situation. Choose the best action."

### Q11 (SCENARIO) The project has no research on family accounts. What do you do before running /wf-insights?
- A. Provide sources (client brief, competitor apps, articles) or add research to the project ✅
- B. Let Claude work from general banking knowledge
- C. Skip to Ideas
- D. Reuse insights from another client's project
Why: Insights must come from real sources, never be made up.

### Q12 (SCENARIO) Your project covers retail and business banking, and /wf-jtbd returns jobs mixing both. What do you do?
- A. Keep them all
- B. Split them across two flows
- C. Delete the business ones by hand
- D. Rerun the skill, stating exactly which segment you are designing for ✅
Why: Being specific about the scope is the strategist's job.

### Q13 (SCENARIO) All the references you found are from one competitor. What do you do?
- A. Use them; one good source is enough
- B. Copy that competitor's solution
- C. Add references from other competitors and from outside banking before moving on ✅
- D. Skip references for this screen
Why: A single source narrows your thinking.

### Q14 (SCENARIO) The build brief has 12 [ASSUMED] items. What do you do?
- A. Review each assumption and correct the wrong ones before building ✅
- B. Paste the brief into Claude Code as it is
- C. Delete all assumptions from the brief
- D. Ask the client to approve all 12
Why: Assumptions are marked so you can quickly correct them.

### Q15 (SCENARIO) Claude's annotation describes a behavior that isn't actually on the screen. What do you do?
- A. Keep it; Claude probably knows the intent
- B. Add the behavior to the screen so they match
- C. Rerun the skill until the text changes
- D. Correct or delete it, since annotations must describe what the screen actually does ✅
Why: Annotations describe what the screen really does.

### Q16 (SCENARIO) /wf-review flags an issue you disagree with after checking the screen. What do you do?
- A. Fix it anyway, since Claude flagged it
- B. Leave it unfixed and note why in the review notes, so the Senior/Lead sees your reasoning ✅
- C. Ignore it without noting anything
- D. Run the review again until it disappears
Why: AI reviews can exaggerate. You decide, but your reasoning stays visible.

### Q17 (SCENARIO) The client asks to change a button label on ACC-3. The same button appears on ACC-6 and ACC-9. What do you do?
- A. Change it only on ACC-3, as asked
- B. Create ACC-3 V2 with the new label
- C. Change it on ACC-3, ACC-6, and ACC-9, and tell the client ✅
- D. Wait for feedback on the other screens first
Why: Check connected screens before applying feedback.

### Q18 (SCENARIO) During handover, one element is still waiting on client input. What do you do?
- A. Leave it out of the brief
- B. Make your own decision and hand over
- C. Delay the whole handover until it's resolved
- D. Flag it explicitly as pending, so the Designer doesn't treat it as settled ✅
Why: Pending items must never look settled.

### Q19 (SCENARIO) Claude's output reads well, but you can't tell where some of it came from. What do you do?
- A. Ask Claude where it came from, and remove anything it can't back up ✅
- B. Trust it, since it reads well
- C. Rerun the skill
- D. Delete the whole step
Why: Every output must be traceable to a source.

### Q20 (SCENARIO) A skill keeps giving weak results for one type of screen. What do you do?
- A. Stop using the skill
- B. Give more guidance in chat to get the result, and log it in the Feedback log ✅
- C. Write your own prompt instead and say nothing
- D. Accept the weak results
Why: Guide the skill now, and log it so the skill improves.
