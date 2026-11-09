<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'admin',
})

interface AdminUser {
	id: string
	discord_id: string
	status: 'active' | 'suspended' | 'banned' | 'deleted'
	status_reason: string | null
	status_until: string | null
	custom_max_tunnels: number | null
	custom_max_bandwidth: number | null
	roles: { id: number, name: string }[]
	created_at: string
	updated_at: string
}

const ACCOUNT_STATUS = {
	active: { label: '正常', color: 'success' },
	suspended: { label: '尚未啟用', color: 'warning' },
	banned: { label: '已封禁', color: 'error' },
	deleted: { label: '已刪除', color: 'neutral' },
} as const

const statusOptions = [
	{ label: '全部狀態', value: 'all' },
	...Object.entries(ACCOUNT_STATUS).map(([value, { label }]) => ({ label, value })),
]

const columns: TableColumn<AdminUser>[] = [
	{ accessorKey: 'discord_id', header: 'Discord ID' },
	{ accessorKey: 'status', header: '狀態' },
	{ id: 'roles', header: '身份組' },
	{ id: 'limits', header: '資源限制' },
	{ accessorKey: 'created_at', header: '建立時間' },
]

const { data: users, pending: isUsersLoading, error: usersError, refresh: refreshUsers } = useApiFetch<AdminUser[]>('/api/v1/users', {
	server: false,
	lazy: true,
	default: () => [],
})

const errorMessage = computed(() => {
	if (!usersError.value) return ''
	const statusCode = usersError.value.statusCode
	if (statusCode === 401) return '尚未登入，請先登入後再試一次。'
	if (statusCode === 403) return '沒有查看使用者的權限（需要 user.read.all）。'
	const detail = (usersError.value.data as { detail?: unknown } | undefined)?.detail
	return typeof detail === 'string' ? detail : '無法取得使用者列表，請稍後再試。'
})

const searchQuery = ref('')
const statusFilter = ref('all')

const filteredUsers = computed(() => {
	const query = searchQuery.value.trim().toLowerCase()

	return (users.value || []).filter((user) => {
		if (statusFilter.value !== 'all' && user.status !== statusFilter.value) return false
		if (!query) return true
		return user.discord_id.includes(query)
			|| (user.roles || []).some(role => role.name.toLowerCase().includes(query))
	})
})

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('zh-TW') : '')

// null 表示依身份組, 0 表示無限制
const formatLimit = (value: number | null, unit = '') => {
	if (value === null) return '依身份組'
	if (value === 0) return '無限制'
	return `${value}${unit}`
}
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
					所有使用者
				</h1>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					共 {{ users?.length || 0 }} 位，符合條件 {{ filteredUsers.length }} 位
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
					:loading="isUsersLoading"
					@click="refreshUsers()"
				/>
				<UInput
					v-model="searchQuery"
					icon="i-heroicons-magnifying-glass"
					placeholder="搜尋 Discord ID 或身份組..."
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
				:data="filteredUsers"
				:columns="columns"
				:loading="isUsersLoading"
			>
				<template #discord_id-cell="{ row }">
					<span class="font-mono text-gray-900 dark:text-white">
						{{ row.original.discord_id }}
					</span>
				</template>

				<template #status-cell="{ row }">
					<div class="flex flex-col gap-1">
						<UBadge
							:color="ACCOUNT_STATUS[row.original.status].color"
							variant="subtle"
							class="w-fit"
						>
							{{ ACCOUNT_STATUS[row.original.status].label }}
						</UBadge>
						<!-- 停權, 封禁的原因與期限 -->
						<span
							v-if="row.original.status === 'suspended' || row.original.status === 'banned'"
							class="text-xs text-gray-500 dark:text-gray-400"
						>
							{{ row.original.status_reason || '未提供原因' }}・{{ row.original.status_until ? `到 ${formatDate(row.original.status_until)}` : '永久' }}
						</span>
					</div>
				</template>

				<template #roles-cell="{ row }">
					<div class="flex flex-wrap gap-1">
						<UBadge
							v-for="role in row.original.roles || []"
							:key="role.id"
							color="neutral"
							variant="outline"
						>
							{{ role.name }}
						</UBadge>
						<span
							v-if="!row.original.roles?.length"
							class="text-gray-400"
						>-</span>
					</div>
				</template>

				<!-- 後端目前只有一個頻寬上限, 上傳與下載共用 -->
				<template #limits-cell="{ row }">
					<div class="text-sm text-gray-600 dark:text-gray-300">
						<div>FRP 隧道：{{ formatLimit(row.original.custom_max_tunnels, ' 條') }}</div>
						<div>上傳限速：{{ formatLimit(row.original.custom_max_bandwidth, ' Mbps') }}</div>
						<div>下載限速：{{ formatLimit(row.original.custom_max_bandwidth, ' Mbps') }}</div>
					</div>
				</template>

				<template #created_at-cell="{ row }">
					<span class="text-sm text-gray-600 dark:text-gray-300">
						{{ formatDate(row.original.created_at) }}
					</span>
				</template>

				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<UIcon
							name="i-heroicons-users"
							class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						/>
						<span class="text-base font-medium text-gray-900 dark:text-white">
							{{ errorMessage ? '無法顯示使用者' : searchQuery || statusFilter !== 'all' ? '找不到符合的使用者' : '目前沒有任何使用者' }}
						</span>
					</div>
				</template>
			</UTable>
		</UCard>
	</div>
</template>
