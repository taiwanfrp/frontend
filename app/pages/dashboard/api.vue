<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'dashboard',
})

interface AppApiKey {
	id: string
	description: string
	prefix: string
	expires_at: string | null
	permission_ids: number[]
}

interface AppPermission {
	id: number
	name: string
	description: string | null
	created_at: string
	updated_at: string
}

const toast = useToast()

const { data: apiKeys, pending: isApiKeysLoading, refresh: refreshApiKeys } = useApiFetch<AppApiKey[]>('/api/v1/api-keys', {
	server: false,
	lazy: true,
	default: () => [],
})

const { data: permissions } = useApiFetch<AppPermission[]>('/api/v1/permissions', {
	server: false,
	lazy: true,
	default: () => [],
})

// permission 與 permission_id 的對應表
const permissionMap = computed(() => {
	const map: Record<number, AppPermission> = {}
	for (const perm of (permissions.value || [])) {
		map[perm.id] = perm
	}
	return map
})

// 權限與顏色
const getPermissionColor = (name?: string) => {
	if (!name) return 'neutral'
	if (name.includes('delete')) return 'error'
	if (name.includes('create') || name.includes('update')) return 'warning'
	return 'primary'
}

const searchQuery = ref('')

const filteredKeys = computed(() => {
	if (!searchQuery.value) return apiKeys.value || []

	const query = searchQuery.value.toLowerCase()

	return (apiKeys.value || []).filter(item =>
		(item.description && item.description.toLowerCase().includes(query))
		|| (item.prefix && item.prefix.toLowerCase().includes(query)),
	)
})

const isFormModalOpen = ref(false)
const isSubmitting = ref(false)
const formErrorMessage = ref('')

const todayStr = new Date().toISOString().split('T')[0]

const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const defaultDateStr = tomorrow.toISOString().split('T')[0]

const apiKeyForm = ref({
	description: '',
	expirationType: 'never', // 'days', 'date', 'never'
	expirationDays: '30',
	expirationDate: defaultDateStr,
	permission_ids: [] as number[],
})

const expirationTypeOptions = [
	{ label: '永久有效', value: 'never' },
	{ label: '預設天數', value: 'days' },
	{ label: '自訂日期 (日曆)', value: 'date' },
]

const expirationDaysOptions = [
	{ label: '7 天', value: '7' },
	{ label: '30 天', value: '30' },
	{ label: '90 天', value: '90' },
	{ label: '365 天 (1 年)', value: '365' },
]

const openAddModal = () => {
	formErrorMessage.value = ''
	apiKeyForm.value = {
		description: '',
		expirationType: 'never',
		expirationDays: '30',
		expirationDate: defaultDateStr,
		permission_ids: [],
	}
	isFormModalOpen.value = true
}

const calculateExpiresAt = (): string | null => {
	const { expirationType, expirationDays, expirationDate } = apiKeyForm.value

	if (expirationType === 'never') return null

	if (expirationType === 'days') {
		const days = parseInt(expirationDays)
		const date = new Date()
		date.setDate(date.getDate() + days)
		return date.toISOString()
	}

	if (expirationType === 'date') {
		if (!expirationDate) return null
		const date = new Date(expirationDate)
		// 選擇日期當天的 23:59:59 到期
		date.setHours(23, 59, 59, 999)
		return date.toISOString()
	}

	return null
}

const isSuccessModalOpen = ref(false)
const newlyCreatedKey = ref('')
const isCopied = ref(false)

const submitForm = async () => {
	formErrorMessage.value = ''

	if (!apiKeyForm.value.description) {
		formErrorMessage.value = '請填寫金鑰名稱/用途描述'
		return
	}

	if (apiKeyForm.value.expirationType === 'date' && !apiKeyForm.value.expirationDate) {
		formErrorMessage.value = '請選擇到期日期'
		return
	}

	isSubmitting.value = true
	const config = useRuntimeConfig()

	const requestBody = {
		description: apiKeyForm.value.description,
		expires_at: calculateExpiresAt(),
		permission_ids: apiKeyForm.value.permission_ids,
	}

	try {
		const response = await $fetch<{ api_key: string }>('/api/v1/api-keys', {
			method: 'POST',
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
			body: requestBody,
		})

		isFormModalOpen.value = false
		refreshApiKeys()

		newlyCreatedKey.value = response.api_key
		isSuccessModalOpen.value = true
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string | unknown[] } }
		let errorMsg = '無法建立 API 金鑰，請稍後再試。'

		if (err.data && err.data.detail) {
			if (typeof err.data.detail === 'string') {
				errorMsg = err.data.detail
			}
			else if (Array.isArray(err.data.detail)) {
				errorMsg = '輸入格式有誤，請檢查您的資料'
			}
		}
		formErrorMessage.value = errorMsg
	}
	finally {
		isSubmitting.value = false
	}
}

const copyApiKey = async () => {
	try {
		await navigator.clipboard.writeText(newlyCreatedKey.value)
		isCopied.value = true
		setTimeout(() => {
			isCopied.value = false
		}, 2000)
	}
	catch {
		toast.add({ title: '複製失敗', color: 'error' })
	}
}

