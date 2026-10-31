<script setup lang="ts">
definePageMeta({
	layout: 'tickets',
})

// 與 bot 的限制相同
const REPLY_MAX = 2000
const ATTACHMENTS_MAX = 10
const CLOSE_REASON_MAX = 1000
const FEEDBACK_MAX = 1000
const PAGE_SIZE = 50
const EXPORT_POLL_INTERVAL = 2000

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const {
	me,
	fetchMe,
	isStaff,
	listCategories,
	getTicket,
	listMessages,
	getMessage,
	sendMessage,
	closeTicket,
	claimTicket,
	unclaimTicket,
	rateTicket,
	createExport,
	getExport,
	removeAttachment,
	uploadAttachment,
	subscribeTicket,
} = useTickets()

const ticketId = Number(route.params.id)

const ticket = ref<TicketDetail | null>(null)
const category = ref<TicketCategory | null>(null)
const messages = ref<TicketMessage[]>([])
// 客服單裡每個人的快照, 訊息與客服單的 Discord ID 都對應到這裡
const users = ref<Record<string, TicketUser>>({})
const isLoading = ref(true)
const isNotFound = ref(false)
const hasOlder = ref(false)
const isLoadingOlder = ref(false)

const showError = (title: string, error: unknown) => {
	toast.add({
		title,
		description: ticketErrorMessage(error) || t('tickets.common.try_again'),
		color: 'error',
		icon: 'i-heroicons-x-circle',
	})
}

const mergeUsers = (list: TicketUser[]) => {
	for (const user of list) users.value[user.id] = user
}

// 依照 id 合併 (重複收到同一則時以新的為準), 保持舊的在前面
const upsertMessages = (list: TicketMessage[]) => {
	const byId = new Map(messages.value.map(message => [message.id, message]))
	for (const message of list) byId.set(message.id, message)
	messages.value = [...byId.values()].sort((a, b) => a.id - b.id)
}

const loadTicket = async () => {
	ticket.value = await getTicket(ticketId)
	mergeUsers(ticket.value.users)
}

const loadLatest = async () => {
	const page = await listMessages(ticketId, { limit: PAGE_SIZE })
	mergeUsers(page.users)
	messages.value = page.messages
	hasOlder.value = page.messages.length === PAGE_SIZE
}

const loadOlder = async () => {
	const first = messages.value[0]
	if (!first) return
	isLoadingOlder.value = true
	try {
		const page = await listMessages(ticketId, { before: first.id, limit: PAGE_SIZE })
		mergeUsers(page.users)
		upsertMessages(page.messages)
		hasOlder.value = page.messages.length === PAGE_SIZE
	}
	catch (error: unknown) {
		showError(t('tickets.detail.load_failed'), error)
	}
	finally {
		isLoadingOlder.value = false
	}
}

// 取得最後一則之後的新訊息
const loadNewer = async () => {
	for (;;) {
		const last = messages.value.at(-1)
		const page = await listMessages(ticketId, { after: last?.id, limit: PAGE_SIZE })
		mergeUsers(page.users)
		upsertMessages(page.messages)
		if (page.messages.length < PAGE_SIZE) return
	}
}

const reloadMessage = async (messageId: number) => {
	try {
		const page = await getMessage(ticketId, messageId)
		mergeUsers(page.users)
		upsertMessages(page.messages)
	}
	catch (error) {
		console.error('Reload ticket message failed:', error)
	}
}

const refresh = async () => {
	isLoading.value = true
	try {
		await Promise.all([loadTicket(), loadLatest()])
	}
	catch (error: unknown) {
		// 沒有權限看的客服單也是 404
		if ((error as { statusCode?: number }).statusCode === 404) isNotFound.value = true
		else showError(t('tickets.detail.load_failed'), error)
	}
	finally {
		isLoading.value = false
	}
}

