---
title: "Capture API Changes with Overlay"
description: "A practical example of using Overlay Specification to automate your API governance. All with the goal of ensuring consistently applying predicatable changes to API descriptions."
published: 2025/01/27
slug: "capture-api-changes-with-overlay"
---

In Dutch, we have a saying: _“Aan de weg timmeren,”_ which literally translates to _“Carpeting the road.”_ It’s used to describe someone who makes consistent progress. This phrase comes to mind whenever I see posts from the OpenAPI Initiative or those involved with the organisation.

Whatever your opinion on their OpenAPI Specifications might be, it can’t be denied that it has become the most common way of describing RESTful APIs. If you’re even slightly into the API space, you’ve probably noticed an increase in buzz surrounding these specifications as well.

I’ve already covered developments on their other two specifications;

- [OpenAPI, and API description specification (v4 “Moonwalk”)](https://brandon-verzuu.medium.com/everything-you-need-to-know-about-openapi-version-4-f605b99ac443)
- [Arazzo, a workflow specification (v1)](https://brandon-verzuu.medium.com/arazzo-specification-for-api-workflows-9306e7819fb6)

Now I’ve finally made it around to covering their other specification: Overlay.

In this post, I’ll dissect the use case for it, explain the components, create an implementation I think is applicable to the real world and list my final thoughts!

## Use case for Overlay

The Overlay Specification can be used to create a document-based overlay for the descriptions in your OpenAPI Specification. To continue this accidental series on the different OpenAPI Initiative specifications, we’ll be taking a look at the currently final available specification called Overlay.

The name is quite fitting when looking at the specification. Overlay is intended to function as an actual overlay to an API description, making it easier to apply changes throughout the development cycle.

**I expect Overlay to be used in the automation of protocols during the API lifecycle, for example, applying a “deprecation protocol” when a deprecation flag is added to an endpoint in the API description.**

Before we dive into more detail on the uses of Overlay, let’s first examine the available components.

## Components of Overlay
An Overlay Specification is only relevant when there is an API Specification. Overlay allows its writer to target a piece of OpenAPI Specification using an **Action Object**.

The Action Object describes a change that needs to be applied. This is done using these properties:

- **target**: A JSONPath query describing the component that will undergo the described action.
description: An explanation of the action in natural language
- **update**: An object containing the structure to apply to an API description
- **remove**: A flag that describes if the target needs to be removed from the API description

```yaml
# an overlay file can contain more of actions
- target: $.info
    description: Always replace info object with customer-facing details
    update: 
       contact: 
        email: support@acme.com
        name: ACME
        url: 'https://www.acme.com'
```

The change describes that the info object of an API description will be updated with the information.

JSON Path can be used instead of a hardcoded value for the target property. This allows for large manipulations using wildcards (*) and JSON Path Expressions.

```yaml
# This expression will result in a list of ALL responses in an API description.
target: $.paths.*.*.responses
```

This is the basics of what is possible with the specification.

Let’s take a problem I have encountered numerous times and see how we could offer a solution for it with Overlay.

## Creating a universal deprecation overlay

Throughout the lifecycle of an API we try to make sure the documentation doesn’t drift from its implementation.

As change is inevitable, we want to be able to deprecate APIs if we’re designing a new iteration of it. The process of deprecating an API is a prime example where I’d consistently need to change the API implementation and description in the same way.

I want to add deprecation headers to the API and I want to make sure these deprecation headers are described and implemented similarly.

Here’s an over-simplified implementation:

1. An endpoint (or API) gets the deprecated annotation (either within the interface code or directly in the API description)
1. Processes API description in pipeline
1. Apply the Deprecation Protocol to the responses of all deprecated endpoints that have deprecation flag
1. Publish the final API description to the developer portal

**First, we create the overlay in order to define the change we want to apply universally.**

```yaml
# protocol-deprecation.overlay.yaml
overlay: 1.0.0
info:
  title: Deprecation Protocol
  description: The deprecation protocol ensures all required information is added to the API description to ensure consistent deprecation throughout the APIs
  version: 1.0.0
extends: ./petstore.openapi.yaml
actions:
- target: $.components
  update:
    parameters:
      HeaderDeprecation:
        name: Deprecation
        in: header
        description: RFC xxxx - A deprecation header is metadata describing the date and time when the endpoint is considered deprecated. 
        schema:
          type: string
          format: timestamp
          example: '@1737722995'
      HeaderSunset:
        name: Sunset
        in: header
        description: RFC 8594 - A Sunset header is metadata describing the date and time when the endpoint fully stops service.
        schema:
          type: string
          example: Thu, 31 Dec 2026 23:59:59 CET
      HeaderDeprecationLink:
        name: Link
        in: header
        description: RFC 8288 - A Link header is a relation type that points to a related resource
        schema:
          type: string
          example: "<https://developer.acme.com/deprecation>; rel=\"deprecation\"; type=\"text/html\""
- target: $.paths.*[?(@.deprecated == true)].responses.*
  update:
    headers:
      Deprecation:
        $ref: '#/components/parameters/HeaderDeprecation'
      Sunset:
        $ref: '#/components/parameters/HeaderSunset'
      Link:
        $ref: '#/components/parameters/HeaderDeprecationLink'
```

Within the overlay I’ve decided to implement some HTTP headers that relate to deprecation in a generic way. In theory this will allow for the implementation of this overlay on virtually any API description that implements the deprecation flag but lacks any of these headers.

**Second, we add the deprecation flag to the endpoint within our API description.**

![OpenAPI Specification with deprecation flags](/articles/openapi-with-deprecation.jpg)

**Third, we apply the overlay to the specification using a CLI tool.**

_**Important**: currently there’s a limited amount of tools that offer support for Overlay. I’ve randomly picked bump-cli (by Bump.sh) as it is listed as one of the supporting tools within the maintenance repository for Overlay._

```bash
# overlay command for bump-cli with arguments
$ bump overlay spec.openapi.yaml spec.overlay.yaml > final.openapi.yaml
```

![Resulting OpenAPI Specification](/articles/resulting-openapi-spec.jpg)

Finally, we end up with a rendered specification that clearly describes the headers that will be returned from the deprecated endpoint.

![Rendered OpenAPI Specification](/articles/rendered-openapi-spec.jpg)

Conclusion? Pretty neat! 🎉

## Limitations

But there are some limitations I’ve run into when creating this implementation;

1. **Overlay is not aware of the OpenAPI Schema.** As you describe changes in the Overlay you won’t get feedback if the structure will be valid within the target
1. **JSON Path implementation.** Overlay has support for expressions according to RFC 9535. Not all operators from other implementations can be used (e.g. find all properties with “x-” in their key)
1. **Tooling support.** Overlay is purely a specification and depends on third-party development for support. This allows for differences in how the specification will be supported eventually — like with OpenAPI.

I was going back and forth a lot to see how my overlay impacted the API description. Even though I have experience with the OpenAPI Specification, I still had to reference its documentation more often than not to remember the exact structure of the Parameter Object. As well as the exact level at which to target the overlay to achieve the desired result.

## Take-aways

I would summarise overlay like this: “A specification to capture universal and consistent changes for API descriptions”.

> In theory I really like the idea behind the overlay specification and I look forward to try and adopt this specification in actual projects.

But I don’t think we’re out of the woods yet…

In an ideal and fully structured environment I see its positives:

- A **powerful governance** tool for integration teams
- An **artefact** in automated/autonomous API description generation regardless of chosen format
- A key component to **limiting API drift** from happening

Though, in the trenches of reality I fear for:

- **Slight differences** in implementation that require manual overhead to fix
- **Inconsistent support** and implementation by vendors
- “How do I get my **JSON Path expression** to work?” questions from developers

As with most specifications I foresee that Overlay will require governance and guidelines to ensure its implementation benefits the organisation.

I look forward to the changes to come!

Want to read more on Overlay other relevant topics I’ve used? Here’s some additional reading material:

- [Overlay Specification Public Repository](https://github.com/OAI/Overlay-Specification)
- [HTTP Deprecation Header RFC](https://datatracker.ietf.org/doc/draft-ietf-httpapi-deprecation-header/09/)
- [Lorna Jane on Overlay early ’23](https://lornajane.net/posts/2023/overlay-improvements-to-openapi) and [on handling Deprecation](https://lornajane.net/posts/2024/openapi-overlays-to-avoid-api-oversharing)