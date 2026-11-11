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

// 後端不允許改名與刪除的身份組
const SYSTEM_ROLES = ['admin', 'user', 'node_provider']
// 權限超過這個數量時先收合
const COLLAPSED_COUNT = 6

const columns: TableColumn<AdminRole>[] = [
	{ id: 'role', header: '身份組' },
	{ id: 'limits', header: '資源限制' },
	{ id: 'permissions', header: '權限' },
	{ accessorKey: 'updated_at', header: '更新時間' },
]

const { data: roles, pending: isRolesLoading, error: rolesError, refresh: refreshRoles } = useApiFetch<AdminRole[]>('/api/v1/roles', {
	server: false,
	lazy: true,
	default: () => [],
})

const errorMessage = computed(() => {
	if (!rolesError.value) return ''
	const statusCode = rolesError.value.statusCode
	if (statusCode === 401) return '尚未登入，請先登入後再試一次。'
	if (statusCode === 403) return '沒有查看身份組的權限（需要 role.read.all）。'
	const detail = (rolesError.value.data as { detail?: unknown } | undefined)?.detail
	return typeof detail === 'string' ? detail : '無法取得身份組列表，請稍後再試。'
})

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

const formatDate = (value: string) => new Date(value).toLocaleString('zh-TW')

// 0 表示無限制
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
			</div>
		</div>

		<UAlert
			v-if="errorMessage"
			color="error"
			variant="subtle"
			icon="i-heroicons-exclamation-triangle"
			title="載入失敗"
			:description="errorMessage"
		/>

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
							{{ errorMessage ? '無法顯示身份組' : searchQuery ? '找不到符合的身份組' : '目前沒有任何身份組' }}
						</span>
					</div>
				</template>
			</UTable>
		</UCard>
	</div>
</template>
