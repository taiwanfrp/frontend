<script setup lang="ts">
const props = defineProps<{
	content: string
}>()

const html = computed(() => renderDiscordMarkdown(props.content))

// navigator.clipboard 只在 HTTPS 或 localhost 下存在, 其他情況改用 execCommand
const copyText = async (text: string) => {
	if (navigator.clipboard && window.isSecureContext) {
		await navigator.clipboard.writeText(text)
		return
	}

	const textarea = document.createElement('textarea')
	textarea.value = text
	textarea.setAttribute('readonly', '')
	textarea.style.position = 'fixed'
	textarea.style.opacity = '0'
	document.body.appendChild(textarea)
	textarea.select()
	const copied = document.execCommand('copy')
	textarea.remove()
	if (!copied) throw new Error('copy failed')
}

// 複製程式碼區塊, 失敗時改為選取內容讓使用者自行複製
const copyCodeBlock = async (button: HTMLElement) => {
	const code = button.parentElement?.querySelector('code')
	if (!code) return

	try {
		await copyText((code.textContent ?? '').replace(/\n$/, ''))
		button.classList.add('is-copied')
		button.title = '已複製'
		setTimeout(() => {
			button.classList.remove('is-copied')
			button.title = '複製'
		}, 2000)
	}
	catch {
		window.getSelection()?.selectAllChildren(code)
	}
}

// 點擊防雷內容後顯示, 尚未顯示前點到裡面的連結不會跳轉
const revealSpoiler = (event: MouseEvent, spoiler: HTMLElement) => {
	if (spoiler.classList.contains('is-revealed')) return

	event.preventDefault()
	spoiler.classList.add('is-revealed')
}

const handleClick = (event: MouseEvent) => {
	const target = event.target as HTMLElement

	const copyButton = target.closest<HTMLElement>('.md-copy')
	if (copyButton) return copyCodeBlock(copyButton)

	const spoiler = target.closest<HTMLElement>('.md-spoiler')
	if (spoiler) revealSpoiler(event, spoiler)
}
</script>

<template>
	<!-- eslint-disable vue/no-v-html -- markdown-it 設定 html: false, 原始 HTML 會被跳脫 -->
	<div
		class="discord-md"
		@click="handleClick"
		v-html="html"
	/>
	<!-- eslint-enable vue/no-v-html -->
</template>

<style>
.discord-md {
	overflow-wrap: anywhere;
}

.discord-md p + p,
.discord-md p + ul,
.discord-md p + ol,
.discord-md p + .md-codeblock,
.discord-md p + blockquote {
	margin-top: 0.5em;
}

.discord-md h1,
.discord-md h2,
.discord-md h3 {
	font-weight: 700;
	line-height: 1.3;
	margin: 0.5em 0 0.25em;
}

.discord-md h1 { font-size: 1.5em; }
.discord-md h2 { font-size: 1.25em; }
.discord-md h3 { font-size: 1.1em; }

.discord-md > :first-child {
	margin-top: 0;
}

.discord-md ul,
.discord-md ol {
	padding-left: 1.5em;
	margin: 0.25em 0;
}

.discord-md ul { list-style: disc; }
.discord-md ol { list-style: decimal; }

.discord-md blockquote {
	border-left: 4px solid var(--ui-border-accented);
	padding-left: 0.75em;
	margin: 0.25em 0;
}

.discord-md a {
	color: var(--ui-primary);
}

.discord-md a:hover {
	text-decoration: underline;
}

