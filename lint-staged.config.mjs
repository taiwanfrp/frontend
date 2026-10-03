export default {
	'*.{js,ts,vue}': 'eslint --fix',
	// 翻譯檔有改動時檢查全部語系與程式碼: 語系間缺少的 key 會回報在「有該 key」的語系檔,
	// 程式用到但翻譯檔沒有的 key 會回報在 .vue/.ts, 只檢查改動的檔案會漏掉
	'i18n/locales/*.json': () => 'eslint app i18n/locales',
}
