import pkg from './package.json' with { type: 'json' }

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

	modules: [
		'@nuxt/eslint',
		'@nuxt/image',
		'@nuxt/ui',
		'@nuxt/content',
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
	content: {
		experimental: {
			// 使用 Node.js 內建的 node:sqlite (Node 22.13+), 不需要另外安裝 better-sqlite3
			sqliteConnector: 'native',
		},
	},
	runtimeConfig: {
		public: {
			version: pkg.version,
			apiUrl: '',
			discordUrl: '',
		},
	},
	routeRules: {
		'/': { prerender: true },	// 官網首頁使用 SSG
		'/terms': { prerender: true },	// 服務條款與隱私權政策使用 SSG, 內容來自 content/legal
		'/privacy': { prerender: true },
		'/zh-Hans/terms': { prerender: true },
		'/zh-Hans/privacy': { prerender: true },
		'/en-US/terms': { prerender: true },
		'/en-US/privacy': { prerender: true },
		'/dashboard/**': { ssr: false },	// Dashboard 相關頁面使用 CSR
		'/tickets/**': { ssr: false },	// 工單頁面使用 CSR
		'/*/dashboard/**': { ssr: false },	// 有語系前綴的網址 (/en-US/..., /zh-Hans/...)
		'/*/tickets/**': { ssr: false },
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
		compilation: {
			strictMessage: false,
		},
	},
})
