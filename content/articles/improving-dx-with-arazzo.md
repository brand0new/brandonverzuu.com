---
title: "Improving Developer Experience with OpenAPI's Arazzo Workflow Specification"
description: "Arazzo is a new open-source project that aims to improve developer experience by providing a specification for workflows using OpenAPI. In this article, we will explore the key features and benefits of Arazzo, and how it can help developers create better workflows in their applications."
published: 2024/06/17
slug: "improving-dx-with-arazzo"
---

_We explore how OpenAPI’s Arazzo Specification attempts to redefine API documentation by clarifying call sequences and dependencies improving Developer Experience._

## The ongoing quest for language-agnostic specifications

The OpenAPI Initiative (OAI) is known for the OpenAPI Specification (OAS) standard which we can consider the de facto standard for describing HTTP APIs. Whether you’re a proponent or not, you can’t deny the global presence and adoption of this specification standard.

This standard isn’t perfect by any means but it offers many benefits when implemented consistently within an organisation.

**Within API development there is a growing need for a more extensive way to describe and manage workflows.**

**The increasing complexity of the underlying business processes as well as the number of available APIs can be detrimental to the developer experience on the consumer side.**

API specifications struggle to express the dependencies between sequences of calls to get specific outcomes. The Arazzo Specification fills this gap by offering a method to define workflows in formats readable by both humans and machines.

This specification improves the developer experience by providing clearer, more comprehensive API documentation. It helps developers grasp and handle complex interactions within an API, making API descriptions more usable and efficient, thus streamlining development processes.

Let’s take a brief look at the OpenAPI Specification first

## Shortcomings of OpenAPI

Besides the margin for implementation inconsistencies and design fallicies does the standard have no way of expressing context. Operations within APIs are rarely used in isolation or any other context. A true REST API should be stateless in it technical implementation but that doesn’t eliminate the presence of business context.

Consider our beloved Pet Store.

```yaml
# pet-api-specification.yaml
paths:
    /v1/pets:
        get:
    /v1/orders:
        get:
        post:
    /v1/coupons:
        get:
```

Interpreting how to create an Order for a Pet using a Coupon using the description above could be done intuitively. Though in practice it turns out intuitive and readable specifications are not that common.

Consider the following API description.

```yaml
# created with the intend to aggrevate readers
paths:
    /pet/getPet:
        get:
    /pets:
        get:
    /orders:
        post:
    /orders/orderPet:
        post:
    /discounts:
        get: # <- you need to call this endpoint
    /discounts/coupons:
        post:
```

This API description becomes murkier and harder to grasp without reaching for documentation or fellow developer.

Sure, we all have an idea on intuitive API design but reality is that especially over time the implementations and descriptions we have to deal with a far from ideal. This makes it more important to be able to understand the context.

This context usually results in a dependency between specific calls in order to achieve a particular goal. The OAS contains no specification to describe this behavior. The OpenAPI Initiative has been developing the Arazzo Specification for this specific use case to which I’ll be giving an introduction within this post.

## Compensating features of Arazzo
Arazzo is intended to be implemented using an OpenAPI Specification. I’m not too keen on the design choice of adding a specification alongside the OAS file. Though considering expanding the already broad OAS with more capabilities doesn’t seem to be the superior choice either.

The specification prescribes a file structure similar to an OAS:

