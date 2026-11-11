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
	permissions: AdminPermission[]
}

interface PermissionRow extends AdminPermission {
	resource: string
	roles: { id: number, name: string }[]
}

const columns: TableColumn<PermissionRow>[] = [
	{ accessorKey: 'name', header: '權限節點' },
	{ accessorKey: 'description', header: '說明' },
	{ id: 'roles', header: '擁有的身份組' },
]

const { data: permissions, pending: isPermissionsLoading, refresh: refreshPermissions } = useApiFetch<AdminPermission[]>('/api/v1/permissions', {
	server: false,
	lazy: true,
	default: () => [],
})

const { data: roles, pending: isRolesLoading, refresh: refreshRoles } = useApiFetch<AdminRole[]>('/api/v1/roles', {
	server: false,
	lazy: true,
	default: () => [],
})

const isLoading = computed(() => isPermissionsLoading.value || isRolesLoading.value)

const refresh = () => Promise.all([refreshPermissions(), refreshRoles()])

const rows = computed<PermissionRow[]>(() => {
	const map = new Map<number, PermissionRow>()
	const add = (permission: AdminPermission) => {
		if (!map.has(permission.id)) {
			map.set(permission.id, { ...permission, resource: permission.name.split('.')[0] || '', roles: [] })
		}
		return map.get(permission.id)!
	}

	for (const permission of permissions.value || []) add(permission)
	for (const role of roles.value || []) {
		for (const permission of role.permissions || []) {
			add(permission).roles.push({ id: role.id, name: role.name })
		}
	}

	return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const resourceOptions = computed(() => [
	{ label: '全部資源', value: 'all' },
	...[...new Set(rows.value.map(row => row.resource))].sort().map(resource => ({ label: resource, value: resource })),
])

const searchQuery = ref('')
const resourceFilter = ref('all')

const filteredRows = computed(() => {
	const query = searchQuery.value.trim().toLowerCase()

	return rows.value.filter((row) => {
		if (resourceFilter.value !== 'all' && row.resource !== resourceFilter.value) return false
		if (!query) return true
		return row.name.toLowerCase().includes(query)
			|| (row.description || '').toLowerCase().includes(query)
			|| row.roles.some(role => role.name.toLowerCase().includes(query))
	})
})

const getPermissionColor = (name: string) => {
	if (name.includes('delete')) return 'error'
	if (name.includes('create') || name.includes('update')) return 'warning'
	return 'primary'
}
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
					所有權限節點
				</h1>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					共 {{ rows.length }} 個，符合條件 {{ filteredRows.length }} 個
				</p>
			</div>

			<div class="flex gap-2 w-full sm:w-auto">
				<USelect
					v-model="resourceFilter"
					:items="resourceOptions"
					class="w-32"
				/>
				<UButton
					icon="i-heroicons-arrow-path"
					color="neutral"
					variant="outline"
					title="重新整理"
					:loading="isLoading"
					@click="refresh()"
				/>
				<UInput
					v-model="searchQuery"
					icon="i-heroicons-magnifying-glass"
					placeholder="搜尋權限、說明或身份組..."
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
			color="neutral"
			variant="subtle"
			icon="i-heroicons-information-circle"
			description="權限節點由後端預先建立，這裡只能查看。沒有任何身份組擁有、而且你自己也沒有的權限不會列出。"
		/>

		<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
			<UTable
				:data="filteredRows"
				:columns="columns"
				:loading="isLoading"
			>
				<template #name-cell="{ row }">
					<UBadge
						:color="getPermissionColor(row.original.name)"
						variant="subtle"
						class="font-mono"
					>
						{{ row.original.name }}
					</UBadge>
				</template>

				<template #description-cell="{ row }">
					<span class="text-sm text-gray-600 dark:text-gray-300 whitespace-normal">
						{{ row.original.description || '-' }}
					</span>
				</template>

				<template #roles-cell="{ row }">
					<div class="flex flex-wrap gap-1">
						<UBadge
							v-for="role in row.original.roles"
							:key="role.id"
							color="neutral"
							variant="outline"
						>
							{{ role.name }}
						</UBadge>
						<span
							v-if="!row.original.roles.length"
							class="text-gray-400"
						>沒有身份組擁有</span>
					</div>
				</template>

				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<UIcon
							name="i-heroicons-key"
							class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						/>
						<span class="text-base font-medium text-gray-900 dark:text-white">
							{{ searchQuery || resourceFilter !== 'all' ? '找不到符合的權限節點' : '目前沒有任何權限節點' }}
						</span>
					</div>
				</template>
			</UTable>
		</UCard>
	</div>
</template>
