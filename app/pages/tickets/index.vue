<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'tickets',
})

const { t } = useI18n()
const { listTickets } = useTickets()
const { categoryName } = useTicketCategoryText()

const { data: tickets, pending: isLoading, refresh } = useAsyncData('tickets', listTickets, {
	server: false,
	lazy: true,
	default: () => [] as Ticket[],
})

const statusFilter = ref<'active' | 'closed' | 'all'>('active')
const statusTabs = computed(() => [
	{ label: t('tickets.list.filter_active'), value: 'active' },
	{ label: t('tickets.list.filter_closed'), value: 'closed' },
	{ label: t('tickets.list.filter_all'), value: 'all' },
])

const searchQuery = ref('')

const filteredTickets = computed(() => {
	const query = searchQuery.value.toLowerCase()

	return tickets.value.filter((ticket) => {
		if (statusFilter.value === 'active' && ticket.status === 'closed') return false
		if (statusFilter.value === 'closed' && ticket.status !== 'closed') return false
		if (!query) return true
		return ticket.subject.toLowerCase().includes(query) || String(ticket.id).includes(query)
	})
})

const columns = computed<TableColumn<Ticket>[]>(() => [
	{ accessorKey: 'id', header: '#' },
	{ accessorKey: 'subject', header: t('tickets.list.column_subject') },
	{ id: 'category', header: t('tickets.list.column_category') },
	{ accessorKey: 'status', header: t('tickets.list.column_status') },
	{ accessorKey: 'last_activity_at', header: t('tickets.list.column_last_activity') },
])
</script>

<template>
	<div class="space-y-6">
		<!-- 頁面標題 -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
					{{ $t('tickets.list.title') }}
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
					@click="refresh()"
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
					:placeholder="$t('tickets.list.search_placeholder')"
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
						{{ categoryName(row.original.category) }}
					</span>
				</template>

				<template #status-cell="{ row }">
					<TicketStatusBadge :status="row.original.status" />
				</template>

				<template #last_activity_at-cell="{ row }">
					<span
						class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"
						:title="formatDateTime(row.original.last_activity_at)"
					>
						{{ formatRelativeTime(row.original.last_activity_at) }}
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
		</UCard>
	</div>
</template>