![OAI Arazzo Structure](https://github.com/OAI/Arazzo-Specification/raw/main/images/Arazzo-Specification-Structure.png)

Core components of an Arazzo Specification are:

- sourceDescription: used to import OpenAPI specifications or other Arazzo specifications to implement components of other files
- workflows: core component of Arazzo describing a specific use case
- inputs: JSON schema representing input parameters
- parameters: parameters applicable throughout the whole workflow
- success actions: Object describing the action to execute when successful
- failure actions: Object describing the action to execute when a failure occurs
- steps: Object containing individual activities within a workflow
- components: Object containing reusable Arazzo Components
- criterion: Object offering the main support for business logic-related implementations. Supports simple, regex and JSONPath expressions

You get a grasp of the intent with Arazzo given these object. Lets take a look at three of the features Arazzo offers.

## Leverage existing specifications with sourceDescriptions

Arazzo intends to leverage the API and workflow specifications you already have. Albeit limited to specifications using their own standards (‘arazzo’ and ‘openapi’). This feature enables arbitrary naming of external sources and referencing existing Components using their identifiers.

```yaml
# openapi.yaml
paths:
    /v1/pets/{id}:
        get:
            operationId: getSpecificPet

# arazzo.yaml
arazzo: 1.0.0
sourceDescriptions:
- name: apiDescription
  url: https://<domain>/api/petstore/openapi.yaml
  type: openapi
workflows:
- workflowId: retrieveAndOrderPet
  summary: Workflow to retrieve and order a specific Pet
  steps:
  - stepId: retrievePet
    operationId: apiDescription.getSpecificPet # referencing sources
```

Using sourceDescriptions enables developers to focus on specifying the workflow and not on the details of the API itself.

Though it begs the question: “How resilient is this added specification to change over time?”

Since the Arazzo specification now depends on the structure and content of the API description we have yet another document to validate before implementing changes. The identifiers of components are presumably stable, but when the Arazzo specification relies on request or response body structures this stability is lesser.

## Deterministic sequences with workflows

Usually I am not a particular fan of the PetStore example. Mainly because it tends to over simplify specifications and use cases encountered “out in the field”.

For example the implementation of security-related endpoints for authentication and authorization. Even though OAuth 2.0 and OpenID connect have a formal specification on how to be implemented, in practice small deviations and interpretations tend to sneak in.

The core feature Arazzo offers drastically helps improve the Developer Experience when it comes to actually consuming the specified APIs. Let’s take a look at an example from the OAI repository that describes how to obtain a token from an OAuth 2.0 and OpenID Connect authorization server.

```yaml
arazzo: 1.0.0
workflows:
  - workflowId: OIDC-authorize-AuthzCode-PAR
    summary: Getting an Access Token using a PAR and Authorization Code
    inputs:
        ... # list of inputs
    steps:
      - stepId: executePushedAuthorizationRequest
        description: Pushed Authorization Request
        operationId: $sourceDescriptions.auth-api.PAR
        ...
        requestBody:
          payload: $inputs.PARrequestBody
        successCriteria:
          # assertions to determine step was successful
          - condition: $statusCode == 200
        ...
      - stepId: getAuthorizationCode
        description: OIDC Authorization code request
        operationId: $sourceDescriptions.auth-api.Authorization
        ...
        successCriteria:
          # assertions to determine step was successful
          - condition: $statusCode == 302
      - stepId: exchangeAuthorizationCodeForToken
        description: Get token from the OIDC Token endpoint
        ...                  
        successCriteria:
          # assertions to determine step was successful
          - condition: $statusCode == 200
        outputs:
          tokenResponse: $response.body
    outputs:
      access_token: $steps.TokenStep.outputs.tokenResponse
```

Naming of some components aside — the workflow immediately becomes more understandable and accessible for developers. At least the intend from the producer side is conveyed explicitly.

Especially the ability to be able to convey your intend as a producer with the workflow specification is a huge improvement to the Developer Experience on the consumer side.

## Natural Language as gateway to HTTP APIs for Large Language Models (LLMs)

Introducing a specification that explains the intended implementation of APIs using natural language indicates a shift to emphasize machine-readability. Which shouldn’t come as a shock to most as the majority of the industry is determining if they want to do anything AI-related and if so, in what that should be.

The OpenAPI Initiative clearly takes a pre-emptive move towards embracing LLMs as part of the integration industry with the exploration of this workflow specification standard.

With the introduction of custom GPTs at OpenAI they promote the usage of the OpenAPI Specification to document your API in order for a pretrained model to ‘understand’ it. It is even possible to extend the OAS with x-openai-isConsequential.

This flag indicates that any model MUST prompt the user for confirmation before calling the endpoint.

```yaml
paths:
  /todo:
    get:
      operationId: getTODOs
      description: Fetches items in a TODO list from the API.
      security: []
    post:
      operationId: updateTODOs
      description: Mutates the TODO list.
      x-openai-isConsequential: true
```

Who knows how long it will take to get a scarily reasonable answer to prompts like this:

> “Create an end-to-end implementation for a Pet ordering feature within my Vuetify webapp. Find a suiting API specification at https://my-company/apis/discovery that is able to provide the right data and functionality. Use the workspace context to determine the Pet and Order representation within our application. Ensure that our model stays separated from the domain of whatever source system you integrate with and handle mapping within the intended mechanic Vue offers.”

## Arazzo, the be-all and end-all of API descriptions?

Arazzo’s ambitious attempt to improve the Developer Experience and machine-readability of API descriptions is very promising in theory.

I do think that it answers the need developers can have for contextual information and producer intent.

Although I have major concerns on the maintainability of the implementation over time as well as the still present wiggle-room within the specification itself. Similarly to the OpenAPI Specification, it leaves too much room for inconsistency and small errors to pop-up. Which will lead to the never expanding need for additional tooling to lint, check or validate the contents of yet another file in yet another way.

I’ll definitely be keeping an eye out for the further development and implementation of Arazzo in the near future.

## Further reading and resources

Do you struggle with leveraging the full potential of APIs within your organisation? “I happen to be something of an API architect myself”.

Reach out to me or one of my colleagues if you’re interested and be sure to leave your opinion and insights on the development of the industry as well.

Not done reading? Here’s some more in-depth and interesting stuff to catch up on:

- [OpenAI getting started with Actions](https://platform.openai.com/docs/actions/getting-started)
- [OpenAPI’s Arazzo Specification Github](https://spec.openapis.org/arazzo/latest.html#arazzo-specification)
- [My colleague on generative AI](https://appythings.com/ai-is-changing-the-api-game.html)
