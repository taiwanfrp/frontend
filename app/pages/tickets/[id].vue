<script setup lang="ts">
definePageMeta({
	layout: 'tickets',
})

const REPLY_MAX = 2000

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { getAvatarUrl } = useAuth()
const { getTicket, replyTicket, closeTicket } = useTickets()
const { categoryName } = useTicketCategoryText()

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
			title: t('tickets.detail.reply_failed'),
			description: err.data?.detail || t('tickets.detail.reply_failed_desc'),
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
		toast.add({ title: t('tickets.detail.closed'), color: 'success', icon: 'i-heroicons-check-circle' })
		await refresh()
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		toast.add({
			title: t('tickets.detail.close_failed'),
			description: err.data?.detail || t('tickets.detail.close_failed_desc'),
			color: 'error',
			icon: 'i-heroicons-x-circle',
		})
	}
	finally {
		isClosing.value = false
	}
}

const sourceMeta = computed(() => ({
	web: { icon: 'i-heroicons-globe-alt', label: t('tickets.source.web') },
	discord: { icon: 'i-simple-icons-discord', label: t('tickets.source.discord') },
	system: { icon: 'i-heroicons-cog-6-tooth', label: t('tickets.source.system') },
}))
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
						<TicketStatusBadge :status="ticket.status" />
						<span>{{ categoryName(ticket.category) }}</span>
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
						:title="$t('tickets.common.refresh')"
						:loading="isLoading"
						@click="refresh()"
					/>
					<UButton
						v-if="ticket.discord_channel_url"
						icon="i-simple-icons-discord"
						:label="$t('tickets.detail.open_in_discord')"
						color="neutral"
						variant="outline"
						:to="ticket.discord_channel_url"
						target="_blank"
					/>
					<UButton
						v-if="!isClosed"
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
												{{ message.author?.username ?? $t('tickets.detail.unknown_user') }}
											</span>
											<UBadge
												v-if="message.is_staff"
												:label="$t('tickets.detail.staff')"
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
							{{ $t('tickets.detail.closed_notice') }}
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
								/>
								<p class="text-xs text-right text-gray-400 dark:text-gray-500">
									{{ reply.length }} / {{ REPLY_MAX }}
								</p>
							</div>
							<div class="flex items-center justify-between gap-3">
								<span class="text-xs text-gray-400 dark:text-gray-500">
									{{ $t('tickets.detail.reply_hint') }}
								</span>
								<UButton
									type="submit"
									:label="$t('tickets.detail.send')"
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
								{{ $t('tickets.detail.info') }}
							</h2>
						</template>

						<dl class="space-y-4 text-sm">
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									{{ $t('tickets.detail.status') }}
								</dt>
								<dd class="mt-1">
									<TicketStatusBadge :status="ticket.status" />
								</dd>
							</div>
							<div>
								<dt class="text-gray-500 dark:text-gray-400">
									{{ $t('tickets.detail.opener') }}
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
									{{ $t('tickets.detail.assignee') }}
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
									>{{ $t('tickets.detail.unassigned') }}</span>
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
									{{ formatDateTime(ticket.last_activity_at) }}
								</dd>
							</div>
							<div v-if="ticket.closed_at">
								<dt class="text-gray-500 dark:text-gray-400">
									{{ $t('tickets.detail.closed_at') }}
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

				<i18n-t
					keypath="tickets.detail.close_confirm"
					tag="p"
					scope="global"
					class="py-2 text-sm text-gray-500 dark:text-gray-400"
				>
					<template #id>
						<span class="font-bold text-gray-900 dark:text-white">#{{ ticket?.id }}</span>
					</template>
				</i18n-t>

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
