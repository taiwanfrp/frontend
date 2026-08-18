<script setup lang="ts">
import { ref, computed } from 'vue'
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

const { user } = useAuth()
const canCreateNode = computed(() => user.value?.permissions?.includes('node.create') || false)
const canEditNode = (node: AppNode) => {
	if (!user.value?.permissions) return false
	if (user.value.permissions.includes('node.update.all')) return true

	const hasOwnerPermission = user.value.permissions.includes('node.update.own')
	const isOwner = user.value.internal_user_id === node.owner_id
	return hasOwnerPermission && isOwner
}

const canDeleteNode = (node: AppNode) => {
	if (!user.value?.permissions) return false
	if (user.value.permissions.includes('node.delete.all')) return true

	const hasOwnerPermission = user.value.permissions.includes('node.delete.own')
	const isOwner = user.value.internal_user_id === node.owner_id
	return hasOwnerPermission && isOwner
}

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

// 新增/編輯節點表單
const isFormModalOpen = ref(false)
const isSubmitting = ref(false)
const isEditMode = ref(false)
const editingNodeId = ref<number | null>(null)
const formErrorMessage = ref('')

const originalNode = ref<Partial<AppNode>>({})

const nodeForm = ref({
	name: '',
	description: '',
	host: '',
	port_start: undefined as number | undefined,
	port_end: undefined as number | undefined,
	is_public: false,
})

// 新增節點
const openAddModal = () => {
	isEditMode.value = false
	editingNodeId.value = null
	formErrorMessage.value = ''
	nodeForm.value = {
		name: '',
		description: '',
		host: '',
		port_start: undefined,
		port_end: undefined,
		is_public: false,
	}
	originalNode.value = {}
	isFormModalOpen.value = true
}

// 編輯節點
const openEditModal = (node: AppNode) => {
	isEditMode.value = true
	editingNodeId.value = node.id
	formErrorMessage.value = ''

	originalNode.value = { ...node }

	nodeForm.value = {
		name: node.name,
		description: node.description || '',
		host: node.host,
		port_start: node.port_start,
		port_end: node.port_end,
		is_public: node.is_public,
	}
	isFormModalOpen.value = true
}

const submitForm = async () => {
	formErrorMessage.value = ''
	if (!nodeForm.value.name) {
		formErrorMessage.value = '請填寫節點名稱'
		return
	}
	if (!nodeForm.value.host) {
		formErrorMessage.value = '請填寫伺服器位址'
		return
	}
	if (!nodeForm.value.port_start || !nodeForm.value.port_end) {
		formErrorMessage.value = '請填寫完整的連接埠範圍'
		return
	}
	if (nodeForm.value.port_start > nodeForm.value.port_end) {
		formErrorMessage.value = '起始連接埠不能大於結束連接埠'
		return
	}
	if (nodeForm.value.port_start < 1 || nodeForm.value.port_end > 65535) {
		formErrorMessage.value = '連接埠範圍必須介於 1 到 65535'
		return
	}

	console.log('準備送出表單資料：', nodeForm.value)
	isFormModalOpen.value = false
}
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<!-- 頁面標頭 -->
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				節點列表
			</h1>

			<div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
				<!-- 建立節點按鈕 -->
				<UButton
					v-if="canCreateNode"
					icon="i-heroicons-plus"
					color="primary"
					label="新增節點"
					size="md"
					class="w-full sm:w-auto justify-center"
					@click="openAddModal"
				/>

				<!-- 搜尋輸入框 -->
				<div class="w-full sm:w-72">
					<UInput
						v-model="searchQuery"
						icon="i-heroicons-magnifying-glass"
						placeholder="搜尋節點名稱或位址..."
						size="md"
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

				<template #actions-cell="{ row }">
					<div class="flex items-center justify-center gap-1">
						<UButton
							v-if="canEditNode(row.original)"
							color="neutral"
							variant="ghost"
							icon="i-heroicons-pencil-square"
							size="lg"
							title="編輯節點"
							@click="openEditModal(row.original)"
						/>
						<UButton
							v-if="canDeleteNode(row.original)"
							color="error"
							variant="ghost"
							icon="i-heroicons-trash"
							size="lg"
							title="刪除節點"
							@click="() => {}"
						/>
					</div>
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

		<!-- 新增/編輯節點對話框 -->
		<div
			v-if="isFormModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isFormModalOpen = false"
		>
			<UCard
				class="w-full max-w-2xl shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 flex flex-col max-h-[90vh]"
			>
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							{{ isEditMode ? '編輯節點' : '新增節點' }}
						</h3>
						<UButton
							color="neutral"
							variant="ghost"
							icon="i-heroicons-x-mark-20-solid"
							class="-my-1"
							@click="isFormModalOpen = false"
						/>
					</div>
				</template>

				<!-- 表單內容 -->
				<div class="py-8 space-y-4 overflow-y-auto px-1 flex flex-col items-center justify-center text-gray-500">
					<UIcon
						name="i-heroicons-wrench-screwdriver"
						class="w-10 h-10 mb-2 opacity-50"
					/>
					<span>建設中...</span>
				</div>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							label="取消"
							:disabled="isSubmitting"
							@click="isFormModalOpen = false"
						/>
						<UButton
							color="primary"
							:label="isEditMode ? '確認修改' : '確認新增'"
							:loading="isSubmitting"
							@click="submitForm"
						/>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
