---
title: "Azure: Native Service Bus Publishing With API Management"
description: "Azure API Management can now publish directly to Service Bus with a native policy, cutting the Function or Logic App you used to need just to bridge sync and async traffic."
published: true
date: 2025/10/30
slug: "azure-native-service-bus-publishing-with-api-management"
image: "/articles/azure-native-service-bus-publishing-with-api-management/cover.png"
imageAuthor: "André Karwath aka Aka"
imageLicense: "CC BY-SA 2.5"
imageSource: "https://commons.wikimedia.org/wiki/File:Lightning_cloud_to_cloud_(aka).jpg"
tags: ["api", "cloud-integration"]
---

For platform engineers and developers working within the Azure ecosystem, the line between synchronous and asynchronous services often requires building extra connective tissue — typically in the form of an Azure Function or a Logic App — just to put a message onto a Service Bus. This adds complexity, cost, and another component to manage.

That's why the introduction of the native Service Bus message publishing policy in Azure API Management (APIM) is a significant development. This new policy, announced in preview on October 19, 2025, promises to streamline this asynchronous messaging directly into the API gateway.

## Why A Native Service Bus Policy?

The primary driver behind this feature is simplification.

Previously, if you wanted an HTTP-based API call in APIM to trigger an asynchronous backend process, you commonly used a Logic App or Azure Function component to work as a channel adapter. This component's sole job was to take the message, perhaps apply some transformation and publish it to a Service Bus.

The new policy eliminates the need for this individual entirely. By allowing APIM to publish messages directly to a Service Bus queue or topic, you can decouple your frontend APIs from your backend event consumers with a single policy.

This reduces usage costs, the number of required components and it consolidates messaging concerns into APIM, all while improving maintainability at the gateway level. This shift further simplifies the topology of integrations on Azure, allowing APIM to serve as a unified gateway for both synchronous and asynchronous communication.

## What Is The Native Publishing Policy?

The built-in policy named `<send-service-bus-message>`, currently in preview, empowers you to configure an APIM operation to send a message to Service Bus as part of its inbound or outbound processing flow.

The communication is secured using Managed Identities, which is a best practice that removes the need to store Service Bus connection strings as secrets within APIM. You enable a system- or user-assigned managed identity on your APIM instance and grant it the "Azure Service Bus Data Sender" role on the target queue or topic. The policy itself is then configured with the details of the Service Bus namespace and the payload you wish to send.

With this in place, APIM handles the authentication and message publishing natively, reducing what used to be a multi-step, code-driven process into a few lines of declarative XML.

## How To Implement Native Service Bus Publishing

The main advice for implementation is to start with a "fire-and-forget" mindset. The most powerful use case is to accept an HTTP request, immediately queue it for backend processing, and return a 201 Created or 202 Accepted response to the client.

This makes the API highly responsive while ensuring the workload is safely queued.

Implementation is straightforward.

1. Ensure your APIM instance has a managed identity enabled and has been granted the Azure Service Bus Data Sender role on the target Service Bus resource.
2. Within your API operation's `<inbound>` policy, you would add the following:

```xml
<!--
  send-service-bus-message Policy XML
-->
<policies>
    <inbound>
        <base />
        <send-service-bus-message
            namespace="your-namespace.servicebus.windows.net"
            queue-name="your-queue-name"
            ignore-error="false">
            <payload>@(context.Request.Body.As<string>(preserveContent: true))</payload>
        </send-service-bus-message>

        <return-response>
            <set-status code="201" reason="Created" />
            <set-body>Message queued successfully.</set-body>
        </return-response>
    </inbound>
    <backend>
        </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
```

This configuration captures the incoming request body, sends it to the specified queue, and immediately sends a 201 response to the client, preventing the caller from having to wait for any backend processing.

## How This Enhances Cloud Integration

This policy solidifies APIM's role as the central hub for modern cloud integrations. It's no longer just a gateway for synchronous REST or SOAP APIs; it is now also a first-class citizen in an event-driven architecture (EDA). Platform engineers can now design systems where IoT devices, partners, or mobile clients can send data via a standard, secured, and rate-limited HTTP POST, and have that data seamlessly fanned out to multiple microservices via Service Bus topics.

This capability bridges the gap between the synchronous, request-response integration style and the asynchronous, event-based integration style. It allows developers to build more scalable and resilient systems, as the API gateway can absorb traffic spikes by queuing requests, protecting backend services from being overwhelmed.

This direct integration simplifies governance, as all communication — whether sync or async — is now managed, secured, and observed from the single pane of glass that APIM provides.

## When To Be Cautious

It is crucial to understand that this policy is purpose-built for one-way message publishing. It is not designed for synchronous request-reply scenarios.

If your client sends a request and needs to wait for a specific response generated by the backend consumer of that message, this policy is not the right tool. In that scenario, you would still use a traditional `<forward-request>` to a backend that can perform the work and return a synchronous response.

The `send-service-bus-message` policy is for "fire-and-forget" patterns. The client's request is acknowledged, but the client does not receive a response from the eventual processor.

Using it for the wrong pattern will lead to a disconnected client and an architecture that doesn't meet its requirements.

## Get Started And Share Your Thoughts

The new native Service Bus publishing policy in Azure API Management is a powerful tool for simplifying event-driven setups. It reduces complexity, lowers operational overhead, and empowers developers and platform engineers to build more resilient, decoupled systems.

What are your thoughts? How do you see this new policy changing your implementation patterns on Azure?

## Links

- [Introducing native Service Bus message publishing from Azure API Management (preview)](https://techcommunity.microsoft.com/blog/integrationsonazureblog/introducing-native-service-bus-message-publishing-from-azure-api-management-prev/4462644)
- [Send Service Bus message policy — Microsoft Learn](https://learn.microsoft.com/en-us/azure/api-management/send-service-bus-message-policy)
- [How to send a message to a Service Bus queue or topic — Microsoft Learn](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-send-service-bus)
