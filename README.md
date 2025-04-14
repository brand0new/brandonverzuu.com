# brandonverzuu.com

This version of my site has been created with Nuxt!

Previously I've worked with Hugo to generate a statically hosted site on AWS. But since I've been working Vuetify and experimenting with Nuxt I thought I'd give Nuxt a try for hosting my personal site.

Template is blatantly stolen from the Nuxt Content gallery and tweaked to fit my own needs.

All credits go out to (the creator of this template)[https://github.com/fayazara/zooper] 

## Development

To develop locally use

```bash
$ npm run dev
```

To deploy static site to Cloudflare use a manual deploy to the Pages Worker

```bash
$ npx wrangler pages deploy ./.output/public
```