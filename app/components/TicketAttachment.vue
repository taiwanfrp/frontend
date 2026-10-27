<script setup lang="ts">
const props = defineProps<{
	attachment: TicketAttachment
}>()

const { t } = useI18n()
const { getAttachment } = useTickets()

// presigned URL 預設 10 分鐘過期, 過期前一點就重新取得
const URL_MAX_AGE = 8 * 60 * 1000

const url = ref(props.attachment.download_url)
const fetchedAt = ref(Date.now())
const isRefreshing = ref(false)

watch(() => props.attachment.download_url, (value) => {
	url.value = value
	fetchedAt.value = Date.now()
})

const kind = computed(() => {
	const type = props.attachment.content_type ?? ''
	// SVG 裡面可以放 script, 跟 bot 一樣一律當成檔案下載
	if (type.startsWith('image/') && type !== 'image/svg+xml') return 'image'
	if (type.startsWith('video/')) return 'video'
	return 'file'
})

const statusText = computed(() => ({
	pending: t('tickets.attachment.pending'),
	done: '',
	rejected: t('tickets.attachment.rejected'),
	failed: t('tickets.attachment.failed'),
})[props.attachment.status])

const refresh = async () => {
	if (isRefreshing.value) return
	isRefreshing.value = true
	try {
		url.value = (await getAttachment(props.attachment.id)).download_url
		fetchedAt.value = Date.now()
	}
	catch (error) {
		console.error('Refresh attachment url failed:', error)
	}
	finally {
		isRefreshing.value = false
	}
}

// 圖片載入失敗時 (網址過期) 只重新取得一次, 避免一直重試
const imageRetried = ref(false)
const onImageError = () => {
	if (imageRetried.value) return
	imageRetried.value = true
	refresh()
}

// 影片播放中網址過期時, 拖動進度條或繼續緩衝會失敗, 重新取得網址後從原本的位置繼續播放
const video = useTemplateRef<HTMLVideoElement>('video')
let resumeAt = 0
const onVideoError = async () => {
	resumeAt = video.value?.currentTime ?? 0
	await refresh()
}
const onVideoLoaded = () => {
	if (video.value && resumeAt) {
		video.value.currentTime = resumeAt
		resumeAt = 0
	}
}

// 開新分頁前確認網址還沒過期, 過期的話先開空白分頁 (避免被擋), 取得新網址後再導過去
const openFile = async (event: MouseEvent) => {
	if (url.value && Date.now() - fetchedAt.value < URL_MAX_AGE) return
	event.preventDefault()
	const tab = window.open('', '_blank')
	await refresh()
	if (tab && url.value) tab.location.href = url.value
	else tab?.close()
}
</script>

<template>
	<div class="max-w-full">
		<!-- 還不能顯示: 處理中, 被拒絕, 失敗 -->
		<div
			v-if="attachment.status !== 'done' || !url"
			class="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm"
		>
			<UIcon
				:name="attachment.status === 'pending' ? 'i-heroicons-arrow-path' : 'i-heroicons-exclamation-triangle'"
				class="w-4 h-4 shrink-0"
				:class="attachment.status === 'pending' ? 'animate-spin text-gray-400' : 'text-error-500'"
			/>
			<span class="truncate text-gray-700 dark:text-gray-200">{{ attachment.filename }}</span>
			<span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">{{ statusText }}</span>
		</div>

		<a
			v-else-if="kind === 'image'"
			:href="url"
			target="_blank"
			rel="noopener"
			class="block w-fit"
			@click="openFile"
		>
			<img
				:src="url"
				:alt="attachment.filename"
				class="max-h-72 max-w-full rounded-lg border border-gray-200 dark:border-gray-800 object-contain"
				loading="lazy"
				@error="onImageError"
			>
		</a>

		<video
			v-else-if="kind === 'video'"
			ref="video"
			:src="url"
			controls
			preload="metadata"
			class="max-h-80 max-w-full rounded-lg border border-gray-200 dark:border-gray-800"
			@error="onVideoError"
			@loadedmetadata="onVideoLoaded"
		/>

		<a
			v-else
			:href="url"
			target="_blank"
			rel="noopener"
			class="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm hover:bg-gray-900/5 dark:hover:bg-white/5 transition-colors"
			@click="openFile"
		>
			<UIcon
				name="i-heroicons-document"
				class="w-4 h-4 shrink-0 text-gray-400"
			/>
			<span class="truncate font-medium text-primary-600 dark:text-primary-400">{{ attachment.filename }}</span>
			<span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">{{ formatFileSize(attachment.size) }}</span>
		</a>

		<!-- 編輯 Discord 訊息時被移除的附件, 只有客服看得到 -->
		<p
			v-if="attachment.removed_at"
			class="mt-1 text-xs text-gray-500 dark:text-gray-400"
		>
			{{ $t('tickets.attachment.removed') }}
		</p>
	</div>
</template>