const onEvent = (event: TicketEvent) => {
	const messageId = Number(event.data?.message_id) || null
	if (event.type === 'message.created') {
		loadNewer().catch(error => console.error('Load new messages failed:', error))
	}
	else if (event.type === 'message.updated' || event.type === 'message.deleted') {
		if (messageId) reloadMessage(messageId)
	}
	else if (event.type === 'attachment.updated') {
		// 已經送出的附件: 重新取得訊息; 還沒送出的: 更新上傳清單裡的狀態
		if (messageId) reloadMessage(messageId)
		else updateUploadStatus(Number(event.data?.attachment_id), event.data?.status as TicketAttachmentStatus)
	}
	else {
		loadTicket().catch(error => console.error('Reload ticket failed:', error))
	}
}

let unsubscribe: (() => void) | undefined

whenLoggedIn(async () => {
	if (!Number.isInteger(ticketId)) {
		isNotFound.value = true
		isLoading.value = false
		return
	}
	await refresh()
	if (isNotFound.value) return

	// 重新連線時可能漏掉事件, 重新載入
	unsubscribe = subscribeTicket(ticketId, onEvent, () => {
		Promise.all([loadTicket(), loadNewer()]).catch(error => console.error('Reload ticket failed:', error))
	})
	try {
		const [, categories] = await Promise.all([fetchMe(), listCategories()])
		category.value = categories.find(item => item.id === ticket.value?.category_id) ?? null
	}
	catch (error) {
		console.error('Fetch ticket me or categories failed:', error)
	}
})

let isUnmounted = false

onBeforeUnmount(() => {
	isUnmounted = true
	unsubscribe?.()
})

const isOpen = computed(() => ticket.value?.status === 'open')
const isOpener = computed(() => !!me.value && me.value.id === ticket.value?.opener_id)
const isTicketStaff = computed(() => !!ticket.value && isStaff(ticket.value.category_id))

const canClaim = computed(() => isOpen.value && !ticket.value?.claimed_by_id && isTicketStaff.value && !!me.value?.in_guild)
const canUnclaim = computed(() => isOpen.value && !!me.value && ticket.value?.claimed_by_id === me.value.id)
const canClose = computed(() => isOpen.value && (isOpener.value || isTicketStaff.value))
const canExport = computed(() => isOpener.value || isTicketStaff.value)
const canRate = computed(() => ticket.value?.status === 'closed' && isOpener.value && ticket.value.rating === null)

const discordChannelUrl = computed(() => {
	if (!isOpen.value || !ticket.value?.channel_id || !me.value?.in_guild) return null
	return `https://discord.com/channels/${me.value.guild_id}/${ticket.value.channel_id}`
})

const userOf = (id: string | null) => (id ? users.value[id] ?? null : null)

const roleColor = (user: TicketUser | null) =>
	user?.role_color ? `#${user.role_color.toString(16).padStart(6, '0')}` : undefined

const sourceMeta = computed(() => ({
	web: { icon: 'i-heroicons-globe-alt', label: t('tickets.source.web') },
	discord: { icon: 'i-simple-icons-discord', label: t('tickets.source.discord') },
}))

// 接手, 取消接手
const isClaiming = ref(false)
const toggleClaim = async () => {
	isClaiming.value = true
	try {
		if (canClaim.value) await claimTicket(ticketId)
		else await unclaimTicket(ticketId)
		await loadTicket()
	}
	catch (error: unknown) {
		showError(t('tickets.detail.action_failed'), error)
	}
	finally {
		isClaiming.value = false
	}
}

// 匯出: bot 在背景產生檔案, 定時查詢, 完成後直接下載 (S3 的網址會讓瀏覽器下載, 不會離開這一頁)
const isExporting = ref(false)
const startExport = async () => {
	isExporting.value = true
	try {
		let result = await createExport(ticketId)
		while (result.status === 'pending') {
			await new Promise(resolve => setTimeout(resolve, EXPORT_POLL_INTERVAL))
			if (isUnmounted) return
			result = await getExport(result.id)
		}
		if (result.status !== 'done' || !result.download_url) throw new Error(`Export ${result.id} failed`)
		window.location.assign(result.download_url)
	}
	catch (error: unknown) {
		showError(t('tickets.detail.export_failed'), error)
	}
	finally {
		isExporting.value = false
	}
}

