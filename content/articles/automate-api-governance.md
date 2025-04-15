---
title: "Automate Your API Governance In 15 Minutes"
description: "A practical example of using linting tooling to automate your API governance. Free developers from having to remember each individual convention and design rule by automating the process."
published: true
date: 2025/01/02
slug: "automate-api-governance"
tags: [
  "governance",
  "linting"
]
---

There’s a quote from Arnaud Lauret — author of The Design of Web APIs — during his [talk on API Governance at Nordic APIs](https://www.youtube.com/watch?v=EMLCNqx80W4&t=1s&pp=ygUSbm9yZGljIGFwaXMgYXJuYXVk) that has stuck with me for a while now:

> “Ideally governance enables developers to be as autonomous as possible and as expert as needed.”

In this article I demonstrate one of the many ways you can improve consistency in applying governance policies by writing a rule to apply on your API description in order to make developers more autonomous.

## API Governance Execution Is Hard

Many organisations use governance to enforce rules onto their developers. Resulting in a plethora of authorities, review committees and additional processes to ensure policies are developed, maintained and applied.

Many meetings are held, and decisions tend to be made, documented and then partially or fully forgotten by the time teams come around to implement them.

According to [the Postman State of API 2024 report](https://www.postman.com/state-of-api/2024/#:~:text=74%25%20of%20respondents%20are%20API,up%20from%2066%25%20in%202023.&text=APIs%20are%20no%20longer%20an,and%20boosting%20efficiency%20across%20teams.); _58% of developers rely on internal documentation, but 39% say inconsistent docs are the biggest roadblock._ Which in part will be attributed to documents that have been created as a way capture agreements and rules on API development.

## Beware! A Dangerously Large Number of APIs Ahead

Whilst API governance remains an area of improvement for many, the number of APIs is on the same steady rise they’ve been on for the last years. Organisations are _“juggling an average of 421 APIs […] expected to grow by at least 10% in the next two years alone”_ according to [F5’s State of Application Strategy report.](https://www.f5.com/resources/reports/state-of-application-strategy-report)

As APIs can offer tremendous value to an organisation. This means that you’ll be looking for ways to maximize this API-enable value whilst eliminating any risks on a sprawl of technical debt and inconsistent implementations.

The mandate from management — sometimes hardly obtained — to do “something with API strategy and governance” give you the green light to change something. But actually “doing the something” is the hardest part.

Let’s look at different types of decisions, how they tie into governance and what we can do with some example policies.

## Design Decisions vs. Implementation Decisions

Chances are likely you are dealing with more than one developer. We know for a fact that not every policy will be considered evenly important by everyone.

Therefore, you want to automate policies that are easily supported through existing tooling.

Example of decisions you do want to automate:

- How do I formulate a description?
- What casing do we use throughout the organisation?
- What responses do I add to an API description?
- How do I structure an API description?
- What features should I use from a specification standard?

You want to automate these decisions to keep developers going in a steady pace without having to resort to using random placeholder values, skip on easily addable information or be forced to contact an integration/API team.

Example of decisions you don’t want to automate:

- What operations do I support with my API?
- What parameters do I support with my API?
- What endpoints do I expose?

Decisions are clearly distinguished into design-related and implementation-related. Both types of decisions need to be made to develop successful APIs though the implementation-related decisions are easier and safer to automate.

Validating an implementation according to a standard or a specification is a rather binary decision to make:

_Naming must be in CamelCase: `home-address` is not in CamelCase._

Whilst validating a design is a combination of concepts and evaluations that rather appear on a spectrum.

_API must be secured: `OAuth implemented`. This only contributes partly to a secure API design._

## Let’s Setup Some Automated Rules

_Note: Throughout this example we’ll be using the Pet Store 3.1.0 specification example._

_Usually, I’m not too keen on using this example since it’s hardly representative of API descriptions you’ll encounter in real-life projects. Since we’re looking at implementing tooling to an API description and not the description itself, we’re fine using this._

We’ll be using npm and Spectral to create two custom rules we’ll apply to the Pet Store specification.

Assuming you haven’t worked with Spectral before we’ll start with a global install so we can use the CLI on our local machine.

```bash
npm i -g @stoplight/spectral-cli
```

![Installing Spectral CLI globally](/articles/spectral-1.jpg)

_Reference spectral documentation for CICD integration or other setups._

After installing we can start writing a custom rule. In our working directory we only have our **petstore.openapi.yml** API specification.

Running the `spectral lint` command will clarify we need to provide a ruleset to apply.

![Running the lint command](/articles/spectral-2.jpg)

Let’s create a custom ruleset called **object-policies.spectral.json** in which we’ll define our custom rule.

```json
{
    "description": "Object policies",
    "rules": {
        "object-policies:required-description": {
            "description": "Object must have a description",
            "message": "Object must have a description",
            "given": [
                "$..schemas[*]"
            ],
            "severity": "error",
            "then": {
                "field": "description",
                "function": "truthy"
            }
        }
    }
}
```

The goal of this rule is to enforce developers to include a `description` property for all schemas they define.

**Important!** Take into consideration the intent of the policy within the development process. **Why** should a developer be enforced to add a property as this is a seemingly added technical constraint.

**Our rationale here is to enforce a description to be present because we want to make sure a functional description is added.** Because we want to ensure our API descriptions will be easily understood by external developers.

Part of writing the rule is to determine the severity. This can strongly impact the development process depending on how and where the linting is done.

Decide together with all related teams what is important enough to halt the pipeline and what should be considered a warning or hint.

To apply the rule, we’ve written to the specification we execute

```bash
$ spectral lint petstore.openapi.yml --ruleset object-policies.spectral.json
```

_For this example, I’ve decided to create a dedicated file to contain all policies related to object validation. When you simply create a file called “.spectral.json”, Spectral will automatically apply these rule without the explicit “ — ruleset” flag._

![Running the lint command with ruleset](/articles/spectral-3.jpg)

Let’s add an additional rule. Our goal is to improve the readability of the API description with the emphasis of having a clear description for Schema Components.

Now we validate if the description property is present, we’ll check if our agreed upon template is used to formulate the functional description.

```json
{
    "description": "Object policies",
    "rules": {
        "object-policies:preferred-description-template": {
            "description": "Object description must implement template",
            "message": "Should contain 'A ... is a ... that ...' template",
            "given": [
                "$..schemas[*].description"
            ],
            "severity": "warn",
            "then": {
                "function": "pattern",
                "functionOptions": {
                    "match": "(A|An)\\s.+\\sis\\sa\\s.+\\sthat\\s.+"
                }
            }
        }
    }
}
```

We use a built-in function to apply a Regex to the content of the description property of each available Schema.

The intention of this validation rule is to give warnings to developers that their Schema description is lacking a functional description template that recommend to use to achieve consistent definitions that are more likely to be understood by external developers.

![Running lint command with output](/articles/spectral-4.jpg)

If we run the linter again, we’ll see the new finding listed as a warning within the result.

That’s it!

There are many tools to choose from, each with their own quirks, positives and negatives. As well as a million different rules you could import, write and implement.

## Closing Thoughts

Governance is hard.

Finding the balance between enforcing, reviewing, coaching and guiding will be different for each team, department or organisation. Unfortunately, there’s no single approach that works everywhere.

Though every time we’ve found it worthwhile to involve those involved and come to a collaborative approach for solving a part of the governance puzzle.

Start with a pilot that applies the most important — and easily implemented — policy the teams agree on and go from there.

Eventually, especially within larger organisations you’ll eventually be setting up a center of enablement or expert team on this topic. With the sole purpose to facilitate others in maximizing API-enable value. They shouldn’t become a regulatory bottleneck instead; they focus on alleviating impediments and constraints for other.

Engineers should be as autonomous as possible and as expert as needed.

_For more on Spectral and its capabilities and limitations reference their documentation. It’s worth noting that there are other viable options: API-fiddle, Vacuum, Optic amongst others. Don’t fret too much on WHAT tool to use, focus on IF and WHY such a tool might be needed._