const isDeleteModalOpen = ref(false)
const keyToDelete = ref<AppApiKey | null>(null)
const isDeleting = ref(false)

const openDeleteModal = (apiKey: AppApiKey) => {
	keyToDelete.value = apiKey
	isDeleteModalOpen.value = true
}

const confirmDelete = async () => {
	if (!keyToDelete.value) return

	isDeleting.value = true
	const config = useRuntimeConfig()

	try {
		await $fetch(`/api/v1/api-keys/${keyToDelete.value.id}`, {
			method: 'DELETE',
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
		})

		toast.add({
			title: '刪除成功',
			description: `API 金鑰「${keyToDelete.value.description || keyToDelete.value.prefix}」已成功移除。`,
			color: 'success',
			icon: 'i-heroicons-check-circle',
		})

		isDeleteModalOpen.value = false
		refreshApiKeys()
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		toast.add({
			title: '刪除失敗',
			description: err.data?.detail || '無法刪除該 API 金鑰，請稍後再試。',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		})
	}
	finally {
		isDeleting.value = false
	}
}

const columns: TableColumn<AppApiKey>[] = [
	{ accessorKey: 'description', header: '金鑰名稱' },
	{ accessorKey: 'prefix', header: 'API 金鑰前綴' },
	{ accessorKey: 'permission_ids', header: '權限範圍' },
	{ accessorKey: 'expires_at', header: '到期時間' },
	{ id: 'actions', header: '' },
]
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<!-- 頁面標頭 -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				API 金鑰管理
			</h1>

			<div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
				<UButton
					icon="i-heroicons-plus"
					color="primary"
					label="產生新金鑰"
					size="md"
					class="w-full sm:w-auto justify-center"
					@click="openAddModal"
				/>

				<div class="w-full sm:w-72">
					<UInput
						v-model="searchQuery"
						icon="i-heroicons-magnifying-glass"
						placeholder="搜尋名稱或金鑰..."
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

		<!-- 表格卡片 -->
		<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
			<UTable
				:data="filteredKeys"
				:columns="columns"
				:loading="isApiKeysLoading"
				class="text-base [&_th]:text-center! [&_td]:text-center!"
			>
				<template #description-cell="{ row }">
					<span class="text-base font-semibold text-gray-900 dark:text-white">
						{{ row.original.description || '未命名金鑰' }}
					</span>
				</template>

				<template #prefix-cell="{ row }">
					<span class="text-base text-gray-600 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md">
						{{ row.original.prefix }}...
					</span>
				</template>

				<!-- 權限範圍 -->
				<template #permission_ids-cell="{ row }">
					<span
						v-if="!row.original.permission_ids || row.original.permission_ids.length === 0"
						class="text-sm text-gray-400 dark:text-gray-500"
					>
						無權限
					</span>

					<UPopover
						v-else
						mode="hover"
						:popper="{ placement: 'top' }"
					>
						<!-- 表格內只顯示前兩個 -->
						<div class="flex items-center justify-center gap-1.5 cursor-help">
							<UBadge
								v-for="permId in row.original.permission_ids.slice(0, 2)"
								:key="permId"
								:color="getPermissionColor(permissionMap[permId]?.name)"
								variant="subtle"
								size="sm"
								class="max-w-30 truncate block"
							>
								{{ permissionMap[permId]?.description || permissionMap[permId]?.name || `ID: ${permId}` }}
							</UBadge>

							<!-- 顯示剩餘數量 -->
							<UBadge
								v-if="row.original.permission_ids.length > 2"
								color="neutral"
								variant="subtle"
								size="sm"
								class="font-bold"
							>
								+{{ row.original.permission_ids.length - 2 }}
							</UBadge>
						</div>

						<!-- 滑鼠移上去後顯示的完整列表 -->
						<template #content>
							<div class="p-3 text-left">
								<div class="text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-1.5 mb-2.5">
									完整權限清單 (共 {{ row.original.permission_ids.length }} 項)
								</div>
								<!-- flex-col 一行一個 -->
								<div class="flex flex-col gap-2">
									<div
										v-for="permId in row.original.permission_ids"
										:key="permId"
										class="flex items-center justify-between gap-3"
									>
										<UBadge
											:color="getPermissionColor(permissionMap[permId]?.name)"
											variant="subtle"
											size="sm"
										>
											{{ permissionMap[permId]?.description || permissionMap[permId]?.name || `ID: ${permId}` }}
										</UBadge>

										<!-- 權限節點名稱 -->
										<span class="text-xs text-gray-400 font-mono">
											{{ permissionMap[permId]?.name }}
										</span>
									</div>
								</div>
							</div>
						</template>
					</UPopover>
				</template>

				<template #expires_at-cell="{ row }">
					<span class="text-gray-500 dark:text-gray-400 text-sm">
						{{ row.original.expires_at ? new Date(row.original.expires_at).toLocaleString('zh-TW') : '永久有效' }}
					</span>
				</template>

				<template #actions-cell="{ row }">
					<div class="flex items-center justify-center gap-1">
						<UButton
							color="error"
							variant="ghost"
							icon="i-heroicons-trash"
							size="lg"
							title="刪除金鑰"
							@click="openDeleteModal(row.original)"
						/>
					</div>
				</template>

				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<UIcon
							name="i-heroicons-key"
							class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						/>
						<span class="text-base font-medium text-gray-900 dark:text-white">
							{{ searchQuery ? '找不到符合的金鑰' : '您目前還沒有建立任何 API 金鑰' }}
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

		<!-- 新增 API Key 對話框 -->
		<div
			v-if="isFormModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isFormModalOpen = false"
		>
			<UCard class="w-full max-w-2xl shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800 flex flex-col max-h-[90vh]">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							產生新 API 金鑰
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

				<div class="py-2 space-y-5 overflow-y-auto px-1">
					<UAlert
						v-if="formErrorMessage"
						color="error"
						variant="soft"
						icon="i-heroicons-exclamation-triangle"
						:title="formErrorMessage"
					/>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">用途描述 <span class="text-red-500">*</span></label>
						<UInput
							v-model="apiKeyForm.description"
							placeholder="例如：測試用"
						/>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">到期時間</label>
						<div class="flex gap-2">
							<USelect
								v-model="apiKeyForm.expirationType"
								:items="expirationTypeOptions"
								class="w-1/2"
							/>

							<USelect
								v-if="apiKeyForm.expirationType === 'days'"
								v-model="apiKeyForm.expirationDays"
								:items="expirationDaysOptions"
								class="w-1/2"
							/>

							<!-- 選擇自訂日期使用瀏覽器原生日曆 -->
							<UInput
								v-else-if="apiKeyForm.expirationType === 'date'"
								v-model="apiKeyForm.expirationDate"
								type="date"
								:min="todayStr"
								class="w-1/2"
							/>

							<!-- 永久有效 -->
							<div
								v-else
								class="w-1/2 flex items-center justify-center px-3 text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
							>
								金鑰將不會過期
							</div>
						</div>
					</div>

					<div class="space-y-2">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">權限範圍</label>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md">
							<UCheckbox
								v-for="perm in permissions"
								:key="perm.id"
								:model-value="apiKeyForm.permission_ids.includes(perm.id)"
								:label="perm.description || perm.name"
								:help="perm.name"
								@update:model-value="(checked) => {
									if (checked) {
										apiKeyForm.permission_ids.push(perm.id)
									}
									else {
										apiKeyForm.permission_ids = apiKeyForm.permission_ids.filter(id => id !== perm.id)
									}
								}"
							/>
						</div>
					</div>
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
							label="產生金鑰"
							:loading="isSubmitting"
							@click="submitForm"
						/>
					</div>
				</template>
			</UCard>
		</div>

		<!-- API Key 建立成功對話框 -->
		<div
			v-if="isSuccessModalOpen"
			class="fixed inset-0 z-110 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isSuccessModalOpen = false"
		>
			<UCard class="w-full max-w-lg shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800 flex flex-col max-h-[90vh]">
				<template #header>
					<div class="flex items-center gap-2">
						<UIcon
							name="i-heroicons-check-circle"
							class="w-6 h-6 text-green-500"
						/>
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							API 金鑰建立成功
						</h3>
					</div>
				</template>

				<div class="py-2 space-y-4 overflow-y-auto px-1">
					<UAlert
						color="warning"
						variant="soft"
						icon="i-heroicons-exclamation-triangle"
						title="請立即複製您的金鑰！"
						description="基於安全考量，這將是您唯一一次能看見完整金鑰的機會。關閉此視窗後，您將無法再次查看此金鑰內容。"
					/>

					<div class="group relative flex items-center justify-between bg-gray-900 text-gray-300 font-mono text-sm sm:text-base rounded-xl p-4 overflow-hidden">
						<div class="truncate mr-4 overflow-x-auto whitespace-nowrap hide-scrollbar select-all">
							{{ newlyCreatedKey }}
						</div>
						<UButton
							:icon="isCopied ? 'i-heroicons-check-circle' : 'i-heroicons-clipboard-document'"
							:color="isCopied ? 'primary' : 'neutral'"
							variant="ghost"
							class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all bg-gray-800/80 hover:bg-gray-700"
							aria-label="Copy to clipboard"
							@click="copyApiKey"
						/>
					</div>
				</div>

				<template #footer>
					<div class="flex justify-end">
						<UButton
							color="primary"
							label="我已妥善保存，關閉視窗"
							@click="isSuccessModalOpen = false"
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
							刪除 API 金鑰
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
						確定要刪除 API 金鑰 <span class="font-bold text-gray-900 dark:text-white">{{ keyToDelete?.description || keyToDelete?.prefix }}</span> 嗎？
						<br><br>
						<span class="text-red-500 font-medium">注意：此操作無法復原，所有使用此金鑰的外部程式或整合將立即失效。</span>
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
	</div>
</template>
