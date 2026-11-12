<script setup lang="ts">
definePageMeta({
	layout: 'admin',
})

type UserStatus = 'active' | 'suspended' | 'banned' | 'deleted'

interface AdminUser {
	id: string
	discord_id: string
	status: UserStatus
	status_reason: string | null
	status_until: string | null
	member?: {
		username: string
		global_name: string | null
		nick: string | null
		avatar: string | null
	} | null
	created_at: string
}

interface AdminRole {
	id: number
	permissions: { id: number }[]
}

const USER_STATUS = {
	active: { label: '正常', color: 'success' },
	suspended: { label: '尚未啟用', color: 'warning' },
	banned: { label: '已封禁', color: 'error' },
	deleted: { label: '已刪除', color: 'neutral' },
} as const

const NODE_STATUS: Record<string, string> = {
	active: '可用',
	draft: '待審核',
	reviewing: '審核中',
	maintenance: '維護中',
	disabled: '停用',
}

const RECENT_COUNT = 5

const fetchOptions = { server: false, lazy: true, default: () => [] }

const { data: users, pending: isUsersLoading } = useApiFetch<AdminUser[]>('/api/v1/users', fetchOptions)
const { data: roles, pending: isRolesLoading } = useApiFetch<AdminRole[]>('/api/v1/roles', fetchOptions)
const { data: permissions, pending: isPermissionsLoading } = useApiFetch<{ id: number }[]>('/api/v1/permissions', fetchOptions)
const { data: nodes, pending: isNodesLoading } = useApiFetch<{ status: string }[]>('/api/v1/nodes', fetchOptions)

const { getAvatarUrl } = useAuth()

const displayName = (user: AdminUser) =>
	user.member?.nick || user.member?.global_name || user.member?.username || user.discord_id

const formatDate = (value: string) => new Date(value).toLocaleString('zh-TW')

const countBy = (values: string[]) => {
	const counts: Record<string, number> = {}
	for (const value of values) counts[value] = (counts[value] || 0) + 1
	return counts
}

const summarize = (counts: Record<string, number>, labels: Record<string, string>) =>
	Object.entries(labels)
		.filter(([key]) => counts[key])
		.map(([key, label]) => `${label} ${counts[key]}`)
		.join('・')

const permissionCount = computed(() => new Set([
	...(permissions.value || []).map(permission => permission.id),
	...(roles.value || []).flatMap(role => (role.permissions || []).map(permission => permission.id)),
]).size)

const cards = computed(() => [
	{
		label: '使用者',
		icon: 'i-heroicons-users',
		to: '/admin/users',
		loading: isUsersLoading.value,
		count: users.value?.length || 0,
		detail: summarize(
			countBy((users.value || []).map(user => user.status)),
			Object.fromEntries(Object.entries(USER_STATUS).map(([key, { label }]) => [key, label])),
		),
	},
	{
		label: '身份組',
		icon: 'i-heroicons-identification',
		to: '/admin/roles',
		loading: isRolesLoading.value,
		count: roles.value?.length || 0,
		detail: '',
	},
	{
		label: '權限節點',
		icon: 'i-heroicons-key',
		to: '/admin/permissions',
		loading: isRolesLoading.value || isPermissionsLoading.value,
		count: permissionCount.value,
		detail: '',
	},
	{
		label: '節點',
		icon: 'i-heroicons-server-stack',
		to: '/dashboard/nodes',
		loading: isNodesLoading.value,
		count: nodes.value?.length || 0,
		detail: summarize(countBy((nodes.value || []).map(node => node.status)), NODE_STATUS),
	},
])

const recentUsers = computed(() =>
	[...(users.value || [])]
		.sort((a, b) => b.created_at.localeCompare(a.created_at))
		.slice(0, RECENT_COUNT),
)

const attentionUsers = computed(() =>
	(users.value || []).filter(user => user.status === 'suspended' || user.status === 'banned'),
)
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
			概覽
		</h1>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
			<NuxtLink
				v-for="card in cards"
				:key="card.label"
				:to="card.to"
			>
				<UCard class="h-full bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50 hover:ring-primary-500/50 transition">
					<div class="flex items-center gap-4">
						<div class="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-lg text-primary-600 dark:text-primary-400">
							<UIcon
								:name="card.icon"
								class="w-6 h-6"
							/>
						</div>
						<div class="min-w-0">
							<p class="text-sm font-medium text-gray-500 dark:text-gray-400">
								{{ card.label }}
							</p>
							<div
								v-if="card.loading"
								class="h-8 w-16 mt-1 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"
							/>
							<h3
								v-else
								class="text-2xl font-bold text-gray-900 dark:text-white mt-1"
							>
								{{ card.count }}
							</h3>
						</div>
					</div>
					<p
						v-if="card.detail && !card.loading"
						class="mt-3 text-xs text-gray-500 dark:text-gray-400"
					>
						{{ card.detail }}
					</p>
				</UCard>
			</NuxtLink>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
				<template #header>
					<h2 class="font-semibold text-gray-900 dark:text-white">
						最近註冊的使用者
					</h2>
				</template>

				<div class="space-y-4">
					<div
						v-for="user in recentUsers"
						:key="user.id"
						class="flex items-center gap-3"
					>
						<UAvatar
							:src="getAvatarUrl({ discord_id: user.discord_id, avatar: user.member?.avatar ?? null })"
							:alt="displayName(user)"
							size="md"
						/>
						<div class="min-w-0 flex-1">
							<div class="font-medium text-gray-900 dark:text-white truncate">
								{{ displayName(user) }}
							</div>
							<div class="text-xs text-gray-500 dark:text-gray-400">
								{{ formatDate(user.created_at) }}
							</div>
						</div>
						<UBadge
							:color="USER_STATUS[user.status].color"
							variant="subtle"
						>
							{{ USER_STATUS[user.status].label }}
						</UBadge>
					</div>
					<p
						v-if="!recentUsers.length"
						class="text-sm text-gray-400"
					>
						{{ isUsersLoading ? '載入中...' : '目前沒有任何使用者' }}
					</p>
				</div>
			</UCard>

			<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
				<template #header>
					<h2 class="font-semibold text-gray-900 dark:text-white">
						需要注意的帳號
					</h2>
				</template>

				<div class="space-y-4 max-h-96 overflow-y-auto">
					<div
						v-for="user in attentionUsers"
						:key="user.id"
						class="flex items-center gap-3"
					>
						<UAvatar
							:src="getAvatarUrl({ discord_id: user.discord_id, avatar: user.member?.avatar ?? null })"
							:alt="displayName(user)"
							size="md"
						/>
						<div class="min-w-0 flex-1">
							<div class="font-medium text-gray-900 dark:text-white truncate">
								{{ displayName(user) }}
							</div>
							<div class="text-xs text-gray-500 dark:text-gray-400 truncate">
								{{ user.status_reason || '未提供原因' }}・{{ user.status_until ? `到 ${formatDate(user.status_until)}` : '永久' }}
							</div>
						</div>
						<UBadge
							:color="USER_STATUS[user.status].color"
							variant="subtle"
						>
							{{ USER_STATUS[user.status].label }}
						</UBadge>
					</div>
					<p
						v-if="!attentionUsers.length"
						class="text-sm text-gray-400"
					>
						{{ isUsersLoading ? '載入中...' : '沒有被封禁或尚未啟用的帳號' }}
					</p>
				</div>
			</UCard>
		</div>
	</div>
</template>
