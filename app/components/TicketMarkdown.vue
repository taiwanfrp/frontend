<script setup lang="ts">
const props = defineProps<{
	content: string
}>()

const html = computed(() => renderDiscordMarkdown(props.content))

// 點擊防雷內容後顯示, 尚未顯示前點到裡面的連結不會跳轉
const revealSpoiler = (event: MouseEvent) => {
	const spoiler = (event.target as HTMLElement).closest('.md-spoiler')
	if (!spoiler || spoiler.classList.contains('is-revealed')) return

	event.preventDefault()
	spoiler.classList.add('is-revealed')
}
</script>

<template>
	<!-- eslint-disable vue/no-v-html -- markdown-it 設定 html: false, 原始 HTML 會被跳脫 -->
	<div
		class="discord-md"
		@click="revealSpoiler"
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
.discord-md p + pre,
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

.discord-md pre {
	background-color: var(--ui-bg-elevated);
	border: 1px solid var(--ui-border);
	border-radius: 6px;
	padding: 0.5em 0.75em;
	margin: 0.25em 0;
	overflow-x: auto;
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