// 附件: 選擇後馬上上傳 (直接傳到 S3), 送出訊息時附上 id
interface Upload {
	key: number
	file: File
	attachment: TicketAttachment | null
	progress: number
	isUploading: boolean
}

const uploads = ref<Upload[]>([])
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
let uploadKey = 0

const updateUploadStatus = (attachmentId: number, status: TicketAttachmentStatus) => {
	const upload = uploads.value.find(item => item.attachment?.id === attachmentId)
	if (upload?.attachment) upload.attachment = { ...upload.attachment, status }
}

const startUpload = async (file: File) => {
	const upload = reactive<Upload>({ key: uploadKey++, file, attachment: null, progress: 0, isUploading: true })
	uploads.value.push(upload)
	try {
		const attachment = await uploadAttachment(
			ticketId,
			file,
			(created) => {
				upload.attachment = created
			},
			(ratio) => {
				upload.progress = ratio
			},
		)
		upload.attachment = attachment
		upload.isUploading = false
	}
	catch (error: unknown) {
		showError(t('tickets.detail.upload_failed', { name: file.name }), error)
		uploads.value = uploads.value.filter(item => item.key !== upload.key)
		// 申請到網址後才失敗的, 移除已經建立的附件
		if (upload.attachment) removeAttachment(upload.attachment.id).catch(() => undefined)
	}
}

