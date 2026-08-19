---
title: "What Should We Do Next? Ask a Focus Area Maturity Model"
description: "Every engagement eventually produces the same question from management. A maturity model turns it from a matter of opinion into something you can point at."
published: true
date: 2025/04/15
slug: "maturity-models-and-tech"
image: "/articles/maturity-models-and-tech/cover.png"
tags: ["maturity-model", "governance"]
---

_A look at how a maturity model turns "what should we do next?" from a matter of taste into something you can put on a table._

I've worked within a lot of different organisations, each with their own stage of "technological maturity". Depending on the management, the people, the culture and the technology stack, every one of them sits somewhere on a spectrum between rudimentary and advanced.

And in nearly every one of them, someone eventually asks me the same question.

> _"So what should we do next?"_

It usually comes from a management position. I get it more often these days now that I'm specialising in integration.

The people asking are rarely clueless. There's normally a decent grasp of the different capabilities and practices within the domain. But knowing the parts of a domain and knowing which part to touch next turn out to be very different things.

This is where a maturity model comes into play.

In this post I'll go into why the honest answer to that question is so hard to give, what a maturity model does about it, why the "focus area" variety fits a messy technology landscape better than the classic ladder, and how requirements let you describe the state of a solution without falling back on opinion.

## Everybody has an answer, and that's the problem

Ask five people in an organisation what to do next and you will get five different answers.

The platform engineer wants a service mesh. The security officer wants the gateway locked down. And somebody who read something on a flight wants an API marketplace by the third quarter.

None of them are being unreasonable. They're each looking at the domain through the part of it they own — and from there, their answer genuinely is the most urgent thing.

**The trouble is that a manager asking "what should we do next?" has no way of weighing those answers against each other.** They're being handed five conclusions with no shared scale underneath them, and the one that wins tends to be the one argued most confidently.

Is that really how a budget should get spent?

What the question really asks for is a way to compare things that don't look comparable. How do you put "we have no naming conventions" next to "we have no runtime monitoring" and say something defensible about which one comes first?

Preferably without needing to be an engineer to follow the reasoning.

## A map of the domain, not a ladder

The main premise of a maturity model is to weigh the different capabilities and practices within a domain against each other.

It gives you two things at once. First a vocabulary for the domain, so that everyone is at least naming the same things the same way. Then a sense of what "further along" actually means for each of those things.

Think of a house that needs work.

You can have a beautiful kitchen and a roof that leaks at the same time. Nobody would call that house "60% renovated", and nobody sensible would spend the next budget on the kitchen. The rooms are at different stages, and the ones you do first are the ones holding the others back.

Technology landscapes are the same. Organisations are rarely uniformly mature. They're advanced in the corner someone cared about and rudimentary everywhere else, and the interesting question is never "what's our score" but "which room is the roof".

A maturity model is the floor plan that lets you ask that question in the first place.

## Why focus areas beat a five-level ladder

The models most people have met are the ladder kind. Five levels, the whole organisation sits on one of them, and you climb.

They're easy to communicate and they make for a very satisfying slide in a steering committee. They're also a poor fit for the thing we just described, because they force one number onto a landscape that is genuinely uneven.

A focus area maturity model goes about it differently.

Instead of one ladder for everything, the domain gets broken into **focus areas**, coherent chunks of the domain that are able to advance on their own. Something like API design, versioning, security, documentation, lifecycle management — the practices someone could plausibly own. Each focus area then gets its own progression, and this is the part that matters: **they don't all have the same number of steps.**

Some focus areas are basically done after two moves, whilst others have six meaningfully different stages worth distinguishing.

Those progressions are then laid out against each other on a matrix, so you can read off not just where each focus area sits, but the order things should sensibly happen in across the whole domain. Getting documentation to its second stage might depend on design conventions reaching their third.

**The result is less like a ladder and more like a route.** It doesn't tell you that you're a Level 3 organisation — a number that never survived a conversation with anyone doing the work anyway. It tells you that these four things are the next reasonable moves, and that this one unlocks two others.

Which, conveniently, is the shape of the question that was asked.

## Requirements are where the objectivity comes from

None of this helps if deciding where a focus area sits is still a matter of opinion. A model that produces a confident number from a vague conversation has just laundered the guesswork.

So where does the placement come from, if not from judgement? It comes from requirements.

Each stage within a focus area is defined by an explicit list of requirements, which are concrete and checkable statements about what must be true for that stage to count. Not "API design is mature" but something you can actually hold an organisation against and get a yes or a no.

A capability sits at a given stage when the requirements for that stage are met, and not a moment before.

This is what makes the outcome defensible rather than persuasive. When someone disagrees with a placement, and they will, the disagreement has somewhere to go. You're no longer arguing about whether the API practice is "good". You're pointing at a requirement and asking whether it's met.

That tends to be a much shorter argument, and it is one a non-technical stakeholder can follow all the way down.

It also means the model produces its own backlog. The requirements you don't meet at the next stage are, quite literally, the list of things to do next.

## What it costs you

I don't want to oversell any of this though.

In theory a focus area maturity model gives you a lot:

- A **shared vocabulary** for a domain, which alone resolves a surprising number of arguments
- An **ordering** that respects dependencies instead of treating every gap as equally urgent
- A **defensible position** that survives contact with someone who disagrees
- A **backlog** that falls out of the assessment rather than being negotiated

Though in the trenches of reality it asks something back:

- Somebody has to **actually assess it**, which means interviews, reading, and hours of cross-referencing what people said against a long list of requirements
- The requirements need to **fit the organisation**, and a model borrowed wholesale from elsewhere will describe a domain nobody there recognises
- The whole thing goes **stale**, because the landscape moves while the assessment sits in a document

That last set is the reason this doesn't get done as often as it probably should. The value is clear enough to most people I speak to. It's the effort of getting there that quietly kills it.

That effort is exactly the part I've been trying to automate, and it's what I want to write about next.

**But first: is the answer you're currently giving to "what should we do next?" one you could defend, or just one you argued well?**
