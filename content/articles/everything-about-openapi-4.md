---
title: "Everything you need to know about OpenAPI version 4"
description: "OpenAPI version 4 codenamed Moonwalk is scheduled in development. I'll be covering everything you need to know about this new major version."
published: 2024/07/09
slug: "everything-about-openapi-4"
---

OpenAPI version 4 — named ‘Moonwalk’ — is scheduled to for release by the end of 2024. Are there plans related to #LLMs? Is there a complete overhaul? What will become of our beloved #OpenAPISpecification?

Since everything is available to the public, I dove in to take a look at the general outline of this new version.

Here’s everything you need to know about the future of version 4 so far…

> This post regards a specification in active development. Topics covered, their implementation and examples are subject to change.

## The efforts of the OpenAPI Initiative

The OpenAPI Initiative (OAI) has a Special Interest Group (SIG) that is shaping the latest version of the OpenAPI Specification. At the moment of writing there is no official specification available yet.

But the guiding principles of Moonwalk are clearly outlined with a couple of examples spread throughout the repository. There’s also a feature branch we can take a quick look at to get an idea of what’s coming 👀

## Overhauling OpenAPI

These guiding principles of Moonwalk are outlined during an announcement post at the end of 2023. Let’s take a look at the five guiding principles that will determine the way Moonwalk turns out and apply from them what we can.

### Semantics

“Semantics provide purpose, whether the consumer is a human or an AI.”

This is a big one.

Not only because it describes a fundamental change to the specification but it also strengthens my point about the OAI’s positioning towards generative AI and specifically Large Language Models (LLMs) — as discussed in my article about Arazzo

OAI understands the importance of the traction that AI has within the space and has decided to act on it by incorporating a design constraint for it within the new major version of OpenAPI.

![General structure outline of OpenAPI Specification version 4](/articles/openapi-4-structure-outline.jpg)

Besides this new structure, this version will allow for name spacing to create a OpenAPI Description (OAD) that adds the aforementioned purposeful semantics.

```yaml
# SUBJECT TO CHANGE
openapi: 4.0.0
self: https://example.com/petstore
imports:
  - namespace: inventory
    href: https://example.com/domains/inventory-objects.yml
  - namespace: sales
    href: https://example.com/domains/sales-objects.yml
```

With the support for importing and leveraging namespaces it should become possible to further implement the usage of natural language.

### Signatures

> “An API operation is identifiable by its signature, which can be based on any aspect of HTTP mechanics”

Current OpenAPI Specifications only allows for **one operation per HTTP method** which is an artificial constraint made by the specification.

Moonwalk wants to pivot to be more client-oriented by offering API functions by their signature. This allows for descriptions that bundle a set of functions that can be mapped to HTTP mechanics instead of the other way around.

This means we’ll be going from this:

```yaml
# HTTP as starting point
openapi: 3.0.0
info:
servers:
tags:
paths:
  '/pets':
    post: # HTTP mechanic as starting point
      requestBody:
        content:
          application/json: # Content Type as structure
            schema:
              $ref: '#/components/schemas/Pet'
      responses:
        201:
          description: created
        404:
          description: notFound
          content:
            application/http-problem: {}
        5XX:
          description: serverError
          content:
            application/http-problem: {}
    get:
      responses:
        200:
          description: ok
          content:
            application/json:
              type: object
              properties:
                data:
                  type: array
                  items:
                    $ref: '#/components/schemas/Pet'
        404:
          description: notFound
          content:
            application/http-problem: {}
        5XX:
          description: serverError
          content:
            application/http-problem: {}    
components:
  Pet:
    type: object
    properties:
      name:
        type: string
        ...
```

To something that looks more like this:

```yaml
# SUBJECT TO CHANGE
# API functionality as starting point
openapi: 4.0.0
...
imports:
 - namespace: inventory
   href: /domains/inventory.yml
paths:
  'pets':
    requests:
      createPet: # API function as starting point
        method: post
        # Content Type as property of API function
        contentType: application/json
        contentSchema: inventory:Pet
        responses:
          created:
            status: 201
      getPets:
        method: get
        # Responses with the API function as scope
        responses:
          ok:
            status: 200
            contentType: application/json
            contentSchema:
              type: object
              properties:
                data:
                  type: array
                  items: inventory:Pet
    # Responses with the path as scope
    pathResponses:
      notFound:
        status: 404
        contentType: application/http-problem
# Responses with the API as scope
apiResponses:
  serverError:
    status: 5xx
    contentType: application/http-problem
```

Besides a more functional approach it also allows for more descriptive power with fewer lines!

### Inclusion

> “Moonwalk aims to describe all HTTP-based APIs while remaining neutral regarding any specific design debate.”

Recently I was working on an implementation of one of Google’s services and I encountered very developer-unfriendly specification of its APIs.

