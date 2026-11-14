<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'admin',
})

interface AdminPermission {
	id: number
	name: string
	description: string | null
}

interface AdminRole {
	id: number
	name: string
	description: string | null
	max_tunnels: number
	max_bandwidth: number
	permissions: AdminPermission[]
	created_at: string
	updated_at: string
}

const SYSTEM_ROLES = ['admin', 'user', 'node_provider']
const COLLAPSED_COUNT = 6

const columns: TableColumn<AdminRole>[] = [
	{ id: 'role', header: '身份組' },
	{ id: 'limits', header: '資源限制' },
	{ id: 'permissions', header: '權限' },
	{ accessorKey: 'updated_at', header: '更新時間' },
]

const { data: roles, pending: isRolesLoading, refresh: refreshRoles } = useApiFetch<AdminRole[]>('/api/v1/roles', {
	server: false,
	lazy: true,
	default: () => [],
})

const { data: ownPermissions } = useApiFetch<AdminPermission[]>('/api/v1/permissions', {
	server: false,
	lazy: true,
	default: () => [],
})

const config = useRuntimeConfig()
const toast = useToast()

const searchQuery = ref('')

const filteredRoles = computed(() => {
	const query = searchQuery.value.trim().toLowerCase()
	if (!query) return roles.value || []

	return (roles.value || []).filter(role =>
		role.name.toLowerCase().includes(query)
		|| (role.description || '').toLowerCase().includes(query)
		|| (role.permissions || []).some(permission => permission.name.toLowerCase().includes(query)),
	)
})

const expandedRoles = ref(new Set<number>())

const toggleExpanded = (roleId: number) => {
	const expanded = new Set(expandedRoles.value)
	if (expanded.has(roleId)) {
		expanded.delete(roleId)
	}
	else {
		expanded.add(roleId)
	}
	expandedRoles.value = expanded
}

const visiblePermissions = (role: AdminRole) => {
	const permissions = [...(role.permissions || [])].sort((a, b) => a.name.localeCompare(b.name))
	return expandedRoles.value.has(role.id) ? permissions : permissions.slice(0, COLLAPSED_COUNT)
}

const getPermissionColor = (name: string) => {
	if (name.includes('delete')) return 'error'
	if (name.includes('create') || name.includes('update')) return 'warning'
	return 'primary'
}

const permissionGroups = computed(() => {
	const all = new Map<number, AdminPermission>()
	for (const permission of ownPermissions.value || []) all.set(permission.id, permission)
	for (const role of roles.value || []) {
		for (const permission of role.permissions || []) all.set(permission.id, permission)
	}

	const groups = new Map<string, AdminPermission[]>()
	for (const permission of [...all.values()].sort((a, b) => a.name.localeCompare(b.name))) {
		const resource = permission.name.split('.')[0] || ''
		groups.set(resource, [...(groups.get(resource) || []), permission])
	}
	return [...groups.entries()].map(([resource, permissions]) => ({ resource, permissions }))
})

const emptyForm = () => ({
	name: '',
	description: '',
	max_tunnels: 0,
	max_bandwidth: 0,
	permissions: [] as number[],
})

const isFormModalOpen = ref(false)
const isSubmitting = ref(false)
const formErrorMessage = ref('')
const roleForm = ref(emptyForm())

const openAddModal = () => {
	roleForm.value = emptyForm()
	formErrorMessage.value = ''
	isFormModalOpen.value = true
}

const togglePermission = (permissionId: number, checked: boolean) => {
	const selected = roleForm.value.permissions.filter(id => id !== permissionId)
	roleForm.value.permissions = checked ? [...selected, permissionId] : selected
}

const isValidLimit = (value: unknown) => Number.isInteger(value) && (value as number) >= 0

const submitForm = async () => {
	const name = roleForm.value.name.trim()
	if (!name) {
		formErrorMessage.value = '請填寫身份組名稱'
		return
	}
	if (!isValidLimit(roleForm.value.max_tunnels) || !isValidLimit(roleForm.value.max_bandwidth)) {
		formErrorMessage.value = '隧道數量與限速必須是 0 以上的整數'
		return
	}

	formErrorMessage.value = ''
	isSubmitting.value = true
	try {
		await $fetch('/api/v1/roles', {
			method: 'POST',
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
			body: {
				name,
				description: roleForm.value.description.trim() || null,
				max_tunnels: roleForm.value.max_tunnels,
				max_bandwidth: roleForm.value.max_bandwidth,
				permissions: roleForm.value.permissions,
			},
		})

		toast.add({
			title: '新增成功',
			description: `身份組 ${name} 已成功建立。`,
			color: 'success',
			icon: 'i-heroicons-check-circle',
		})
		isFormModalOpen.value = false
		refreshRoles()
	}
	catch (error: unknown) {
		const detail = (error as { data?: { detail?: unknown } }).data?.detail
		if (typeof detail !== 'string') {
			formErrorMessage.value = '無法建立身份組，請檢查輸入資料或稍後再試。'
		}
		else if (detail.includes('already exists')) {
			formErrorMessage.value = '已經有相同名稱的身份組。'
		}
		else {
			formErrorMessage.value = detail
		}
	}
	finally {
		isSubmitting.value = false
	}
}

