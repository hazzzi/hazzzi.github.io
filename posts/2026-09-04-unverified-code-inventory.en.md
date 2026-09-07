---
title: Code You Can't Verify Is Inventory, Not Productivity
date: 2026-09-04
description: In the AI era, the bottleneck in software development has moved from writing code to verifying it
tldr: Since I started vibe coding, my PRs have grown from under 300 lines to 500, 1,000, and sometimes more than 10,000. AI review and automated checks could process more code, but a person still couldn't understand and independently verify more change. I think productivity should be measured in changes I can verify and take responsibility for, not in generated code.
---

AI has made product development faster. It has also left me with more technical debt.

Since the beginning of this year, I've done most of my coding through vibe coding. I give the requirements and intent to an agent. One agent implements and tests, and another reviews. Features ship noticeably faster than before.

The problem was that code generation wasn't the only thing speeding up.

## The bottleneck moved

When I wrote code myself, I worked as if one commit were roughly one PR. I kept features small, opened PRs often, and tried to keep changed lines below 300.

I thought a reviewer could follow the intent and flow in one sitting when a change stayed under 300 lines. That didn't mean 301 lines were always bad or 299 were always safe. It was simply a limit I used to keep changes within a range I could understand.

After changing teams and moving most of my work to vibe coding, PRs grew past 500 lines, then 1,000. At one point I had a diff of more than 10,000 lines. At first I still tried to skim them, but as the number of lines grew, so did the cognitive load. Eventually, I stopped reading and let them through when CI passed.

The agent could generate more code, but I could still read and understand only the same amount. The bottleneck had moved from writing code to verifying it.

Code produced beyond what I could review felt less like debt and more like unprocessed inventory. Could I really call all of it productivity?

## Generated and done

Much later, I opened one of the files. There was a set of automated checks combining tests, lint, and agent rules, but quick fixes had piled up and one component took more than 20 props. Still, the feature worked after deployment and all the checks passed.

In the actual product, however, it only worked on the happy path. Other paths worked intermittently. Once, while using the product, I asked, "Is this screen supposed to show up here?" and heard, "No, that's not what I intended." There were also bugs introduced by changes to existing code that nobody noticed internally until a customer support ticket came in.

A feature working didn't mean the product behaved as intended. Passing automated checks didn't tell me how it behaved across real user paths. At some point, I wasn't even sure I understood the code well enough to fix it later.

Type checks, lint, tests, and AI review can filter out problems found inside the code. To know if the product behaves as intended, I still need to check other flows and real data. I also need to explain why it was built that way and be able to undo the change when something goes wrong. That's what lets me keep working on it later.

Until then, I had quietly treated a passing `verify` CI run and a successful deployment as if all necessary verification were complete.

## AI reviewing AI

These days, AI reviews code written by AI. I don't think this is meaningless. It can catch missing null handling or tests and find consumers I forgot to update. It can also narrow down suspicious areas before a person reads the whole diff.

Still, looking only at the review output makes it hard to tell whether the AI understood the relevant context or merely sounded like it did. If the writing agent and the reviewing agent read the same diff and the same repository, the number of reviews may increase without adding a new kind of evidence.

A GeekNews post on [From Human-Centric to Agentic Code Review: Faster Decisions Don't Mean Better Reviews](https://news.hada.io/topic?id=32454) covered an analysis of 1.02 million reviewed PRs across 207 open-source projects. In some workflows involving AI agents, review decisions arrived faster, but no approach was consistently better than human-only review in both speed and quality. It's an observational study, and quality was measured with proxies rather than production failures, so this isn't evidence that AI review is bad. Faster reviews alone don't prove better code.

[AI-to-AI Code Reviews of GitHub Pull Requests](https://news.ycombinator.com/item?id=49426227) found that 248,641 AI-authored PRs had at least one AI review. The paper's "closed loop" means AI participated in both writing and review; it doesn't mean no human reviewed them. That was 8.8% of the AI-authored PRs identified by the study. The absolute number is already large, but the study did not measure review accuracy or final code quality. Usage alone didn't tell me whether the review was valid.

AI review is useful for finding defects in code. It doesn't automatically check whether the product behaves as intended with real data. Automated checks are strong at preventing failures we already know about. They don't discover unknown paths or a badly framed problem on their own.

## Context and ownership

In [Building Mangu Run](/posts/2026-04-02-vibe-coding.html), I wrote that I built the app end to end without reading a single line of code. The project ended up with 167 small commits, and I revised `prd.json` 55 times.

I don't consider that post a success story. The lesson then was to write `prd.json` well enough for work to continue across sessions and leave the work in a state that could survive a session losing context halfway through. It was closer to a build log from when I was first learning how to work with AI.

Models are better now and can handle much larger contexts, so I don't think that method is equally useful today. A model handling more context doesn't mean I understand the product's intent any better. `prd.json` could connect sessions, but it couldn't solve the gap between how much code was generated and how much a person could verify.

What Mangu Run solved was continuity between sessions. What I'm dealing with now is the gap between generation and verification.

## 300 lines isn't the answer

Then I wondered if every PR should go back under 300 lines. I'm not sure about that either.

If work needs to ship, should I stop only because the diff is large? If I tell an agent to create stacked PRs under 300 lines, I don't know whether it will find meaningful boundaries or split the code just to hit the number. GitHub has also written about [turning a 1,721-line AI-generated pull request into a reviewable stack](https://github.blog/engineering/turn-one-giant-ai-generated-pull-request-to-a-reviewable-stack/), but dividing a change into smaller PRs doesn't make the underlying change smaller.

Throwing away code a person can't explain isn't realistic either. Someone would have to rewrite it, and I can't match an agent's output by writing it all by hand. Once AI has become part of the development process, it's hard to go back to exactly how I worked before.

Looking back, 300 lines wasn't an answer. It was a rough limit I used to avoid losing track of a change. It was a size that let me follow the intent, impact, and way to verify a change. Now I think the line count matters less than whether I can follow one change from start to finish and check it against my intent. I still don't know how to do that.

A study of [review effort in 33,707 AI-generated PRs](https://2026.msrconf.org/details/msr-2026-mining-challenge/49/Early-Stage-Prediction-of-Review-Effort-in-AI-Generated-Pull-Requests) found that static signals such as patch size, the number of modified files, and configuration file changes predicted high-review-effort PRs better than PR descriptions. It was about spotting expensive reviews early, not about how to divide the work. I still don't have an answer for the right unit of change.

## Unverified inventory

I still don't know how to manage this in practice. I can't simply stop generation or rewrite everything that already exists. A line limit alone isn't enough.

Passing tests and CI means the automated checks finished. It doesn't mean I understood the change or checked other paths in the real product.

The next 10,000-line diff will probably come with green checks too. For now, I'm starting by not treating those checks as a sign that the work is done.
