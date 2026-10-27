import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import pkg from './package.json' with { type: 'json' }

// 取得檔案最後一次 git commit 的時間, 供 sitemap 的 lastmod 使用, 傳入多個檔案時取最新的
// 尚未 commit 的新檔案改用檔案修改時間; 無法執行 git 時回傳 undefined
const getGitLastmod = (...files: string[]) => {
	const paths = files.map(file => resolve(import.meta.dirname, file))
	try {
		const date = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], { encoding: 'utf8' }).trim()
		return date || new Date(Math.max(...paths.map(path => statSync(path).mtimeMs))).toISOString()
	}
	catch {
		return undefined
	}
}

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
		// 官網首頁使用 SSG, sitemap 的 lastmod 取頁面與該語系翻譯檔中較新的 git commit 時間
		'/': { prerender: true, sitemap: { lastmod: getGitLastmod('app/pages/index.vue', 'i18n/locales/zh-Hant.json') } },
		'/zh-Hans': { sitemap: { lastmod: getGitLastmod('app/pages/index.vue', 'i18n/locales/zh-Hans.json') } },
		'/en-US': { sitemap: { lastmod: getGitLastmod('app/pages/index.vue', 'i18n/locales/en-US.json') } },
		// 服務條款與隱私權政策使用 SSG, 內容來自 content/legal, lastmod 取各語系 .md 的 git commit 時間
		'/terms': { prerender: true, sitemap: { lastmod: getGitLastmod('content/legal/zh-Hant/terms.md') } },
		'/privacy': { prerender: true, sitemap: { lastmod: getGitLastmod('content/legal/zh-Hant/privacy.md') } },
		'/zh-Hans/terms': { prerender: true, sitemap: { lastmod: getGitLastmod('content/legal/zh-Hans/terms.md') } },
		'/zh-Hans/privacy': { prerender: true, sitemap: { lastmod: getGitLastmod('content/legal/zh-Hans/privacy.md') } },
		'/en-US/terms': { prerender: true, sitemap: { lastmod: getGitLastmod('content/legal/en-US/terms.md') } },
		'/en-US/privacy': { prerender: true, sitemap: { lastmod: getGitLastmod('content/legal/en-US/privacy.md') } },
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
	sitemap: {
		// 需要登入的頁面搜尋引擎爬不到內容, 不列入 sitemap
		exclude: ['/dashboard/**', '/tickets/**', '/profile', '/*/dashboard/**', '/*/tickets/**', '/*/profile'],
	},
})
