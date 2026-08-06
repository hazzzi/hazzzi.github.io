---
title: A Prompt Without a Single "Don't"
date: 2026-05-22
description: How I stopped telling my agent what not to do, and started making the wrong thing impossible. Lessons from building an internal design review tool.
tldr: Telling an agent "don't look at the code" doesn't work. Removing the code path from its input does. But strip too much input and the agent loses the big picture. Deciding what to give and what to withhold turned out to be the real work of input design.
---

For a while, my prompts and `CLAUDE.md` were full of "don't"s. I can't even remember how many. Don't take fullPage screenshots, don't look at the code, don't change the format every time... Every time something went wrong, I added another line. Each new line fixed things exactly once.

The more I stacked up, the more they leaked. I wrote the rules down clearly, and the next session broke them anyway.

## The rule that said "don't look"

The case I remember most clearly is an internal tool that reviews UI designs automatically. It has a separate evaluator agent that judges the screen, and I told it: "Don't read the code. Judge only by what you see."

I put that in the prompt, plainly. It read the code anyway. Instead of looking at the screen, it read the implementation and said things like "this is nicely structured with cva." It did exactly what I told it not to do.

That stopped me for a moment. I wondered if I should just say it more forcefully.

## Removing it from the input

The problem wasn't that "don't look" was too weak. The problem was that the evaluator **could** look.

The agent simply knew too much. Maybe it could only focus if it didn't know. So I deleted the "don't look" sentence and stopped putting the code path in the prompt at all. Screenshots only. There was no code to look at, so it couldn't look. And the evaluator judged cleanly, by the screen alone.

Making something impossible worked far better than asking. Looking back, everything that had actually worked had the same shape. Instead of asking "please evaluate fairly," run the evaluator in isolation so the biasing input never reaches it. Instead of "follow the format," pin one template so there is no room to deviate. All of it was "don't do X" rewritten as "remove X from the input."

## Removing too much

Then I got excited and went one step further. Skip the full-page screenshot too; give only cropped sections, so it focuses on detail. I figured less input meant better output.

That backfired. The evaluator saw each section well but lost the whole picture. Parts that had already passed would break in a later round, and it wouldn't notice. It lost consistency. I still have a work note asking "does differential capture make the evaluator miss consistency issues?" It did.

So I fixed it again: cropped regions for detail, plus one full screenshot for consistency. "Remove input" was not the answer. **Choosing what to remove and what to keep** was. The code path was safe to drop; the full screenshot was not. Where you draw that line is the actual work of input design.

## What prompts can't fix

Some things didn't yield to input design at all.

I have a script that runs typecheck, tests, and lint in one go before committing (the usual verify script). It passed even when lint emitted warnings, because pass or fail was decided by exit code, and warnings exit 0. The agent saw the warnings, decided "out of scope," and moved on. Telling it to fix them was an appeal to goodwill. It didn't work.

So I made warnings exit 1. Commits started failing, and only then did the agent go back, read the log, and fix them. The strength of a rule was never in the warning message. It was in the exit code. Not "fix it," but "you can't commit until it's fixed."

Later I found that [dottxt](https://blog.dottxt.ai/control-layer-for-ai.html) had written this up cleanly: don't rely on what the model *will not* do; make it something the model *cannot* do. The question changes from "did the model behave?" to "did we define the allowed range correctly?" That was what I had been fumbling toward. They do it at the token level; I did it with prompts and shell scripts.

## Environment instead of nagging

These days, anything the agent shouldn't do gets blocked by a lint rule where possible, and by a custom shell script where lint can't reach.

Not everything is solved. I use Claude's memory feature, and lately it's not great: useless context creeps in, and the things I actually need don't get saved. This too is a question of what to keep and what to drop, the same question as input design, and I haven't settled on an answer.

I thought this work would mean writing more nagging. It turned out to mean deleting the nagging and changing the environment. A prompt without a single "don't" is the one that behaves best, which is a little strange.

Even so, the fatigue hasn't really gone down. Maybe it's a Claude thing, but it feels like micromanaging a very smart junior: watching every decision it makes, guiding each one. Writing code got cheaper, but managing the agent got more expensive by about as much. I'm still looking for a way out of that one.
