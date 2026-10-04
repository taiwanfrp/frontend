import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
	collections: {
		// 服務條款與隱私權政策, 路徑為 content/legal/<語系>/<頁面>.md
		legal: defineCollection({
			type: 'page',
			source: 'legal/**/*.md',
			schema: z.object({
				updatedAt: z.date(),
			}),
		}),
	},
})