const formatDate = (value: string) => new Date(value).toLocaleString('zh-TW')

const formatLimit = (value: number, unit = '') => (value === 0 ? '無限制' : `${value}${unit}`)
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
					所有身份組
				</h1>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					共 {{ roles?.length || 0 }} 個，符合條件 {{ filteredRoles.length }} 個
				</p>
			</div>

			<div class="flex gap-2 w-full sm:w-auto">
				<UButton
					icon="i-heroicons-arrow-path"
					color="neutral"
					variant="outline"
					title="重新整理"
					:loading="isRolesLoading"
					@click="refreshRoles()"
				/>
				<UInput
					v-model="searchQuery"
					icon="i-heroicons-magnifying-glass"
					placeholder="搜尋名稱、描述或權限..."
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
				<UButton
					icon="i-heroicons-plus"
					color="primary"
					label="新增身份組"
					@click="openAddModal"
				/>
			</div>
		</div>

		<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
			<UTable
				:data="filteredRoles"
				:columns="columns"
				:loading="isRolesLoading"
			>
				<template #role-cell="{ row }">
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<span class="font-medium text-gray-900 dark:text-white">
								{{ row.original.name }}
							</span>
							<UBadge
								v-if="SYSTEM_ROLES.includes(row.original.name)"
								color="neutral"
								variant="subtle"
								size="sm"
							>
								系統預設
							</UBadge>
						</div>
						<div class="text-xs text-gray-500 dark:text-gray-400 whitespace-normal">
							{{ row.original.description || '沒有描述' }}
						</div>
					</div>
				</template>

				<template #limits-cell="{ row }">
					<div class="text-sm text-gray-600 dark:text-gray-300">
						<div>FRP 隧道：{{ formatLimit(row.original.max_tunnels, ' 條') }}</div>
						<div>限速：{{ formatLimit(row.original.max_bandwidth, ' MB/s') }}</div>
					</div>
				</template>

				<template #permissions-cell="{ row }">
					<div class="flex flex-wrap items-center gap-1 max-w-xl">
						<UBadge
							v-for="permission in visiblePermissions(row.original)"
							:key="permission.id"
							:color="getPermissionColor(permission.name)"
							variant="subtle"
							:title="permission.description || undefined"
						>
							{{ permission.name }}
						</UBadge>
						<span
							v-if="!row.original.permissions?.length"
							class="text-gray-400"
						>-</span>
						<UButton
							v-if="(row.original.permissions?.length || 0) > COLLAPSED_COUNT"
							color="neutral"
							variant="link"
							size="xs"
							@click="toggleExpanded(row.original.id)"
						>
							{{ expandedRoles.has(row.original.id) ? '收合' : `還有 ${row.original.permissions.length - COLLAPSED_COUNT} 個` }}
						</UButton>
					</div>
				</template>

				<template #updated_at-cell="{ row }">
					<span class="text-sm text-gray-600 dark:text-gray-300">
						{{ formatDate(row.original.updated_at) }}
					</span>
				</template>

				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<UIcon
							name="i-heroicons-identification"
							class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						/>
						<span class="text-base font-medium text-gray-900 dark:text-white">
							{{ searchQuery ? '找不到符合的身份組' : '目前沒有任何身份組' }}
						</span>
					</div>
				</template>
			</UTable>
		</UCard>

		<div
			v-if="isFormModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isFormModalOpen = false"
		>
			<UCard class="w-full max-w-2xl shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800 flex flex-col max-h-[90vh]">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							新增身份組
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

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">名稱 <span class="text-red-500">*</span></label>
							<UInput
								v-model="roleForm.name"
								:maxlength="50"
								placeholder="例如：vip"
								class="w-full"
							/>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">描述 (選填)</label>
							<UInput
								v-model="roleForm.description"
								:maxlength="255"
								placeholder="簡單描述這個身份組的用途"
								class="w-full"
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">FRP 隧道數量 <span class="text-red-500">*</span></label>
							<UInput
								v-model.number="roleForm.max_tunnels"
								type="number"
								:min="0"
								class="w-full"
							/>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">限速 (MB/s) <span class="text-red-500">*</span></label>
							<UInput
								v-model.number="roleForm.max_bandwidth"
								type="number"
								:min="0"
								class="w-full"
							/>
						</div>
					</div>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						0 表示無限制
					</p>

					<div class="border-t border-gray-100 dark:border-gray-800" />

					<div class="space-y-3">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
							權限（已選 {{ roleForm.permissions.length }} 個）
						</label>
						<div class="max-h-64 overflow-y-auto space-y-3 rounded-md border border-gray-200 dark:border-gray-700 p-3">
							<div
								v-for="group in permissionGroups"
								:key="group.resource"
								class="space-y-2"
							>
								<div class="text-xs font-semibold text-gray-500 dark:text-gray-400">
									{{ group.resource }}
								</div>
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
									<UCheckbox
										v-for="permission in group.permissions"
										:key="permission.id"
										:model-value="roleForm.permissions.includes(permission.id)"
										:label="permission.name"
										:description="permission.description || undefined"
										@update:model-value="togglePermission(permission.id, $event === true)"
									/>
								</div>
							</div>
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
							label="確認新增"
							:loading="isSubmitting"
							@click="submitForm"
						/>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
