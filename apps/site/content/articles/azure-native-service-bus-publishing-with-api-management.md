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
explainerVideo: "/articles/azure-native-service-bus-publishing-with-api-management/explainer.mp4"
explainerVideoWebm: "/articles/azure-native-service-bus-publishing-with-api-management/explainer.webm"
explainerPoster: "/articles/azure-native-service-bus-publishing-with-api-management/explainer-poster.png"
explainerAlt: "Animated explainer. An API call often needs to start work in the background, so teams build a Function app whose only job is to forward the request from API Management to Service Bus. With the native send-service-bus-message policy, API Management publishes to Service Bus itself and the Function disappears. The client gets a 201 Created straight away while the work happens later. The policy is one-way, so a client that needs a reply should keep using forward-request. The final frame compares the bridge you maintain with the native policy."
---

If you work in the Azure ecosystem, you've probably built this same piece of connective tissue more than once: an Azure Function or a Logic App whose only job is to bridge a synchronous API call into an asynchronous Service Bus message. It works, but it's another component to build, deploy and maintain for something that's really just plumbing.

That's why I paid attention when Microsoft announced a native Service Bus message publishing policy for API Management (APIM), in preview since October 19, 2025. It moves that plumbing directly into the gateway.

## Why a native Service Bus policy

The driver here is simplification, plain and simple.

Previously, if you wanted an HTTP call in APIM to kick off an asynchronous backend process, you'd typically reach for a Logic App or Function to act as a channel adapter. Its entire job was to take the message, maybe transform it a bit, and drop it onto a Service Bus.

The new policy removes that middle component. APIM can now publish messages straight to a Service Bus queue or topic, so your frontend APIs and backend event consumers decouple with a single policy instead of an extra hop.

Fewer moving parts, lower cost, and one less thing to patch and monitor. It also means APIM can genuinely act as the gateway for both your synchronous and asynchronous traffic instead of just the synchronous half.

## What the native publishing policy actually does

The policy is called `<send-service-bus-message>`, still in preview, and it lets you configure an APIM operation to send a message to Service Bus as part of its inbound or outbound processing.

Authentication runs through Managed Identities, which is the right way to do this: no Service Bus connection strings sitting around as secrets inside APIM. You enable a system- or user-assigned managed identity on your APIM instance, grant it the "Azure Service Bus Data Sender" role on the target queue or topic, and configure the policy with the namespace and payload you want to send.

From there, APIM handles authentication and publishing on its own, turning what used to be a multi-step, code-driven detour into a handful of lines of declarative XML.

## Implementing it

Start with a fire-and-forget mindset. The strongest use case here is accepting an HTTP request, immediately queuing it for backend processing, and returning a 201 Created or 202 Accepted to the client right away.

That keeps the API responsive while the actual work happens somewhere else, safely queued.

The setup itself is straightforward:

1. Make sure your APIM instance has a managed identity enabled and the Azure Service Bus Data Sender role on the target Service Bus resource.
2. Add the following to your API operation's `<inbound>` policy:

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

This grabs the incoming request body, sends it to the queue, and immediately responds with a 201, so the caller never waits around for whatever happens on the backend.

## What this changes for cloud integration

This is APIM leaning further into being the central hub for cloud integration on Azure, not just a gateway for REST or SOAP. It's now a legitimate piece of event-driven architecture too. You can have IoT devices, partners or mobile clients send data through a standard, secured, rate-limited HTTP POST, and have that data fan out to multiple microservices via Service Bus topics from the same gateway that handles your synchronous traffic.

That's genuinely useful: it bridges request-response style integration with event-based integration, and it means the gateway itself can absorb traffic spikes by queuing requests rather than letting backend services get hammered.

It also simplifies governance a bit, since sync and async traffic both get managed, secured and observed from the same place.

## Where to be careful

This policy is built for one-way message publishing, full stop. It's not for synchronous request-reply scenarios.

If your client sends a request and actually needs a specific response back from whatever consumes that message downstream, this isn't the tool. You'd still use a traditional `<forward-request>` to a backend that can do the work and hand back a synchronous response.

`send-service-bus-message` is for fire-and-forget. The client gets acknowledged, but it never hears back from whatever eventually processes the message. Use it for a request-reply pattern and you'll end up with a client stuck waiting for a response that's never coming.

## Worth trying

The native Service Bus publishing policy is a genuinely useful addition if you're maintaining any of these sync/async bridges today. It cuts a component, cuts the operational overhead that comes with it, and gives you a cleaner way to build decoupled systems on Azure.

I'd be curious how this changes your own integration patterns once it's out of preview.

## Links

- [Introducing native Service Bus message publishing from Azure API Management (preview)](https://techcommunity.microsoft.com/blog/integrationsonazureblog/introducing-native-service-bus-message-publishing-from-azure-api-management-prev/4462644)
- [Send Service Bus message policy — Microsoft Learn](https://learn.microsoft.com/en-us/azure/api-management/send-service-bus-message-policy)
- [How to send a message to a Service Bus queue or topic — Microsoft Learn](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-send-service-bus)
