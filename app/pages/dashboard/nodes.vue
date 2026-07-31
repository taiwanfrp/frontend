<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'dashboard',
})

interface AppNode {
	id: number
	name: string
	description: string
	host: string
	port_start: number
	port_end: number
	status: string	// active, draft, reviewing, maintenance, disabled
	is_public: boolean
	owner_id: string
	created_at: string
	updated_at: string
}

const { data: nodes, pending: isNodesLoading } = useApiFetch<AppNode[]>('/api/v1/nodes', {
	server: false,
	lazy: true,
	default: () => [],
})

const searchQuery = ref('')

const filteredNodes = computed(() => {
	// 如果沒有搜尋字串就回傳全部資料
	if (!searchQuery.value) return nodes.value || []

	const query = searchQuery.value.toLowerCase()

	// 只要名稱、描述、或是主機位址包含搜尋字串就保留該節點
	return (nodes.value || []).filter(node =>
		node.name.toLowerCase().includes(query)
		|| (node.description && node.description.toLowerCase().includes(query))
		|| node.host.toLowerCase().includes(query),
	)
})

const columns: TableColumn<AppNode>[] = [
	{ accessorKey: 'name', header: '節點名稱' },
	{ accessorKey: 'host', header: '伺服器位址' },
	{ id: 'ports', header: '可用連接埠' },
	{ accessorKey: 'is_public', header: '類型' },
	{ accessorKey: 'status', header: '運營狀態' },
	{ id: 'connection_status', header: '連線狀態' },
	{ id: 'actions', header: '' },
]

const statusMap: Record<string, { label: string, color: 'success' | 'neutral' | 'warning' | 'info' | 'error' }> = {
	active: { label: '可用', color: 'success' },
	draft: { label: '待審核', color: 'neutral' },
	reviewing: { label: '審核中', color: 'warning' },
	maintenance: { label: '維護中', color: 'info' },
	disabled: { label: '停用', color: 'error' },
}
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<!-- 頁面標頭 -->
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				節點列表
			</h1>

			<!-- 搜尋輸入框 -->
			<div class="w-full sm:w-72">
				<UInput
					v-model="searchQuery"
					icon="i-heroicons-magnifying-glass"
					placeholder="搜尋節點名稱或位址..."
					size="md"
				>
					<!-- 如果有輸入文字就顯示清除按鈕 -->
					<template
						v-if="searchQuery"
						#trailing
					>
						<UButton
							color="neutral"
							variant="link"
							icon="i-heroicons-x-mark-20-solid"
							:padded="false"
							@click="searchQuery = ''"
						/>
					</template>
				</UInput>
			</div>
		</div>

		<!-- 節點表格卡片 -->
		<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
			<UTable
				:data="filteredNodes"
				:columns="columns"
				:loading="isNodesLoading"
				class="text-base [&_th]:text-center! [&_td]:text-center!"
			>
				<!-- 名稱與描述 -->
				<template #name-cell="{ row }">
					<div class="flex flex-col">
						<span class="text-base font-semibold text-gray-900 dark:text-white">{{ row.original.name }}</span>
						<span
							v-if="row.original.description"
							class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate max-w-xs"
						>
							{{ row.original.description }}
						</span>
					</div>
				</template>

				<!-- 伺服器位址 -->
				<template #host-cell="{ row }">
					<span class="text-base text-gray-700 dark:text-gray-300">
						{{ row.original.host }}
					</span>
				</template>

				<!-- 連接埠 -->
				<template #ports-cell="{ row }">
					<span class="text-base text-gray-600 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md">
						{{ row.original.port_start }} - {{ row.original.port_end }}
					</span>
				</template>

				<!-- 類型標籤 -->
				<template #is_public-cell="{ row }">
					<UBadge
						:color="row.original.is_public ? 'primary' : 'neutral'"
						variant="subtle"
						size="md"
					>
						{{ row.original.is_public ? '公開節點' : '私有節點' }}
					</UBadge>
				</template>

				<!-- 營運狀態標籤 -->
				<template #status-cell="{ row }">
					<UBadge
						:color="statusMap[row.original.status]?.color || 'neutral'"
						variant="subtle"
						size="md"
					>
						{{ statusMap[row.original.status]?.label || row.original.status }}
					</UBadge>
				</template>

				<!-- 連線狀態 -->
				<template #connection_status-cell>
					<span class="text-gray-400 dark:text-gray-500">-</span>
				</template>

				<!-- 空狀態 -->
				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<UIcon
							name="i-heroicons-server"
							class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						/>
						<span class="text-base font-medium text-gray-900 dark:text-white">
							{{ searchQuery ? '找不到符合的節點' : '目前沒有任何可用的節點' }}
						</span>
						<span
							v-if="searchQuery"
							class="text-sm text-gray-500 mt-1"
						>
							請嘗試使用不同的關鍵字搜尋
						</span>
					</div>
				</template>
			</UTable>
		</UCard>
	</div>
</template>
