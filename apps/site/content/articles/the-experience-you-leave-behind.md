---
title: "The Experience You Leave Behind"
description: "Every new job starts with a clean slate and an empty laptop. A sketch of a personal, portable memory that keeps what you learned and leaves behind what your employer owns."
published: true
date: 2026/11/05
slug: "the-experience-you-leave-behind"
image: "/articles/the-experience-you-leave-behind/cover.png"
tags: ["ai", "personal", "large-language-models"]
---

_“A sketch of a personal knowledge layer you can carry from job to job”_

> _“What did you learn at your previous job?”_
>
> _“Not the projects on your CV, the judgement behind them?”_
>
> _“Could you write it down right now, accurately?”_

I tried. I couldn't, at least not with an accuracy I'd be willing to stand behind.

I remember outcomes and a handful of stories I've told often enough to have polished them.

The decisions in between, why I chose one approach over another and what I'd do differently next time, have mostly faded.

Those are exactly the parts that made me better at my job.

**That's my point.**

I doubt I'm the exception here. Most people never track their own growth anywhere outside their employer's systems, and by the time they leave it's too late to extract it properly.

In this article I'll explain where the idea came from, draw a line between what belongs to your employer and what belongs to you and look at why current tools don't cover it. Then I'll sketch what a portable memory could look like, where it hits the corporate wall and show the half-built version I use myself.

## Day one, again

Starting a new job means starting with a clean slate.

A new laptop, a new account and a new set of company tools and services you're expected to work with. Everything you built up at the previous job stayed behind.

Your notes live in their wiki, your decisions are buried in chat threads and your drafts sat on a machine you handed in on your last day.

Even the memory of the AI assistant you worked with every day lives in a tenant you no longer have access to.

Mostly, that's fair. The documents, the data and the code were paid for by your employer.

Though, something else got left behind with them: the record of how you got better at your job.

So you arrive with years of experience and none of it in a form you, or a machine, can use on day one.

You rebuild your way of working from memory, and memory, as I just found out, is a lossy format.

## Where the idea came from

As head of innovation and product, I've been thinking about a knowledge layer for the organisation I work at.

One place where what the company knows becomes findable and usable, by people and AI agents alike.

Somewhere in that design a requirement showed up that I didn't expect.

It needs a “personal” layer. A private part for every employee that the rest of the organisation can't see: their own notes, their own preferences, their own lessons.

That's when the question flipped for me.

**If that layer is personal and private anyway, why does it live inside the company at all?**

## What's yours to keep

Here's where I draw the line.

You're responsible for executing whatever activities your job consists of. Doing that well means understanding **why** something needs doing, **how** to do it, **what** exactly to do and **when** to do it, at any given moment.

**Refining your understanding of why, how, what and when is exactly the knowledge that can never be company IP.**

The customer list, the pricing model, the architecture diagrams and the names of the people in the room belong to the company. They stay behind, as they should.

The understanding you gained while working with them is a different story.

That a migration stalls when nobody owns the decision. That your proposals land better when you start from the objection you expect. That you, specifically, need a written agenda or your meetings drift.

Think of a chef switching restaurants.

The recipes, the menu and the supplier contracts stay in the old kitchen. How they taste a sauce, when they know the pan is hot enough and how they get through a fully booked Saturday walk out the door with them.

Nobody would call that theft.

The difference is that a chef practises that knowledge with their hands every day. Most of ours only ever gets written down in our employer's systems, if it gets written down at all.

## Why nothing does this yet

There's no shortage of tools that remember things.

Workplace AI assistants and enterprise search increasingly keep a memory of your work. That memory is tied to one employer though, so when you leave, it stays.

Personal note-taking apps sit at the other end. They're yours and they're portable, but they're passive. They store what you put in and do very little with it.

What's missing sits in between. Something that spans a whole career instead of one job, that turns your experience, knowledge and preferences into something you can actually execute. Especially something that leaves out sensitive information whilst retaining what you learned about your own performance.

I haven't found it. If it exists, I'd love to hear about it.

## A sketch of a portable memory

So let's sketch it.

Consider these the parts I think such a thing needs, rather than a design.

**An ontology.** The concepts you work with and how they relate to each other. Product discovery connects to stakeholder management, which connects to how you run a roadmap review. This part changes slowly and travels well, because it's abstract by nature.

**Episodic memory.** What happened, what you decided, how it turned out and what you'd change. Captured as an episode about your own judgement, with the company details already removed.

A purely hypothetical episode could look like this:

```yaml
# episode: unclear ownership stalls a migration (hypothetical)
situation: Platform migration spanning three teams, no single decision owner
decision: Kept going, assuming the steering group would settle it
outcome: Months of rework before anyone took ownership
lesson: Name a decision owner before the first milestone, not after the first conflict
refines: [why, when]
```

Nothing in it identifies a company, a customer or a colleague.

And yet it's precisely the kind of lesson I'd lose within a year.

**Executable artifacts.** This is where it becomes more than a notebook. Skills, checklists and instructions an AI agent can follow, derived from the ontology and the episodes. Your way of working, written so that a machine can run it on the first day of your next job.

**A capture habit.** A big extraction on your last day doesn't work, as I've just proven to myself.

Capturing has to be small and continuous, close to the moment the lesson happens. In my own setup hooks take care of this, so it happens without me having to remember it.

That part turned out to be solvable.

## The corporate wall

The hard part is where the work happens.

A personal layer is only useful if it's present while you work. That means on the company laptop, next to the company tools, reading along with whatever you're doing. Exactly the place where a personal product or service is least welcome.

Look at it from the other side of the table. An employee wants to connect their own tool to company systems, and that tool sends what it captures to a vault the company doesn't control. Any security officer worth their salary says no, however good the intentions are.

**And they'd be right to.** The lesson and the sensitive details arrive together. A tool that captures the first will see the second.

So every episode needs to be stripped of whatever belongs to the employer before it leaves the corporate context. Not afterwards, in your personal vault, but on the way out.

I don't have a solution for that yet.

Maybe it's the company knowledge layer I started with, offering a private personal space with a sanctioned way out. Maybe it's a local model that does the sanitising before anything crosses the wall. Either way it's the part that has to be trustworthy before any employer would allow it.

## My own, half-built version

I run an early version of this myself.

An Obsidian vault holds the ontology and my notes. A Claude plugin describes my way of working and turns that ontology into something executable.

It has been field-tested by exactly one person: me. So treat it as a sign that the parts fit together, nothing more.

The repo behind this site leans on the same principle on a smaller scale. Its procedures live as skills any agent can pick up and follow, so the next agent doesn't start from a blank page.

In [The Siren Song of Inference](/articles/the-siren-song-of-inference) I mentioned using AI to capture evidence for my job performance. Recording turns out to be the easy part.

Keeping it, carrying it with you and making it useful is where it gets hard.

## Closing thoughts

In an ideal setup I see:

- A **running start** at every new job, with your own way of working ready on day one
- An **honest record** of your growth, instead of a few polished stories

Though, in the trenches of reality I fear for:

- **Sanitising** that's either too strict to keep the lesson or too loose to keep the secret
- **Integration**, since a personal tool on a corporate machine looks like a data leak, whatever the boundary

I'll keep building on my own version and share what holds up. Until then, try the test from the top of this article on yourself.

**What could you tell your next employer about what you learned at this one?**
