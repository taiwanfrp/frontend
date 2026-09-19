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

const toast = useToast()

const { data: nodes, pending: isNodesLoading, refresh: refreshNodes } = useApiFetch<AppNode[]>('/api/v1/nodes', {
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

const canManageStatus = computed(() => user.value?.permissions?.includes('node.update.all') || false)

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

const statusOptions = [
	{ label: '可用', value: 'active' },
	{ label: '待審核', value: 'draft' },
	{ label: '審核中', value: 'reviewing' },
	{ label: '維護中', value: 'maintenance' },
	{ label: '停用', value: 'disabled' },
]

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
	status: 'draft',
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
		status: 'draft',
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
		status: node.status,
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

	isSubmitting.value = true
	const config = useRuntimeConfig()

	try {
		const apiUrl = isEditMode.value
			? `/api/v1/nodes/${editingNodeId.value}`
			: '/api/v1/nodes'
		const apiMethod = isEditMode.value ? 'PATCH' : 'POST'

		let requestBody: Record<string, string | number | boolean | null> = {}

		if (isEditMode.value) {
			// 後端的 PATCH 為完整結構，所有欄位皆為必填，因此每次都送出完整表單內容
			requestBody = {
				name: nodeForm.value.name,
				description: nodeForm.value.description || null,
				host: nodeForm.value.host,
				port_start: nodeForm.value.port_start ?? null,
				port_end: nodeForm.value.port_end ?? null,
				is_public: nodeForm.value.is_public,
				status: canManageStatus.value ? nodeForm.value.status : (originalNode.value.status ?? null),
			}
		}
		else {
			requestBody = {
				name: nodeForm.value.name,
				description: nodeForm.value.description || null,
				host: nodeForm.value.host,
				port_start: nodeForm.value.port_start ?? null,
				port_end: nodeForm.value.port_end ?? null,
				is_public: nodeForm.value.is_public,
			}
		}

		await $fetch<AppNode>(apiUrl, {
			method: apiMethod,
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
			body: requestBody,
		})

		toast.add({
			title: isEditMode.value ? '編輯成功' : '新增成功',
			description: `節點 ${nodeForm.value.name} 已成功${isEditMode.value ? '更新' : '建立'}。`,
			color: 'success',
			icon: 'i-heroicons-check-circle',
		})

		isFormModalOpen.value = false
		refreshNodes()
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		let errorMsg = `無法${isEditMode.value ? '更新' : '建立'}節點，請檢查輸入資料或稍後再試。`

		if (err.data && err.data.detail) {
			const detail = err.data.detail
			errorMsg = typeof detail === 'string' ? detail : '欄位格式錯誤，請檢查您的輸入。'
		}
		formErrorMessage.value = errorMsg
	}
	finally {
		isSubmitting.value = false
	}
}

// 刪除節點
const isContributeModalOpen = ref(false)
const isBecomingNodeProvider = ref(false)
const contributeErrorMessage = ref('')

const openContributeModal = () => {
	contributeErrorMessage.value = ''
	isContributeModalOpen.value = true
}

const confirmBecomeNodeProvider = async () => {
	contributeErrorMessage.value = ''
	isBecomingNodeProvider.value = true
	const config = useRuntimeConfig()

	try {
		await $fetch('/api/v1/users/me/become-node-provider', {
			method: 'POST',
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
		})

		toast.add({
			title: '申請成功',
			description: '您已成功取得節點提供者權限，請重新整理頁面以套用權限。',
			color: 'success',
			icon: 'i-heroicons-check-circle',
		})

		isContributeModalOpen.value = false
	}
	catch {
		contributeErrorMessage.value = '申請發生了一些問題，請聯繫管理員協助處理。'
	}
	finally {
		isBecomingNodeProvider.value = false
	}
}

const isDeleteModalOpen = ref(false)
const nodeToDelete = ref<AppNode | null>(null)
const isDeleting = ref(false)

const openDeleteModal = (node: AppNode) => {
	nodeToDelete.value = node
	isDeleteModalOpen.value = true
}

const confirmDelete = async () => {
	if (!nodeToDelete.value) return

	isDeleting.value = true
	const config = useRuntimeConfig()

	try {
		await $fetch(`/api/v1/nodes/${nodeToDelete.value.id}`, {
			method: 'DELETE',
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
		})

		toast.add({
			title: '刪除成功',
			description: `節點 ${nodeToDelete.value.name} 已成功移除。`,
			color: 'success',
			icon: 'i-heroicons-check-circle',
		})

		isDeleteModalOpen.value = false
		refreshNodes()
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		toast.add({
			title: '刪除失敗',
			description: err.data?.detail || '無法刪除該節點，請稍後再試。',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		})
	}
	finally {
		isDeleting.value = false
	}
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
				<UButton
					v-else
					icon="i-heroicons-hand-raised"
					color="neutral"
					variant="soft"
					label="我想貢獻節點"
					size="md"
					class="w-full sm:w-auto justify-center"
					@click="openContributeModal"
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
							@click="openDeleteModal(row.original)"
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

		<!-- 貢獻節點對話框 -->
		<div
			v-if="isContributeModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isContributeModalOpen = false"
		>
			<UCard class="w-full max-w-lg shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							我想貢獻節點
						</h3>
						<UButton
							color="neutral"
							variant="ghost"
							icon="i-heroicons-x-mark-20-solid"
							class="-my-1"
							@click="isContributeModalOpen = false"
						/>
					</div>
				</template>

				<div class="py-2 space-y-3">
					<UAlert
						v-if="contributeErrorMessage"
						color="error"
						variant="soft"
						icon="i-heroicons-exclamation-triangle"
						:title="contributeErrorMessage"
					/>

					<p class="text-sm text-gray-500 dark:text-gray-400">
						感謝您願意提供伺服器資源來協助擴充 TaiwanFRP 的節點！
					</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">
						點擊「確認申請」後，您將取得節點提供者的權限，之後即可自行新增與管理節點。
					</p>
				</div>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							label="取消"
							:disabled="isBecomingNodeProvider"
							@click="isContributeModalOpen = false"
						/>
						<UButton
							color="primary"
							label="確認申請"
							:loading="isBecomingNodeProvider"
							@click="confirmBecomeNodeProvider"
						/>
					</div>
				</template>
			</UCard>
		</div>

		<!-- 刪除確認對話框 -->
		<div
			v-if="isDeleteModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isDeleteModalOpen = false"
		>
			<UCard class="w-full max-w-lg shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							刪除節點
						</h3>
						<UButton
							color="neutral"
							variant="ghost"
							icon="i-heroicons-x-mark-20-solid"
							class="-my-1"
							@click="isDeleteModalOpen = false"
						/>
					</div>
				</template>

				<div class="py-2">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						確定要刪除節點 <span class="font-bold text-gray-900 dark:text-white">{{ nodeToDelete?.name }}</span> 嗎？
						<br><br>
						<span class="text-red-500 font-medium">注意：此操作無法復原，該節點下的所有隧道將會受到影響。</span>
					</p>
				</div>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							label="取消"
							:disabled="isDeleting"
							@click="isDeleteModalOpen = false"
						/>
						<UButton
							color="error"
							label="確認刪除"
							:loading="isDeleting"
							@click="confirmDelete"
						/>
					</div>
				</template>
			</UCard>
		</div>

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
				<div class="py-2 space-y-5 overflow-y-auto px-1">
					<UAlert
						v-if="formErrorMessage"
						color="error"
						variant="soft"
						icon="i-heroicons-exclamation-triangle"
						:title="formErrorMessage"
					/>

					<div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700">
						<div class="flex flex-col">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-200">
								公開節點
							</span>
						</div>
						<USwitch
							v-model="nodeForm.is_public"
							color="success"
						/>
					</div>

					<!-- 名稱與描述 -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">節點名稱 <span class="text-red-500">*</span></label>
							<UInput
								v-model="nodeForm.name"
								placeholder="例如：台北節點一"
							/>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">描述 (選填)</label>
							<UInput
								v-model="nodeForm.description"
								placeholder="簡單描述這個節點"
							/>
						</div>
					</div>

					<div class="border-t border-gray-100 dark:border-gray-800" />

					<!-- 伺服器位址 -->
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">伺服器位址 <span class="text-red-500">*</span></label>
						<UInput
							v-model="nodeForm.host"
							placeholder="例如：node1.taiwanfrp.me"
						/>
					</div>

					<!-- 連接埠範圍 -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">起始連接埠 <span class="text-red-500">*</span></label>
							<UInput
								v-model="nodeForm.port_start"
								type="number"
								:min="1"
								:max="65535"
								placeholder="例如：10000"
							/>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">結束連接埠 <span class="text-red-500">*</span></label>
							<UInput
								v-model="nodeForm.port_end"
								type="number"
								:min="1"
								:max="65535"
								placeholder="例如：20000"
							/>
						</div>
					</div>

					<!-- 管理員設定 -->
					<template v-if="isEditMode && canManageStatus">
						<div class="border-t border-gray-100 dark:border-gray-800" />

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">運營狀態 (管理員)</label>
								<USelect
									v-model="nodeForm.status"
									:items="statusOptions"
								/>
							</div>
						</div>
					</template>
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