/* main.css 的 * 會直接套用到上色用的 span, 需要一併指定等寬字型 */
.discord-md code,
.discord-md code * {
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.discord-md code {
	font-size: 0.875em;
	background-color: var(--ui-bg-elevated);
	padding: 0.1em 0.3em;
	border-radius: 4px;
}

.discord-md .md-codeblock {
	position: relative;
	margin: 0.25em 0;
}

.discord-md pre {
	background-color: var(--ui-bg-elevated);
	border: 1px solid var(--ui-border);
	border-radius: 6px;
	padding: 0.5em 0.75em;
	overflow-x: auto;
}

/* 複製按鈕: 滑鼠移入程式碼區塊才顯示, 觸控裝置沒有 hover 所以一直顯示 */
.discord-md .md-copy {
	position: absolute;
	top: 0.25rem;
	right: 0.25rem;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.625rem;
	height: 1.625rem;
	border: 1px solid var(--ui-border);
	border-radius: 6px;
	background-color: var(--ui-bg);
	color: var(--ui-text-muted);
	cursor: pointer;
	opacity: 0;
	transition: opacity 0.15s, color 0.15s, background-color 0.15s;
}

.discord-md .md-codeblock:hover .md-copy,
.discord-md .md-copy:focus-visible,
.discord-md .md-copy.is-copied {
	opacity: 1;
}

@media (hover: none) {
	.discord-md .md-copy {
		opacity: 1;
	}
}

.discord-md .md-copy:hover {
	color: var(--ui-text-highlighted);
	background-color: var(--ui-bg-elevated);
}

.discord-md .md-copy svg {
	width: 0.875rem;
	height: 0.875rem;
}

.discord-md .md-copy .md-copy-check,
.discord-md .md-copy.is-copied .md-copy-icon {
	display: none;
}

.discord-md .md-copy.is-copied .md-copy-check {
	display: block;
	color: var(--ui-success);
}

.discord-md pre code {
	background-color: transparent;
	padding: 0;
}

/* 程式碼上色 (highlight.js), 配色參考 GitHub */
.discord-md {
	--hl-keyword: #cf222e;
	--hl-string: #0a3069;
	--hl-number: #0550ae;
	--hl-comment: #6e7781;
	--hl-title: #8250df;
	--hl-builtin: #953800;
	--hl-tag: #116329;
	--hl-addition-bg: #dafbe1;
	--hl-deletion-bg: #ffebe9;
}

.dark .discord-md {
	--hl-keyword: #ff7b72;
	--hl-string: #a5d6ff;
	--hl-number: #79c0ff;
	--hl-comment: #8b949e;
	--hl-title: #d2a8ff;
	--hl-builtin: #ffa657;
	--hl-tag: #7ee787;
	--hl-addition-bg: #033a16;
	--hl-deletion-bg: #67060c;
}

.discord-md .hljs-keyword,
.discord-md .hljs-type,
.discord-md .hljs-selector-tag,
.discord-md .hljs-meta .hljs-keyword {
	color: var(--hl-keyword);
}

.discord-md .hljs-string,
.discord-md .hljs-regexp,
.discord-md .hljs-meta .hljs-string {
	color: var(--hl-string);
}

.discord-md .hljs-number,
.discord-md .hljs-literal,
.discord-md .hljs-symbol,
.discord-md .hljs-attr,
.discord-md .hljs-attribute,
.discord-md .hljs-meta,
.discord-md .hljs-selector-attr,
.discord-md .hljs-selector-class,
.discord-md .hljs-selector-id,
.discord-md .hljs-operator {
	color: var(--hl-number);
}

.discord-md .hljs-comment,
.discord-md .hljs-doctag {
	color: var(--hl-comment);
	font-style: italic;
}

.discord-md .hljs-title,
.discord-md .hljs-section {
	color: var(--hl-title);
}

.discord-md .hljs-built_in,
.discord-md .hljs-variable,
.discord-md .hljs-template-variable,
.discord-md .hljs-property {
	color: var(--hl-builtin);
}

.discord-md .hljs-name,
.discord-md .hljs-tag,
.discord-md .hljs-bullet {
	color: var(--hl-tag);
}

.discord-md .hljs-addition {
	color: var(--hl-tag);
	background-color: var(--hl-addition-bg);
}

.discord-md .hljs-deletion {
	color: var(--hl-keyword);
	background-color: var(--hl-deletion-bg);
}

.discord-md .md-timestamp {
	background-color: var(--ui-bg-elevated);
	border-radius: 4px;
	padding: 0 0.2em;
}

.discord-md .md-subtext {
	font-size: 0.75em;
	color: var(--ui-text-muted);
}

.discord-md .md-spoiler {
	border-radius: 4px;
	padding: 0 0.15em;
	background-color: var(--ui-bg-accented);
	transition: background-color 0.15s;
}

.discord-md .md-spoiler:not(.is-revealed) {
	cursor: pointer;
	color: transparent;
	background-color: var(--ui-text-dimmed);
}

.discord-md .md-spoiler:not(.is-revealed) * {
	color: transparent;
	background-color: transparent;
}
</style>
