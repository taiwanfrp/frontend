<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'tickets',
})

const PAGE_SIZE = 50

const { t } = useI18n()
const toast = useToast()
const { me, fetchMe, listCategories, listTickets, subscribeList } = useTickets()

const tickets = ref<TicketSummary[]>([])
const categories = ref<TicketCategory[]>([])
const isLoading = ref(true)
const hasMore = ref(false)

const statusFilter = ref<'active' | 'closed' | 'all'>('active')
const statusTabs = computed(() => [
	{ label: t('tickets.list.filter_active'), value: 'active' },
	{ label: t('tickets.list.filter_closed'), value: 'closed' },
	{ label: t('tickets.list.filter_all'), value: 'all' },
])
const statusQuery = computed(() => ({ active: 'open', closed: 'closed', all: undefined } as const)[statusFilter.value])

// 客服、管理員看得到其他人的客服單, 多顯示開單者
const isStaffView = computed(() => !!me.value && (me.value.is_admin || me.value.category_ids.length > 0))

const categoryById = computed(() => new Map(categories.value.map(category => [category.id, category])))

const load = async (more = false) => {
	isLoading.value = true
	try {
		const page = await listTickets({
			status: statusQuery.value,
			limit: PAGE_SIZE,
			// 下一頁用這一頁最後一筆的 id
			before: more ? tickets.value.at(-1)?.id : undefined,
		})
		tickets.value = more ? [...tickets.value, ...page] : page
		hasMore.value = page.length === PAGE_SIZE
	}
	catch (error: unknown) {
		toast.add({
			title: t('tickets.list.load_failed'),
			description: ticketErrorMessage(error) || t('tickets.common.try_again'),
			color: 'error',
			icon: 'i-heroicons-x-circle',
		})
	}
	finally {
		isLoading.value = false
	}
}

// 列表有變動時重新載入第一頁, 短時間內的多個事件只載入一次
let reloadTimer: ReturnType<typeof setTimeout> | undefined
const scheduleReload = () => {
	clearTimeout(reloadTimer)
	reloadTimer = setTimeout(() => load(), 500)
}

let unsubscribe: (() => void) | undefined

whenLoggedIn(async () => {
	load()
	unsubscribe = subscribeList(scheduleReload, scheduleReload)
	try {
		const [, list] = await Promise.all([fetchMe(), listCategories()])
		categories.value = list
	}
	catch (error) {
		console.error('Fetch ticket me or categories failed:', error)
	}
})

watch(statusFilter, () => load())

onBeforeUnmount(() => {
	clearTimeout(reloadTimer)
	unsubscribe?.()
})

const searchQuery = ref('')

const filteredTickets = computed(() => {
	const query = searchQuery.value.toLowerCase()
	if (!query) return tickets.value

	return tickets.value.filter(ticket =>
		ticket.subject.toLowerCase().includes(query)
		|| String(ticket.id).includes(query)
		|| (ticket.opener && displayName(ticket.opener).toLowerCase().includes(query)),
	)
})

const columns = computed<TableColumn<TicketSummary>[]>(() => [
	{ accessorKey: 'id', header: '#' },
	{ accessorKey: 'subject', header: t('tickets.list.column_subject') },
	{ id: 'category', header: t('tickets.list.column_category') },
	...(isStaffView.value ? [{ id: 'opener', header: t('tickets.list.column_opener') }] : []),
	{ accessorKey: 'status', header: t('tickets.list.column_status') },
	{ accessorKey: 'last_message_at', header: t('tickets.list.column_last_activity') },
])
</script>

<template>
	<div class="space-y-6">
		<!-- 頁面標題 -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
					{{ isStaffView ? $t('tickets.list.title_staff') : $t('tickets.list.title') }}
				</h1>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					{{ $t('tickets.list.subtitle') }}
				</p>
			</div>

			<div class="flex items-center gap-2">
				<UButton
					icon="i-heroicons-arrow-path"
					color="neutral"
					variant="ghost"
					:title="$t('tickets.common.refresh')"
					:loading="isLoading"
					@click="load()"
				/>
				<UButton
					v-if="me?.is_admin"
					icon="i-heroicons-cog-6-tooth"
					:label="$t('tickets.settings.title')"
					color="neutral"
					variant="outline"
					:to="$localePath('/tickets/settings')"
				/>
				<UButton
					icon="i-heroicons-plus"
					:label="$t('tickets.common.new_ticket')"
					:to="$localePath('/tickets/new')"
				/>
			</div>
		</div>

		<!-- 篩選 -->
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<UTabs
				v-model="statusFilter"
				:items="statusTabs"
				:content="false"
				size="sm"
				class="w-full sm:w-auto"
			/>

			<div class="w-full sm:w-72">
				<UInput
					v-model="searchQuery"
					icon="i-heroicons-magnifying-glass"
					:placeholder="isStaffView ? $t('tickets.list.search_placeholder_staff') : $t('tickets.list.search_placeholder')"
					class="w-full"
				/>
			</div>
		</div>

		<!-- 工單列表 -->
		<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
			<UTable
				:data="filteredTickets"
				:columns="columns"
				:loading="isLoading"
			>
				<template #id-cell="{ row }">
					<span class="font-mono text-sm text-gray-500 dark:text-gray-400">
						{{ row.original.id }}
					</span>
				</template>

				<template #subject-cell="{ row }">
					<NuxtLink
						:to="$localePath(`/tickets/${row.original.id}`)"
						class="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
					>
						{{ row.original.subject }}
					</NuxtLink>
				</template>

				<template #category-cell="{ row }">
					<span class="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
						<template v-if="categoryById.get(row.original.category_id)">
							<TicketEmoji
								v-if="categoryById.get(row.original.category_id)!.emoji"
								:emoji="categoryById.get(row.original.category_id)!.emoji!"
								class="mr-1"
							/>
							{{ categoryById.get(row.original.category_id)!.name }}
						</template>
						<span
							v-else
							class="text-gray-400 dark:text-gray-500"
						>—</span>
					</span>
				</template>

				<template #opener-cell="{ row }">
					<span
						v-if="row.original.opener"
						class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap"
					>
						<img
							:src="ticketAvatarUrl(row.original.opener)"
							class="w-5 h-5 rounded-full object-cover"
							alt="Avatar"
						>
						{{ displayName(row.original.opener) }}
					</span>
				</template>

				<template #status-cell="{ row }">
					<TicketStatusBadge :status="displayStatus(row.original)" />
				</template>

				<template #last_message_at-cell="{ row }">
					<span
						class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"
						:title="formatDateTime(row.original.last_message_at)"
					>
						{{ formatRelativeTime(row.original.last_message_at) }}
					</span>
				</template>

				<!-- 空狀態 -->
				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<UIcon
							name="i-heroicons-inbox"
							class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						/>
						<span class="text-base font-medium text-gray-900 dark:text-white">
							{{ searchQuery ? $t('tickets.list.no_results') : $t('tickets.list.empty') }}
						</span>
						<UButton
							v-if="!searchQuery"
							:label="$t('tickets.common.new_ticket')"
							icon="i-heroicons-plus"
							variant="soft"
							class="mt-4"
							:to="$localePath('/tickets/new')"
						/>
					</div>
				</template>
			</UTable>

			<div
				v-if="hasMore"
				class="flex justify-center pt-4"
			>
				<UButton
					:label="$t('tickets.list.load_more')"
					color="neutral"
					variant="soft"
					:loading="isLoading"
					@click="load(true)"
				/>
			</div>
		</UCard>
	</div>
</template>
