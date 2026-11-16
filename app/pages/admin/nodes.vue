<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'admin',
})

interface AdminNode {
	id: number
	name: string
	description: string | null
	host: string
	port_start: number
	port_end: number
	status: 'active' | 'draft' | 'reviewing' | 'maintenance' | 'disabled'
	is_public: boolean
	owner_id: string
	created_at: string
	updated_at: string
}

interface NodeOwner {
	id: string
	discord_id: string
	member?: {
		username: string
		global_name: string | null
		nick: string | null
		avatar: string | null
	} | null
}

const NODE_STATUS = {
	active: { label: '可用', color: 'success' },
	draft: { label: '待審核', color: 'neutral' },
	reviewing: { label: '審核中', color: 'warning' },
	maintenance: { label: '維護中', color: 'info' },
	disabled: { label: '停用', color: 'error' },
} as const

const statusOptions = [
	{ label: '全部狀態', value: 'all' },
	...Object.entries(NODE_STATUS).map(([value, { label }]) => ({ label, value })),
]

const columns: TableColumn<AdminNode>[] = [
	{ id: 'node', header: '節點' },
	{ id: 'owner', header: '擁有者' },
	{ id: 'address', header: '位址' },
	{ accessorKey: 'is_public', header: '類型' },
	{ accessorKey: 'status', header: '狀態' },
	{ accessorKey: 'created_at', header: '建立時間' },
]

const fetchOptions = { server: false, lazy: true, default: () => [] }

const { data: nodes, pending: isNodesLoading, refresh: refreshNodes } = useApiFetch<AdminNode[]>('/api/v1/nodes', fetchOptions)
const { data: users, refresh: refreshUsers } = useApiFetch<NodeOwner[]>('/api/v1/users', fetchOptions)

const refresh = () => Promise.all([refreshNodes(), refreshUsers()])

const { getAvatarUrl } = useAuth()

const owners = computed(() => new Map((users.value || []).map(user => [user.id, user])))

const ownerName = (ownerId: string) => {
	const owner = owners.value.get(ownerId)
	return owner?.member?.nick || owner?.member?.global_name || owner?.member?.username || owner?.discord_id || ownerId
}

const searchQuery = ref('')
const statusFilter = ref('all')

const filteredNodes = computed(() => {
	const query = searchQuery.value.trim().toLowerCase()

	return (nodes.value || []).filter((node) => {
		if (statusFilter.value !== 'all' && node.status !== statusFilter.value) return false
		if (!query) return true
		return node.name.toLowerCase().includes(query)
			|| (node.description || '').toLowerCase().includes(query)
			|| node.host.toLowerCase().includes(query)
			|| ownerName(node.owner_id).toLowerCase().includes(query)
	})
})

const formatDate = (value: string) => new Date(value).toLocaleString('zh-TW')
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
					所有節點
				</h1>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					共 {{ nodes?.length || 0 }} 個，符合條件 {{ filteredNodes.length }} 個
				</p>
			</div>

			<div class="flex gap-2 w-full sm:w-auto">
				<USelect
					v-model="statusFilter"
					:items="statusOptions"
					class="w-32"
				/>
				<UButton
					icon="i-heroicons-arrow-path"
					color="neutral"
					variant="outline"
					title="重新整理"
					:loading="isNodesLoading"
					@click="refresh()"
				/>
				<UInput
					v-model="searchQuery"
					icon="i-heroicons-magnifying-glass"
					placeholder="搜尋名稱、描述、位址或擁有者..."
					class="flex-1 sm:w-72"
				>
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

		<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
			<UTable
				:data="filteredNodes"
				:columns="columns"
				:loading="isNodesLoading"
			>
				<template #node-cell="{ row }">
					<div class="min-w-0">
						<div class="font-medium text-gray-900 dark:text-white">
							{{ row.original.name }}
						</div>
						<div class="text-xs text-gray-500 dark:text-gray-400 whitespace-normal">
							{{ row.original.description || '沒有描述' }}
						</div>
					</div>
				</template>

				<template #owner-cell="{ row }">
					<div class="flex items-center gap-2">
						<UAvatar
							:src="getAvatarUrl({ discord_id: owners.get(row.original.owner_id)?.discord_id ?? '', avatar: owners.get(row.original.owner_id)?.member?.avatar ?? null })"
							:alt="ownerName(row.original.owner_id)"
							size="sm"
						/>
						<span class="text-sm text-gray-900 dark:text-white truncate">
							{{ ownerName(row.original.owner_id) }}
						</span>
					</div>
				</template>

				<template #address-cell="{ row }">
					<div class="text-sm">
						<div class="font-mono text-gray-900 dark:text-white">
							{{ row.original.host }}
						</div>
						<div class="text-xs text-gray-500 dark:text-gray-400">
							Port {{ row.original.port_start }} - {{ row.original.port_end }}
						</div>
					</div>
				</template>

				<template #is_public-cell="{ row }">
					<UBadge
						:color="row.original.is_public ? 'primary' : 'neutral'"
						variant="subtle"
					>
						{{ row.original.is_public ? '公開' : '私人' }}
					</UBadge>
				</template>

				<template #status-cell="{ row }">
					<UBadge
						:color="NODE_STATUS[row.original.status]?.color || 'neutral'"
						variant="subtle"
					>
						{{ NODE_STATUS[row.original.status]?.label || row.original.status }}
					</UBadge>
				</template>

				<template #created_at-cell="{ row }">
					<span class="text-sm text-gray-600 dark:text-gray-300">
						{{ formatDate(row.original.created_at) }}
					</span>
				</template>

				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<UIcon
							name="i-heroicons-server-stack"
							class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						/>
						<span class="text-base font-medium text-gray-900 dark:text-white">
							{{ searchQuery || statusFilter !== 'all' ? '找不到符合的節點' : '目前沒有任何節點' }}
						</span>
					</div>
				</template>
			</UTable>
		</UCard>
	</div>
</template>
