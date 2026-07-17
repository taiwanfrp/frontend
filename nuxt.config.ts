// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

	modules: [
		'@nuxt/eslint',
		'@nuxt/image',
		'@nuxt/ui',
		'@formkit/auto-animate',
		'@nuxtjs/i18n',
		'@nuxtjs/sitemap',
	],
	devtools: { enabled: true },

	css: ['@/assets/css/main.css'],
	colorMode: {
		preference: 'system',
		fallback: 'light',
		classSuffix: '',
	},
	routeRules: {
		'/': { prerender: true },	// 官網首頁使用 SSG
		'/dash/**': { ssr: false },	// Dash 相關頁面使用 CSR
	},
	compatibilityDate: '2025-07-15',
	eslint: {
		config: {
			stylistic: {
				indent: 'tab',
				quotes: 'single',
				semi: false,
			},
		},
	},
	i18n: {
		defaultLocale: 'zh-Hant',
		locales: [
			{ code: 'zh-Hant', name: '正體中文', file: 'zh-Hant.json' },
			{ code: 'zh-Hans', name: '简体中文', file: 'zh-Hans.json' },
			{ code: 'en-US', name: 'English', file: 'en-US.json' },
		],
	},
})
