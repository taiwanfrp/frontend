import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import nginx from 'highlight.js/lib/languages/nginx'
import powershell from 'highlight.js/lib/languages/powershell'

// common 只包含常用語言, 另外補上使用者常貼的設定檔與指令
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('nginx', nginx)
hljs.registerLanguage('powershell', powershell)

// 依照 Discord 支援的 Markdown 語法設定, 讓網頁與 Discord 顯示結果一致
// html: false 會跳脫原始 HTML, 因此輸出可以安全地用 v-html 顯示
const md = new MarkdownIt({
	html: false,
	breaks: true,
	linkify: true,
	// 與 Discord 相同, 只有標明語言的程式碼區塊才上色; 回傳空字串時 markdown-it 會自行跳脫內容
	highlight: (code, lang) => {
		if (!lang || !hljs.getLanguage(lang)) return ''
		return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
	},
})

// Discord 只會自動連結有 http(s):// 的網址
md.linkify.set({ fuzzyLink: false, fuzzyEmail: false })

// 停用 Discord 不支援的語法: 表格、縮排程式碼、分隔線、底線式標題、參考連結、圖片
md.disable(['table', 'code', 'hr', 'lheading', 'reference', 'image'])

// Discord 只支援 # ~ ###, 更多層的 # 會照原樣顯示
md.core.ruler.after('block', 'discord_heading_levels', (state) => {
	const tokens = state.tokens
	for (let i = 0; i < tokens.length; i++) {
		const open = tokens[i]!
		if (open.type !== 'heading_open' || Number(open.tag.slice(1)) <= 3) continue

		const inline = tokens[i + 1]!
		const close = tokens[i + 2]!
		inline.content = `${open.markup} ${inline.content}`
		open.type = 'paragraph_open'
		open.tag = 'p'
		close.type = 'paragraph_close'
		close.tag = 'p'
	}
})

// -# 小字
md.block.ruler.before('paragraph', 'discord_subtext', (state, startLine, _endLine, silent) => {
	const start = state.bMarks[startLine]! + state.tShift[startLine]!
	const line = state.src.slice(start, state.eMarks[startLine])
	if (!line.startsWith('-# ')) return false
	if (silent) return true

	const open = state.push('paragraph_open', 'p', 1)
	open.attrSet('class', 'md-subtext')
	open.map = [startLine, startLine + 1]

	const inline = state.push('inline', '', 0)
	inline.content = line.slice(3).trim()
	inline.map = [startLine, startLine + 1]
	inline.children = []

	state.push('paragraph_close', 'p', -1)
	state.line = startLine + 1
	return true
}, { alt: ['paragraph'] })

// 內建的 text 規則不會在 | 停下來, 導致 ||防雷|| 被當成一般文字吃掉
// 這裡沿用內建的停止字元, 再加上 |
const TEXT_TERMINATORS = new Set('\n!#$%&*+-:<=@[\\]^_`{}~|')

md.inline.ruler.at('text', (state, silent) => {
	let pos = state.pos
	while (pos < state.posMax && !TEXT_TERMINATORS.has(state.src[pos]!)) pos++
	if (pos === state.pos) return false

	if (!silent) state.pending += state.src.slice(state.pos, pos)
	state.pos = pos
	return true
})

// ||防雷||
md.inline.ruler.before('emphasis', 'discord_spoiler', (state, silent) => {
	const start = state.pos
	if (!state.src.startsWith('||', start)) return false

	const end = state.src.indexOf('||', start + 2)
	if (end === -1 || end > state.posMax || end === start + 2) return false

	if (!silent) {
		state.push('spoiler_open', 'span', 1).attrSet('class', 'md-spoiler')
		const oldPosMax = state.posMax
		state.pos = start + 2
		state.posMax = end
		state.md.inline.tokenize(state)
		state.posMax = oldPosMax
		state.push('spoiler_close', 'span', -1)
	}

	state.pos = end + 2
	return true
})

// <t:秒數> 或 <t:秒數:格式> 時間戳, 依觀看者的時區顯示
const TIMESTAMP_FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
	t: { hour: '2-digit', minute: '2-digit' },
	T: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
	d: { year: 'numeric', month: '2-digit', day: '2-digit' },
	D: { year: 'numeric', month: 'long', day: 'numeric' },
	f: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
	F: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' },
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 86400],
	['month', 30 * 86400],
	['day', 86400],
	['hour', 3600],
	['minute', 60],
	['second', 1],
]

const formatTimestamp = (date: Date, style: string) => {
	if (style !== 'R') return date.toLocaleString('zh-Hant', TIMESTAMP_FORMATS[style])

	const diffSeconds = (date.getTime() - Date.now()) / 1000
	const rtf = new Intl.RelativeTimeFormat('zh-Hant', { numeric: 'auto' })
	const [unit, seconds] = RELATIVE_UNITS.find(([, seconds]) => Math.abs(diffSeconds) >= seconds) ?? ['second', 1]
	return rtf.format(Math.round(diffSeconds / seconds), unit)
}

md.inline.ruler.before('autolink', 'discord_timestamp', (state, silent) => {
	const match = /^<t:(-?\d{1,13})(?::([tTdDfFR]))?>/.exec(state.src.slice(state.pos, state.posMax))
	if (!match) return false

	const date = new Date(Number(match[1]) * 1000)
	if (Number.isNaN(date.getTime())) return false

	if (!silent) {
		const token = state.push('discord_timestamp', 'time', 0)
		token.meta = { date, style: match[2] ?? 'f' }
	}

	state.pos += match[0].length
	return true
})

md.renderer.rules.discord_timestamp = (tokens, idx) => {
	const { date, style } = tokens[idx]!.meta as { date: Date, style: string }
	const escape = md.utils.escapeHtml
	return `<time class="md-timestamp" datetime="${date.toISOString()}" title="${escape(formatTimestamp(date, 'F'))}">${escape(formatTimestamp(date, style))}</time>`
}

// Discord 的 __文字__ 是底線, **文字** 才是粗體
md.renderer.rules.strong_open = (tokens, idx, options, _env, self) =>
	tokens[idx]!.markup === '__' ? '<u>' : self.renderToken(tokens, idx, options)
md.renderer.rules.strong_close = (tokens, idx, options, _env, self) =>
	tokens[idx]!.markup === '__' ? '</u>' : self.renderToken(tokens, idx, options)

// 連結一律開新分頁
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
	tokens[idx]!.attrSet('target', '_blank')
	tokens[idx]!.attrSet('rel', 'noopener noreferrer')
	return self.renderToken(tokens, idx, options)
}

// 把 Discord 的引用規則轉成標準 Markdown:
// - >>> 之後的所有內容都是引用
// - > 只引用該行, 下一行不是 > 開頭就結束引用 (標準 Markdown 會延續到下一行)
const normalizeQuotes = (text: string) => {
	const result: string[] = []
	let inMultiQuote = false

	for (const line of text.split('\n')) {
		if (inMultiQuote) {
			result.push(`> ${line}`)
			continue
		}
		if (line.startsWith('>>> ')) {
			inMultiQuote = true
			result.push(`> ${line.slice(4)}`)
			continue
		}

		const previous = result.at(-1)
		if (previous?.startsWith('> ') && !line.startsWith('> ') && line.trim()) {
			result.push('')
		}
		result.push(line)
	}

	return result.join('\n')
}

export const renderDiscordMarkdown = (text: string) => md.render(normalizeQuotes(text))
