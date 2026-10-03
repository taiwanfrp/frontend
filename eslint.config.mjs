// @ts-check
import vueI18n from '@intlify/eslint-plugin-vue-i18n'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
	// i18n 翻譯檢查: 程式用到但翻譯檔沒有的 key, 以及各語系之間缺少的 key
	...vueI18n.configs.base,
	{
		settings: {
			'vue-i18n': {
				localeDir: './i18n/locales/*.json',
				messageSyntaxVersion: '^11.0.0',
			},
		},
		rules: {
			'@intlify/vue-i18n/no-missing-keys': 'error',
			'@intlify/vue-i18n/no-missing-keys-in-other-locales': 'error',
			'@intlify/vue-i18n/no-unused-keys': ['warn', { src: './app', extensions: ['.vue', '.ts'] }],
		},
	},
)
