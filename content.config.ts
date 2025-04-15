import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    projects: defineCollection({
        source: 'projects/*',
        type: 'data',
        schema: z.object({
            name: z.string(),
            url: z.string(),
            description: z.string(),
            thumbnail: z.string(),
            status: z.string(),
            opensource: z.boolean(),
        })
    }),
    articles: defineCollection({
      source: 'articles/*.md',
      type: 'page',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        published: z.boolean(),
        date: z.date(),
        slug: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    }),
  }
})