On one hand there’s the resource-oriented system design of my customer and on the other hand there is an API describing a set of HTTP-based RPC functions. Since I’ve been working on the description of all APIs provided by my customer, the request was to also describe the APIs offered by Google with the OpenAPI specification.

**The distinct factor between the calls was the content of the payload that determined what functionality was executed.** This led to a convoluted API description since they all were expected to be using the POST method which makes it harder to describe since OpenAPI v3 is more resource-oriented in its specification.

Well no more! 🙏

### Seperation of Concerns

> “Modularization will keep the scope of Moonwalk manageable with loose coupling among concerns such as HTTP interfaces (“API shapes”), deployment configuration, and content schema formats”

An example of the current tight coupling between the API description and deployment configuration is **a difference in security implementation within each environment.** Sandbox or testing environments can have other — or no — means of securing APIs for a spectrum of reasons.

Version 3 has no way of dealing with this difference between environments other than having to specify all possible security schemes or even worse, having an API description dedicated to each environment.

With Moonwalk it’s possible to specify deployments using a few properties. These deployments can be included within an OpenAPI Specification or isolated in a dedicated specification referencing separate other files.

```yaml
# SUBJECT TO CHANGE
openapi: 4.0.0
namespace: self
deployments:
  default:
    title: PROD
    location: https://api.example.com
    security:
      - oauth: []
    clientRegistration: https://developers.example/let-me-in
    apiPaths: self
  sandbox:
    title: SBX
    location: https://api-sbx.example.com
    security:
          - basic: []
    clientRegistration: https://developers.example/let-me-in
    apiPaths: sandbox
```

### Mechanical Upgrading

> “An automated upgrade process from 3.x to 4.0 will be developed as part of the Moonwalk effort”

This speaks for itself. The threshold to get people from older versions to newer versions should be as low as possible. Ensuring automated upgrades are possible is more than welcome and hopefully allows for a higher adoption rate of the new version.

Based on the statistics from APIstic — which has statistics based on a total of 1.437.832 API specifications — only roughly 15.560 (~1,08%) of the registered specifications are on version 3. Hopefully this is either a miscalculation on my side or a dataset that’s not representative of the market.

Even if it is a remote representation then that would still leave a lot of room for improvement — and work… — for the majority out there.

![Graph depicting OpenAPI major version usage by APIstic](/articles/apistic-major-version-usage-graph.jpg)

## Predictions

What can we conclude from this? There are three major opportunities that come to my mind.

### Opportunity #1: Full embrace of generative AI

Regardless of your opinion on generative AI in general, you should understand that having “nothing” in between the implementation code behind an API and the added value to customers of the API consumer’s business is the ultimate goal.

It’s why web-based APIs have become successful in the first place. They the means for any disparate organisations to collaborate by exchanging data and functionality.

For now it seems generative AI is the most feasible tool that will get us another step closer to achieving this without too much friction.

### Opportunity #2: Rise of OpenAPI Description (OAD) repositories

The combination of specifications in development at OAI start to form an ecosystem for tech-agnostic API description. Especially when Arazzo, OpenAPI and Overlay (more on this in a future post) are combined it leads to a collection of resources that is able to fully describe an API and its intended implementation.

Here’s my first attempt:

We’ll draft out what we’ll need for the OpenAPI Description for our feature.

The amount and separation should be based on the functional design of the system:

```yaml
# conceptual overview of relevant resources
resources: 
  - workflowDescription: https://api.example.com/workflows/petstore.arazzo.yml 
  - apiDescriptions: 
      - petstore-api: https://api.example.com/api-specifications/petstore.openapi.yml 
      - ...
  - domainDescriptions: 
      - sales: https://example.com/domains/sales.yml
      - inventory: https://example.com/domains/inventory.yml
      - ...
```

First we create the definitions of our functional domains and their resources:

```yaml
# sales.yml
components:
  schemas:
    Invoice:
      type: object
      properties:
        ...
    Order:
      type: object
      properties:
        ...
    OrderLines:
      type: object
      properties:
        ...

# inventory.yml
components:
   schemas:
     Product:
      type: object
      properties:
        ...
     Pet:
      type: object
      properties:
        ...
     Food:
      type: object
      properties:
        ...
```

Then we’ll offer an API description based on the functionality and data we’re offering:

```yaml
# SUBJECT TO CHANGE
# petstore.openapi.yml
openapi: 4.0.0
...
imports:
 - namespace: inventory
   href: /domains/inventory.yml
paths:
  'pets':
    requests:
      createPet: # API function as starting point
        method: post
        # Content Type as property of API function
        contentType: application/json
        contentSchema: inventory:Pet
        responses:
          created:
            status: 201
      getPets:
        method: get
        responses:
          ok:
            status: 200
            contentType: application/json
            contentSchema:
              type: object
              properties:
                data:
                  type: array
                  items: inventory:Pet
    pathResponses:
      notFound:
        status: 404
        contentType: application/http-problem
apiResponses:
  serverError:
    status: 5xx
    contentType: application/http-problem
...
# sales.openapi.yml
openapi: 4.0.0
...
imports:
 - namespace: sales
   href: /domains/sales.yml
paths:
  'pets':
    requests:
      createOrder:
        method: post
        contentType: application/json
        contentSchema: sales:Order
        responses:
          created:
            status: 201
      getOrders:
        method: get
        responses:
          ok:
            status: 200
            contentType: application/json
            contentSchema:
              type: object
              properties:
                data:
                  type: array
                  items: sales:Order
    pathResponses:
      notFound:
        status: 404
        contentType: application/http-problem
apiResponses:
  serverError:
    status: 5xx
    contentType: application/http-problem
```

Lastly we **add business context by offering a workflow description** that describes the intended implementation of the API functions combined:

```yaml
# SUBJECT TO CHANGE
# petstore.arazzo.yml
arazzo: 1.0.0
...
sourceDescriptions:
  - name: petstore-api
    url: ./descriptions/petstore.openapi.yml
    type: openapi
  - name: sales-api
    url: ./descriptions/sales.openapi.yml
    type: openapi
workflows:
  - workflowId: OrderingPets
    summary: Workflow for ordering Pets at Example
    inputs:
      type: 
    steps:
      - stepId: listAvailablePets
        description: Show Pet offering to Customer
        operationId: $sourceDescriptions.petstore-api.getPets
        outputs:
          potentialPetId: $response.body.pets[x].id 
      - stepId: getPetInformation
        description: Show Pet information to Customer
        operationId: $sourceDescriptions.petstore-api.getPet
        parameters:
          - name: pet_id
            in: query
            value: $steps.listsPets.outputs.petId
      - stepId: orderPet
        description: Create an Order for a Pet
        operationId: $sourceDescriptions.sales-api.createOrder
        ...
      - stepId: findOrderForPet
        description: Show Order details to Customer related to Pet
        operationId: $sourceDescriptions.sales-api.getOrder
        ...
```

The result is a layered description that aligns with OAI’s purposeful semantics principle. With the goal to describe “what (… does this do?) and the why (… does this matter?) to the how (… does this work?)”.

I expect that it’ll be just a matter of time before tool developers will offer support for the visualisation of these specifications individually as well as their combined power.

### Opportunity #3: API-led Customer Journeys

As you might’ve seen throughout the code snippets above I’ve implemented domain-oriented imports that contain resource descriptions.

I strongly believe in the benefits of a resource-oriented approach for understandability. Add to this clearly separated domain definitions — as described within Domain Driven Design — and it is foreseeable that more of the concepts from this design approach can be applied here.

This adds a tremendous boost to the readability of API descriptions as well as the audience they can be shared with. Especially with a more visual representation I expect API descriptions to become more common throughout business departments/teams within an organisation.

This will in turn move these specifications towards being used when determining customer journeys. **Further extending the API-first approach into business development.**

## In conclusion

I’m very interested in the direction OAI is heading with their new multi-specification approach.

There’s still a lot of room for improvement within the market, especially for **projects and organisations that are removed further away from the “bleeding edge”.** This world still struggles with consistent API design as well as getting clear API description in the hands of their consumers.

**For those that are close to the “bleeding edge”, the combination of the specifications offered seem to be a gateway into a whole new era of API-led innovation** and development with immens potential for those able to leverage it.

Though I’m almost evangelic in my outings, I doubt the scheduled release for Moonwalk will be met by the end of the year. Looking at the latest version available in both branches there is only one real design decision registered.

Additionally, it can become difficult for OAI to keep up with pace of the market now they are spread resources and their interests from one specification to multiple.

So, if you’re interested there are [open meetings you can join on every Thursday](https://calendar.google.com/calendar/u/0/embed?src=c_fue82vsncog6ahhjvuokjo8qsk%40group.calendar.google.com) and the _Moonwalk SIG has a meeting every Tuesday_.

As with all open source projects all contributions are welcome, so check their website if this sounds interesting and you feel like pitching in!

**Thanks for reading!**

**Please share your thoughts with me and everyone else in the comments below and feel free to share with your network.**

Let’s bring the web together! 🚀

## Links
- [Announcement post](https://www.openapis.org/blog/2023/12/06/openapi-moonwalk-2024)
- [Moonwalk (openapi v4) repository](https://github.com/OAI/sig-moonwalk/tree/specification)
- [APIstic data overview](http://openapi.inf.usi.ch/)
- [OpenAPI Initiative technical meeting calendar](https://calendar.google.com/calendar/u/0/embed?src=c_fue82vsncog6ahhjvuokjo8qsk%40group.calendar.google.com)