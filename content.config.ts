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
      source: 'articles/*',
      type: 'page',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        published: z.date().optional(),
        slug: z.string().optional(),
      })
    }),
  }
})
