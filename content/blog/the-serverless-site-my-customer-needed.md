---
title: "The Serverless Site My Customer Needed"
date: 2020-06-25T20:00:00+02:00
draft: false
---

Not long ago I published a new version of my website that no longer used a HTML one-page template. I had written both HTML and CSS files myself and I quickly felt content. The site displayed summarized "about me" information with some contact details.

Almost immediately after I put the website live, I asked myself: *"What if I wanted to share content?"*. Surely I could use an existing platform to scribble down my thoughts, but could it be possible to put this content on my site without a hassle and without worrying about maintaining components like a Content Management System (CMS) or even the webserver itself?

So yeah, I meant myself when writing about "my customer" and yes, I think that's disgusting too. But hear me out.

The point is; **I delivered a product without actually understanding and/or observing what the customer needed.** If I would have sat down for longer then 20 minutes and drafted up some ideas maybe I could've avoided this. Right? I see this phenomenon happening around me all the time. Sadly I even contribut to it more then I'd like to commit. So this made me wonder:

> *Can I be more mindful in my development process? And if so, could I find a solution that actually fulfills my needs?*

In order to answer this question I got urged myself to delve into the origin of design thinking. And boy, did I fall down the rabbit hole.

*If you don't feel like finding out more about the history of design and how it got into software development, you'd better skip to the part where I talk about the development of my site.*

## The human part of design

**Design** is a term broadly used throughout all kinds of industries with most of them having their own definition associated with it. I could devote a series of posts to the differences in definition and both the use and misuse of the word. The same accounts for the way **"design as a way of thinking"** has been used in the last decade.

The design thinking movement, like many trends before, has made its delayed way into business environments. Especially those where IT and business seem to meet. With the main point boiling down to:

> *Using a designers approach to solve managerial or software related problems*

Though it originates from something much more elaborate:

As far as I could trace back, it started in 1964 when Ken Garland published **["The First Things First" manifesto](https://bit.ly/2BzkSdK)** as response to the ever increasing pressure on designers to contribute to the production of mainstream advertising. Depriving the concept of design from its essence by moving it from being centered around humans to instead be driven by corporate goals and metrics. Designers have fought to prevent their craftsmanship from sliding into this inhuman oblivion ever since.

The developing technology didn't help either as it introduced increasingly more complex problems at the time. In attempt to solve these problems people tried to turn to design, as a method of solving problems, into a form of science.

The late 1960's are the origin of the **Wicked Problems**  firstly mentioned by Horst Rittel, a design theorist and professor at the Ulm School of Design in Germany. He stated that these wicked problems are a[^1]:

> "class of social system problems which are ill-formulated, where the information is confusing, where there are many clients and decision makers with conflicting values, and where the ramifications in the whole system are thoroughly confusing."

[^1]: [C. West Churchman, "Wicked Problems," Management Science, (December 1967), vol. 4, no.14, B-141-42](https://bit.ly/37Tu1dt)

That roughly translates to: *Wicked problems are unclear in the way how they should be solved, a lot of people are involved but they don't agree with each other and it's unknown what is and isn't relevant... It's actually quite a mess*.

Rittel claimed that although these problems are so complex, they have a underlying pattern consisting of two phases: **problem definition** and **problem solution**. He pleaded for the importance of human experience and perception in design as opposed to others in this period. This is were the **problem space** and **solution space** phases are derived from in diagrams about design thinking.

This sparked the interest of many, since it strives to solve a problem that's relevant throughout different industries because of its abstract nature. Causing designers and other highly creative people to become subjects of studies in order to determine how they would come up with ideas and solutions. This research led to the use of creative thinking techniques like brainstorming across other professions as we know and use today.

After this periode a lot more happened on which I could elaborate more, but one of the key events related to design thinking was the 1992 publication of Richard Buchanan's **"Wicked Problems in Design Thinking"** in which he portrait design and its role in solving problems. Stating[^2]:

> "The subject matter of design is potentially *universal* in scope,
because design thinking may be applied to any area of human experience"

[^2]: [Buchanan, Richard. "Wicked problems in design thinking." Design issues 8.2 (1992): 5-21.](https://bit.ly/3hUsOqL)

Somewhere around 2015 business trend outlets like the [**Harvard Business Review**](https://bit.ly/3176Uus), [**Thoughtworks**](https://www.thoughtworks.com/insights/blog/business-design-and-technology-joining-forces-truly-competitive-advantage) and others picked up on a "way of putting design much closer to the center of the enterprise" for it being a way of "joining forces for a truly competitive advantage".

You might be wondering why I'm lecturing you on the history of design. But the crucial takeaway from this are the similarities popping-up in software development nowadays and that explains the increase in need for something like design thinking (or other trends).

The emphasis is more and more put on **time-to-market**, **reducing lead times**, **delivering on more new features** and other metrics. Sure, times have changed and technology enables us to deliver on these promises. But it beckons the question whether or not these demands are slowly and steadily crossing a line causing a shift of focus in software development towards metrics, leading to disconnection from human aspects.

Regardless of your position or role within the development process, you're creating something to be used by humans in one way or another. Whether its a mission statement, a performance report, a piece of software or even test documentation.

Make sure to ask yourself the question whether or not you're being pushed forward plagued by assumptions, metrics and deadlines instead of **being guided by the challenge to determine and solve the actual problems of the customer**.

Take into account the human part of the development; **do you know if the problem you think you're solving, is even close to the actual problem?**. This will serve you greatly in the long run.

## Spaces of problems and solutions

So after being distracted for hours about the roots of design thinking, I got back to the problem I was dealing with. What do I want? What do I think I want? What do I think I want but is it actually something I don't need? 

You get the point.

I've spent a couple of days drafting out ideas, listing constraints and hardships I've experienced and visited other sites to experience what I was looking for. This helped me coming up with the following design principles I wanted to keep in mind creating my website and selecting the tooling to get there. I choose principles instead of distilled requirements so I would have set the context for the solution I want without restraining my freedom during the process.

- **Effortless**: I want there to be no impediments when it comes to maintaining or updating the website. Whether or not I'd like to admit it, I do procrastinate from time to time. Everything can become an excuse to not do something.

- **Simple**: Since I only want to post an occasional blog and some personal information there is no need for an elaborate CMS or fancy features. This will not only enable the effortless principle but will reduce distraction while writing by unnecessary features.

- **Sustainable**: Both in infrastructure and related costs I want the most ideal match between the features I need and the related costs. Static web content shouldn't be needing a 24/7 up and running webserver when there is no traffic. To reduce my (digital) footprint and also my costs.

As a solution I decided to go with:

- **[AWS Static Storage Server (S3)](https://aws.amazon.com/s3/)**: the static storage service from Amazon offers a lot within the free tier. Using this service eliminates the need to maintain my own server. It is also accessible from almost everywhere using the AWS-CLI or online console.

- **[AWS Route53](https://aws.amazon.com/route53/)**: since I decided to go with the S3 service I wanted to use the AWS Domain Name Service as well. This way I would have everything in one place with no need to do custom DNS configuration and at the same time reducing the hassle of configuring the S3 service to work with my domain name.

- **[GitHub](https://github.com/)**: instead of versioning my content within a CSM, which I'd have to practice, I can store it within GitHub. Making me able to use a tool of which I already have some know-how.

- **[HUGO](https://gohugo.io/about/what-is-hugo/)**: a Static Site Generator (SSG) written in Go. This software aligns with the principles since it's open source, uses npm and GitHub and the generated content can be deployed to Amazons S3 service. HUGO uses HTML templating to generate HTML and CSS files based on content written using Markdown (.md) files.

- **[Markdown](https://www.markdownguide.org/)**: one that seems rather peculiar, but I prefer writing my content in a simple text editor so I'll be less likely to be distracted by styling and formatting. Markdown restricts its users in this by offering a simple syntax for only the essentials.

Everything you see on the site is actually written in .md files and HUGO does the rest. There are multiple SSG alternatives but I went with HUGO because of the low rendering times when opening HTML files so visitors have the quickest load times I could offer out of the box. This made developing the site much more effortless since I could change everything on the fly. I had a blast "creating" my website this time because everything just seemed to "click" once I have found something that aligned with the principles I created based on my needs.

Curious about the content of the website? Checkout my repository for the site on [GitHub](https://github.com/brand0new/brandonverzuu.com).

At the time of writing I've already changed my theme twice because of accessibility and readability. So will I ever be done with my site?

I guess that's the beauty of this way of developing.

Laying out design principles which I incorporate throughout the development process, from tool and language selection all the way to implementation and styling. This, combined with the effort to try and reduce constraints and hardships as much as possible. Enabled me to focus on experimentation, prototyping and testing to find the solution that I needed.
