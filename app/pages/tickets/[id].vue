<script setup lang="ts">
definePageMeta({
	layout: 'tickets',
})

const REPLY_MAX = 2000

const route = useRoute()
const toast = useToast()
const { getAvatarUrl } = useAuth()
const { getTicket, replyTicket, closeTicket } = useTickets()

const ticketId = Number(route.params.id)

const { data: ticket, pending: isLoading, refresh } = useAsyncData(`ticket-${ticketId}`, () => getTicket(ticketId), {
	server: false,
	lazy: true,
	default: () => null,
})

const isClosed = computed(() => ticket.value?.status === 'closed')

const reply = ref('')
const isReplying = ref(false)

const submitReply = async () => {
	const content = reply.value.trim()
	if (!content || content.length > REPLY_MAX) return

	isReplying.value = true
	try {
		await replyTicket(ticketId, content)
		reply.value = ''
		await refresh()
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		toast.add({
			title: '回覆失敗',
			description: err.data?.detail || '無法送出回覆，請稍後再試。',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		})
	}
	finally {
		isReplying.value = false
	}
}

const isCloseModalOpen = ref(false)
const isClosing = ref(false)

const confirmClose = async () => {
	isClosing.value = true
	try {
		await closeTicket(ticketId)
		isCloseModalOpen.value = false
		toast.add({ title: '工單已關閉', color: 'success', icon: 'i-heroicons-check-circle' })
		await refresh()
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		toast.add({
			title: '關閉失敗',
			description: err.data?.detail || '無法關閉工單，請稍後再試。',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		})
	}
	finally {
		isClosing.value = false
	}
}

const sourceMeta = {
	web: { icon: 'i-heroicons-globe-alt', label: '來自網頁' },
	discord: { icon: 'i-simple-icons-discord', label: '來自 Discord' },
	system: { icon: 'i-heroicons-cog-6-tooth', label: '系統' },
} as const
</script>

<template>
	<div class="space-y-6">
		<NuxtLink
			to="/tickets"
			class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
		>
			<UIcon
				name="i-heroicons-arrow-left"
				class="w-4 h-4"
			/>
			返回工單列表
		</NuxtLink>

		<!-- 載入中 -->
		<div
			v-if="isLoading && !ticket"
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
					找不到這張工單
				</span>
				<span class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					工單可能不存在，或你沒有權限查看
				</span>
			</div>
		</UCard>

		<template v-else>
			<!-- 標題列 -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
						<span class="font-mono">#{{ ticket.id }}</span>
						<TicketStatusBadge :status="ticket.status" />
						<span>{{ ticket.category.name }}</span>
					</div>
					<h1 class="mt-2 text-2xl font-bold text-gray-900 dark:text-white wrap-break-word">
						{{ ticket.subject }}
					</h1>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					<UButton
						icon="i-heroicons-arrow-path"
						color="neutral"
						variant="ghost"
						title="重新整理"
						:loading="isLoading"
						@click="refresh()"
					/>
					<UButton
						v-if="ticket.discord_channel_url"
						icon="i-simple-icons-discord"
						label="在 Discord 開啟"
						color="neutral"
						variant="outline"
						:to="ticket.discord_channel_url"
						target="_blank"
					/>
					<UButton
						v-if="!isClosed"
						icon="i-heroicons-lock-closed"
						label="關閉工單"
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
								對話紀錄
							</h2>
						</template>

						<ol class="space-y-5">
							<li
								v-for="message in ticket.messages"
								:key="message.id"
							>
								<!-- 系統訊息 -->
								<div
									v-if="message.source === 'system'"
									class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400"
								>
									<div class="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
									<span>{{ message.content }} · {{ formatRelativeTime(message.created_at) }}</span>
									<div class="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
								</div>

								<!-- 一般訊息 -->
								<div
									v-else
									class="flex gap-3"
								>
									<img
										:src="getAvatarUrl(message.author)"
										class="w-9 h-9 shrink-0 rounded-full object-cover"
										alt="Avatar"
									>
									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center gap-2">
											<span class="text-sm font-semibold text-gray-900 dark:text-white">
												{{ message.author?.username ?? '未知使用者' }}
											</span>
											<UBadge
												v-if="message.is_staff"
												label="客服"
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
										</div>
										<TicketMarkdown
											:content="message.content"
											class="mt-1 text-sm text-gray-700 dark:text-gray-200"
										/>
									</div>
								</div>
							</li>
						</ol>
					</UCard>

					<!-- 回覆 -->
					<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
						<div
							v-if="isClosed"
							class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
						>
							<UIcon
								name="i-heroicons-lock-closed"
								class="w-4 h-4"
							/>
							此工單已關閉，無法再回覆。如有其他問題請開新工單。
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
									placeholder="輸入回覆內容（支援 Discord 格式）"
									class="w-full"
								/>
								<p class="text-xs text-right text-gray-400 dark:text-gray-500">
									{{ reply.length }} / {{ REPLY_MAX }}
								</p>
							</div>
							<div class="flex items-center justify-between gap-3">
								<span class="text-xs text-gray-400 dark:text-gray-500">
									回覆會以你的 Discord 名稱與頭像發送到工單頻道
								</span>
								<UButton
									type="submit"
									label="送出"
									icon="i-heroicons-paper-airplane"
									:loading="isReplying"
									:disabled="!reply.trim()"
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
								工單資訊
							</h2>
						</template>

						<dl class="space-y-4 text-sm">
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									狀態
								</dt>
								<dd class="mt-1">
									<TicketStatusBadge :status="ticket.status" />
								</dd>
							</div>
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									開單者
								</dt>
								<dd class="mt-1 flex items-center gap-2 text-gray-900 dark:text-white">
									<img
										:src="getAvatarUrl(ticket.opener)"
										class="w-5 h-5 rounded-full object-cover"
										alt="Avatar"
									>
									{{ ticket.opener.username }}
								</dd>
							</div>
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									負責客服
								</dt>
								<dd class="mt-1 flex items-center gap-2 text-gray-900 dark:text-white">
									<template v-if="ticket.assignee">
										<img
											:src="getAvatarUrl(ticket.assignee)"
											class="w-5 h-5 rounded-full object-cover"
											alt="Avatar"
										>
										{{ ticket.assignee.username }}
									</template>
									<span
										v-else
										class="text-gray-400 dark:text-gray-500"
									>尚未指派</span>
								</dd>
							</div>
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									建立時間
								</dt>
								<dd class="mt-1 text-gray-900 dark:text-white">
									{{ formatDateTime(ticket.created_at) }}
								</dd>
							</div>
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									最後活動
								</dt>
								<dd class="mt-1 text-gray-900 dark:text-white">
									{{ formatDateTime(ticket.last_activity_at) }}
								</dd>
							</div>
							<div v-if="ticket.closed_at">
								<dt class="text-gray-500 dark:text-gray-400">
									關閉時間
								</dt>
								<dd class="mt-1 text-gray-900 dark:text-white">
									{{ formatDateTime(ticket.closed_at) }}
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
							關閉工單
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

				<p class="py-2 text-sm text-gray-500 dark:text-gray-400">
					確定要關閉工單 <span class="font-bold text-gray-900 dark:text-white">#{{ ticket?.id }}</span> 嗎？關閉後將無法再回覆，Discord 的工單頻道也會一併關閉。
				</p>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							label="取消"
							:disabled="isClosing"
							@click="isCloseModalOpen = false"
						/>
						<UButton
							color="error"
							label="確認關閉"
							:loading="isClosing"
							@click="confirmClose"
						/>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