const pickFiles = (event: Event) => {
	const input = event.target as HTMLInputElement
	const files = [...(input.files ?? [])]
	input.value = ''
	const room = ATTACHMENTS_MAX - uploads.value.length
	if (files.length > room) {
		toast.add({ title: t('tickets.detail.too_many_attachments', { max: ATTACHMENTS_MAX }), color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
	}
	for (const file of files.slice(0, Math.max(room, 0))) startUpload(file)
}

const discardUpload = async (upload: Upload) => {
	uploads.value = uploads.value.filter(item => item.key !== upload.key)
	if (!upload.attachment) return
	try {
		await removeAttachment(upload.attachment.id)
	}
	catch (error) {
		console.error('Remove attachment failed:', error)
	}
}

// 回覆
const reply = ref('')
const isReplying = ref(false)
const isUploading = computed(() => uploads.value.some(upload => upload.isUploading))
const canReply = computed(() =>
	!isUploading.value
	&& reply.value.length <= REPLY_MAX
	&& (!!reply.value.trim() || uploads.value.length > 0),
)

const submitReply = async () => {
	if (!canReply.value || isReplying.value) return

	isReplying.value = true
	try {
		await sendMessage(
			ticketId,
			reply.value.trim(),
			uploads.value.map(upload => upload.attachment!.id),
		)
		reply.value = ''
		uploads.value = []
		await loadNewer()
	}
	catch (error: unknown) {
		showError(t('tickets.detail.reply_failed'), error)
	}
	finally {
		isReplying.value = false
	}
}

// 關單
const isCloseModalOpen = ref(false)
const isClosing = ref(false)
const closeReason = ref('')

const confirmClose = async () => {
	isClosing.value = true
	try {
		await closeTicket(ticketId, closeReason.value.trim() || null)
		isCloseModalOpen.value = false
		closeReason.value = ''
		toast.add({ title: t('tickets.detail.closed'), color: 'success', icon: 'i-heroicons-check-circle' })
		await loadTicket()
	}
	catch (error: unknown) {
		showError(t('tickets.detail.close_failed'), error)
	}
	finally {
		isClosing.value = false
	}
}

// 評分
const rating = ref(0)
const feedback = ref('')
const isRating = ref(false)

const submitRating = async () => {
	if (!rating.value) return
	isRating.value = true
	try {
		await rateTicket(ticketId, rating.value, feedback.value.trim() || null)
		toast.add({ title: t('tickets.detail.rated'), color: 'success', icon: 'i-heroicons-check-circle' })
		await loadTicket()
	}
	catch (error: unknown) {
		showError(t('tickets.detail.rate_failed'), error)
	}
	finally {
		isRating.value = false
	}
}
</script>

<template>
	<div class="space-y-6">
		<NuxtLink
			:to="$localePath('/tickets')"
			class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
		>
			<UIcon
				name="i-heroicons-arrow-left"
				class="w-4 h-4"
			/>
			{{ $t('tickets.common.back_to_list') }}
		</NuxtLink>

		<!-- 載入中 -->
		<div
			v-if="isLoading && !ticket && !isNotFound"
			class="space-y-4"
		>
			<div class="h-8 w-2/3 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
			<div class="h-64 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
		</div>

		<!-- 找不到 -->
		<UCard
			v-else-if="!ticket"
			class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50"
		>
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<UIcon
					name="i-heroicons-question-mark-circle"
					class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
				/>
				<span class="text-base font-medium text-gray-900 dark:text-white">
					{{ $t('tickets.detail.not_found_title') }}
				</span>
				<span class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					{{ $t('tickets.detail.not_found_desc') }}
				</span>
			</div>
		</UCard>

		<template v-else>
			<!-- 標題列 -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
						<span class="font-mono">#{{ ticket.id }}</span>
						<TicketStatusBadge :status="displayStatus(ticket)" />
						<span v-if="category">
							<TicketEmoji
								v-if="category.emoji"
								:emoji="category.emoji"
								class="mr-1"
							/>
							{{ category.name }}
						</span>
					</div>
					<h1 class="mt-2 text-2xl font-bold text-gray-900 dark:text-white wrap-break-word">
						{{ ticket.subject }}
					</h1>
				</div>

				<div class="flex shrink-0 flex-wrap items-center gap-2">
					<UButton
						icon="i-heroicons-arrow-path"
						color="neutral"
						variant="ghost"
						:title="$t('tickets.common.refresh')"
						:loading="isLoading"
						@click="refresh()"
					/>
					<UButton
						v-if="discordChannelUrl"
						icon="i-simple-icons-discord"
						:label="$t('tickets.detail.open_in_discord')"
						color="neutral"
						variant="outline"
						:to="discordChannelUrl"
						target="_blank"
					/>
					<UButton
						v-if="canClaim || canUnclaim"
						:icon="canClaim ? 'i-heroicons-hand-raised' : 'i-heroicons-arrow-uturn-left'"
						:label="canClaim ? $t('tickets.detail.claim') : $t('tickets.detail.unclaim')"
						color="neutral"
						variant="outline"
						:loading="isClaiming"
						@click="toggleClaim"
					/>
					<UButton
						v-if="canExport"
						icon="i-heroicons-arrow-down-tray"
						:label="isExporting ? $t('tickets.detail.exporting') : $t('tickets.detail.export')"
						color="neutral"
						variant="outline"
						:loading="isExporting"
						:title="$t('tickets.detail.export_desc')"
						@click="startExport"
					/>
					<UButton
						v-if="canClose"
						icon="i-heroicons-lock-closed"
						:label="$t('tickets.detail.close')"
						color="error"
						variant="soft"
						@click="isCloseModalOpen = true"
					/>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<!-- 對話 -->
				<div class="space-y-6 lg:col-span-2">
					<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
						<template #header>
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">
								{{ $t('tickets.detail.conversation') }}
							</h2>
						</template>

						<div
							v-if="hasOlder"
							class="flex justify-center pb-5"
						>
							<UButton
								:label="$t('tickets.detail.load_older')"
								color="neutral"
								variant="soft"
								size="sm"
								:loading="isLoadingOlder"
								@click="loadOlder"
							/>
						</div>

						<ol class="space-y-5">
							<!-- 開單內容 (沒有更早的訊息時才顯示, 才不會跑到中間) -->
							<li
								v-if="!hasOlder"
								class="flex gap-3"
							>
								<img
									:src="userOf(ticket.opener_id) ? ticketAvatarUrl(userOf(ticket.opener_id)!) : ''"
									class="w-9 h-9 shrink-0 rounded-full object-cover"
									alt="Avatar"
								>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<span
											class="text-sm font-semibold text-gray-900 dark:text-white"
											:style="{ color: roleColor(userOf(ticket.opener_id)) }"
										>
											{{ userOf(ticket.opener_id) ? displayName(userOf(ticket.opener_id)!) : $t('tickets.detail.unknown_user') }}
										</span>
										<UBadge
											:label="$t('tickets.detail.opener')"
											color="neutral"
											variant="subtle"
											size="sm"
										/>
										<UIcon
											:name="sourceMeta[ticket.source].icon"
											:title="sourceMeta[ticket.source].label"
											class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500"
										/>
										<span
											class="text-xs text-gray-500 dark:text-gray-400"
											:title="formatDateTime(ticket.created_at)"
										>
											{{ formatRelativeTime(ticket.created_at) }}
										</span>
									</div>
									<TicketMarkdown
										:content="ticket.content"
										class="mt-1 text-sm text-gray-700 dark:text-gray-200"
									/>
								</div>
							</li>

							<li
								v-for="message in messages"
								:key="message.id"
								class="flex gap-3"
							>
								<img
									:src="userOf(message.author_id) ? ticketAvatarUrl(userOf(message.author_id)!) : ''"
									class="w-9 h-9 shrink-0 rounded-full object-cover"
									alt="Avatar"
								>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<span
											class="text-sm font-semibold text-gray-900 dark:text-white"
											:style="{ color: roleColor(userOf(message.author_id)) }"
										>
											{{ userOf(message.author_id) ? displayName(userOf(message.author_id)!) : $t('tickets.detail.unknown_user') }}
										</span>
										<UBadge
											v-if="message.author_id === ticket.opener_id"
											:label="$t('tickets.detail.opener')"
											color="neutral"
											variant="subtle"
											size="sm"
										/>
										<UBadge
											v-else-if="userOf(message.author_id)?.role_name"
											:label="userOf(message.author_id)!.role_name!"
											color="primary"
											variant="subtle"
											size="sm"
										/>
										<UIcon
											:name="sourceMeta[message.source].icon"
											:title="sourceMeta[message.source].label"
											class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500"
										/>
										<span
											class="text-xs text-gray-500 dark:text-gray-400"
											:title="formatDateTime(message.created_at)"
										>
											{{ formatRelativeTime(message.created_at) }}
										</span>
										<span
											v-if="message.edited_at && !message.deleted_at"
											class="text-xs text-gray-400 dark:text-gray-500"
											:title="formatDateTime(message.edited_at)"
										>
											{{ $t('tickets.detail.edited') }}
										</span>
									</div>

									<!-- 被刪除的訊息: 客服看得到原本的內容, 其他人只看到標記 -->
									<p
										v-if="message.deleted_at"
										class="mt-1 text-sm italic text-gray-500 dark:text-gray-400"
									>
										{{ message.content ? $t('tickets.detail.deleted_staff') : $t('tickets.detail.deleted') }}
									</p>
									<TicketMarkdown
										v-if="message.content"
										:content="message.content"
										class="mt-1 text-sm text-gray-700 dark:text-gray-200"
										:class="{ 'opacity-60 line-through decoration-gray-400': message.deleted_at }"
									/>

									<!-- 貼圖: Lottie 是 JSON 動畫, 目前只顯示名稱 -->
									<div
										v-if="message.stickers.length"
										class="mt-1 flex flex-wrap gap-2"
										:class="{ 'opacity-60': message.deleted_at }"
									>
										<template
											v-for="sticker in message.stickers"
											:key="sticker.id"
										>
											<img
												v-if="sticker.url && sticker.format !== 'lottie'"
												:src="sticker.url"
												:alt="sticker.name"
												:title="sticker.name"
												class="w-40 h-40 object-contain"
												loading="lazy"
											>
											<span
												v-else
												class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
											>
												<UIcon
													name="i-heroicons-face-smile"
													class="w-4 h-4 shrink-0"
												/>
												{{ $t('tickets.detail.sticker', { name: sticker.name }) }}
											</span>
										</template>
									</div>

									<div
										v-if="message.attachments.length"
										class="mt-2 flex flex-col gap-2"
									>
										<TicketAttachment
											v-for="attachment in message.attachments"
											:key="attachment.id"
											:attachment="attachment"
										/>
									</div>

									<!-- 網頁送出的訊息送到 Discord 的狀態 -->
									<p
										v-if="message.delivery_status === 'pending'"
										class="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500"
									>
										<UIcon
											name="i-heroicons-arrow-path"
											class="w-3 h-3 animate-spin"
										/>
										{{ $t('tickets.detail.delivery_pending') }}
									</p>
									<p
										v-else-if="message.delivery_status === 'failed'"
										class="mt-1 flex items-center gap-1 text-xs text-error-500"
									>
										<UIcon
											name="i-heroicons-exclamation-triangle"
											class="w-3 h-3"
										/>
										{{ $t('tickets.detail.delivery_failed') }}
									</p>

									<!-- 編輯前的內容, 只有客服拿得到 -->
									<details
										v-if="message.revisions.length"
										class="mt-1 text-xs text-gray-500 dark:text-gray-400"
									>
										<summary class="cursor-pointer select-none">
											{{ $t('tickets.detail.revisions', { count: message.revisions.length }) }}
										</summary>
										<ol class="mt-2 space-y-2 border-l-2 border-gray-200 dark:border-gray-800 pl-3">
											<li
												v-for="(revision, index) in message.revisions"
												:key="index"
											>
												<span class="block text-gray-400 dark:text-gray-500">
													{{ formatDateTime(revision.created_at) }} – {{ formatDateTime(revision.replaced_at) }}
												</span>
												<TicketMarkdown
													:content="revision.content"
													class="text-sm text-gray-600 dark:text-gray-300"
												/>
											</li>
										</ol>
									</details>
								</div>
							</li>
						</ol>
					</UCard>

					<!-- 回覆 -->
					<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
						<div
							v-if="!isOpen"
							class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
						>
							<UIcon
								name="i-heroicons-lock-closed"
								class="w-4 h-4"
							/>
							{{ ticket.status === 'failed' ? $t('tickets.detail.failed_notice') : $t('tickets.detail.closed_notice') }}
						</div>

						<form
							v-else
							class="space-y-3"
							@submit.prevent="submitReply"
						>
							<div class="space-y-1">
								<UTextarea
									v-model="reply"
									:maxlength="REPLY_MAX"
									:rows="4"
									autoresize
									:placeholder="$t('tickets.detail.reply_placeholder')"
									class="w-full"
									@keydown.ctrl.enter="submitReply"
									@keydown.meta.enter="submitReply"
								/>
								<p class="text-xs text-right text-gray-400 dark:text-gray-500">
									{{ reply.length }} / {{ REPLY_MAX }}
								</p>
							</div>

							<!-- 上傳中與上傳完成的附件 -->
							<ul
								v-if="uploads.length"
								class="space-y-2"
							>
								<li
									v-for="upload in uploads"
									:key="upload.key"
									class="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm"
								>
									<UIcon
										name="i-heroicons-paper-clip"
										class="w-4 h-4 shrink-0 text-gray-400"
									/>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="truncate text-gray-700 dark:text-gray-200">{{ upload.file.name }}</span>
											<span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">{{ formatFileSize(upload.file.size) }}</span>
										</div>
										<UProgress
											v-if="upload.isUploading"
											:model-value="upload.progress * 100"
											size="xs"
											class="mt-1"
										/>
										<span
											v-else-if="upload.attachment?.status === 'rejected' || upload.attachment?.status === 'failed'"
											class="text-xs text-error-500"
										>
											{{ upload.attachment.status === 'rejected' ? $t('tickets.attachment.rejected') : $t('tickets.attachment.failed') }}
										</span>
									</div>
									<UButton
										icon="i-heroicons-x-mark"
										color="neutral"
										variant="ghost"
										size="xs"
										:title="$t('tickets.detail.remove_attachment')"
										:disabled="upload.isUploading"
										@click="discardUpload(upload)"
									/>
								</li>
							</ul>

							<div class="flex items-center justify-between gap-3">
								<div class="flex min-w-0 items-center gap-2">
									<input
										ref="fileInput"
										type="file"
										multiple
										class="hidden"
										@change="pickFiles"
									>
									<UButton
										icon="i-heroicons-paper-clip"
										color="neutral"
										variant="ghost"
										:title="$t('tickets.detail.attach')"
										:disabled="uploads.length >= ATTACHMENTS_MAX"
										@click="fileInput?.click()"
									/>
									<span class="truncate text-xs text-gray-400 dark:text-gray-500">
										{{ $t('tickets.detail.reply_hint') }}
									</span>
								</div>
								<UButton
									type="submit"
									:label="$t('tickets.detail.send')"
									icon="i-heroicons-paper-airplane"
									:loading="isReplying"
									:disabled="!canReply"
								/>
							</div>
						</form>
					</UCard>

					<!-- 評分: 開單者在關單後評分一次 -->
					<UCard
						v-if="canRate"
						class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50"
					>
						<template #header>
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">
								{{ $t('tickets.detail.rate_title') }}
							</h2>
						</template>

						<form
							class="space-y-3"
							@submit.prevent="submitRating"
						>
							<div class="flex items-center gap-1">
								<button
									v-for="value in 5"
									:key="value"
									type="button"
									class="p-0.5"
									:title="$t('tickets.detail.rating_value', { value })"
									@click="rating = value"
								>
									<UIcon
										:name="value <= rating ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
										class="w-7 h-7"
										:class="value <= rating ? 'text-warning-400' : 'text-gray-300 dark:text-gray-600'"
									/>
								</button>
							</div>
							<UTextarea
								v-model="feedback"
								:maxlength="FEEDBACK_MAX"
								:rows="3"
								autoresize
								:placeholder="$t('tickets.detail.feedback_placeholder')"
								class="w-full"
							/>
							<div class="flex justify-end">
								<UButton
									type="submit"
									:label="$t('tickets.detail.submit_rating')"
									:loading="isRating"
									:disabled="!rating"
								/>
							</div>
						</form>
					</UCard>
				</div>

				<!-- 工單資訊 -->
				<div class="lg:col-start-3 lg:row-start-1">
					<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
						<template #header>
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">
								{{ $t('tickets.detail.info') }}
							</h2>
						</template>

						<dl class="space-y-4 text-sm">
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									{{ $t('tickets.detail.status') }}
								</dt>
								<dd class="mt-1">
									<TicketStatusBadge :status="displayStatus(ticket)" />
								</dd>
							</div>
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									{{ $t('tickets.detail.opener') }}
								</dt>
								<dd class="mt-1 flex items-center gap-2 text-gray-900 dark:text-white">
									<template v-if="userOf(ticket.opener_id)">
										<img
											:src="ticketAvatarUrl(userOf(ticket.opener_id)!)"
											class="w-5 h-5 rounded-full object-cover"
											alt="Avatar"
										>
										{{ displayName(userOf(ticket.opener_id)!) }}
									</template>
								</dd>
							</div>
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									{{ $t('tickets.detail.assignee') }}
								</dt>
								<dd class="mt-1 flex items-center gap-2 text-gray-900 dark:text-white">
									<template v-if="userOf(ticket.claimed_by_id)">
										<img
											:src="ticketAvatarUrl(userOf(ticket.claimed_by_id)!)"
											class="w-5 h-5 rounded-full object-cover"
											alt="Avatar"
										>
										{{ displayName(userOf(ticket.claimed_by_id)!) }}
									</template>
									<span
										v-else
										class="text-gray-400 dark:text-gray-500"
									>{{ $t('tickets.detail.unassigned') }}</span>
								</dd>
							</div>
							<div v-if="ticket.members.length">
								<dt class="text-gray-500 dark:text-gray-400">
									{{ $t('tickets.detail.members') }}
								</dt>
								<dd class="mt-1 space-y-1">
									<div
										v-for="member in ticket.members"
										:key="member.user_id"
										class="flex items-center gap-2 text-gray-900 dark:text-white"
									>
										<template v-if="userOf(member.user_id)">
											<img
												:src="ticketAvatarUrl(userOf(member.user_id)!)"
												class="w-5 h-5 rounded-full object-cover"
												alt="Avatar"
											>
											{{ displayName(userOf(member.user_id)!) }}
										</template>
									</div>
								</dd>
							</div>
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									{{ $t('tickets.detail.created_at') }}
								</dt>
								<dd class="mt-1 text-gray-900 dark:text-white">
									{{ formatDateTime(ticket.created_at) }}
								</dd>
							</div>
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									{{ $t('tickets.detail.last_activity') }}
								</dt>
								<dd class="mt-1 text-gray-900 dark:text-white">
									{{ formatDateTime(ticket.last_message_at) }}
								</dd>
							</div>
							<template v-if="ticket.closed_at">
								<div>
									<dt class="text-gray-500 dark:text-gray-400">
										{{ $t('tickets.detail.closed_at') }}
									</dt>
									<dd class="mt-1 text-gray-900 dark:text-white">
										{{ formatDateTime(ticket.closed_at) }}
									</dd>
								</div>
								<div>
									<dt class="text-gray-500 dark:text-gray-400">
										{{ $t('tickets.detail.closed_by') }}
									</dt>
									<dd class="mt-1 text-gray-900 dark:text-white">
										{{ userOf(ticket.closed_by_id) ? displayName(userOf(ticket.closed_by_id)!) : $t('tickets.detail.system') }}
									</dd>
								</div>
								<div v-if="ticket.close_reason">
									<dt class="text-gray-500 dark:text-gray-400">
										{{ $t('tickets.detail.close_reason') }}
									</dt>
									<dd class="mt-1 whitespace-pre-wrap wrap-break-word text-gray-900 dark:text-white">
										{{ ticket.close_reason }}
									</dd>
								</div>
							</template>
							<!-- 評分只有開單者與這個分類的客服看得到 -->
							<div v-if="ticket.rating">
								<dt class="text-gray-500 dark:text-gray-400">
									{{ $t('tickets.detail.rating') }}
								</dt>
								<dd class="mt-1">
									<div class="flex items-center gap-0.5">
										<UIcon
											v-for="value in 5"
											:key="value"
											:name="value <= ticket.rating ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
											class="w-4 h-4"
											:class="value <= ticket.rating ? 'text-warning-400' : 'text-gray-300 dark:text-gray-600'"
										/>
									</div>
									<p
										v-if="ticket.feedback"
										class="mt-1 whitespace-pre-wrap wrap-break-word text-gray-900 dark:text-white"
									>
										{{ ticket.feedback }}
									</p>
								</dd>
							</div>
						</dl>
					</UCard>
				</div>
			</div>
		</template>

		<!-- 確認關閉對話框 -->
		<div
			v-if="isCloseModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isCloseModalOpen = false"
		>
			<UCard class="w-full max-w-lg shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white flex items-center gap-2">
							<UIcon
								name="i-heroicons-exclamation-triangle"
								class="w-5 h-5 text-error-500"
							/>
							{{ $t('tickets.detail.close') }}
						</h3>
						<UButton
							color="neutral"
							variant="ghost"
							icon="i-heroicons-x-mark-20-solid"
							class="-my-1"
							@click="isCloseModalOpen = false"
						/>
					</div>
				</template>

				<div class="space-y-3 py-2">
					<i18n-t
						keypath="tickets.detail.close_confirm"
						tag="p"
						scope="global"
						class="text-sm text-gray-500 dark:text-gray-400"
					>
						<template #id>
							<span class="font-bold text-gray-900 dark:text-white">#{{ ticket?.id }}</span>
						</template>
					</i18n-t>
					<UTextarea
						v-model="closeReason"
						:maxlength="CLOSE_REASON_MAX"
						:rows="3"
						autoresize
						:placeholder="$t('tickets.detail.close_reason_placeholder')"
						class="w-full"
					/>
				</div>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							:label="$t('tickets.common.cancel')"
							:disabled="isClosing"
							@click="isCloseModalOpen = false"
						/>
						<UButton
							color="error"
							:label="$t('tickets.detail.confirm_close')"
							:loading="isClosing"
							@click="confirmClose"
						/>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
