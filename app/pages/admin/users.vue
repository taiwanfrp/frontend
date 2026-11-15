<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'admin',
})

interface DiscordMember {
	username: string
	global_name: string | null
	nick: string | null
	avatar: string | null
	guild_avatar: string | null
}

interface AdminUser {
	id: string
	discord_id: string
	status: 'active' | 'suspended' | 'banned' | 'deleted'
	status_reason: string | null
	status_until: string | null
	custom_max_tunnels: number | null
	custom_max_bandwidth: number | null
	roles: { id: number, name: string }[]
	limits?: { max_tunnels: number, max_bandwidth: number }
	member?: DiscordMember | null
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
	{ id: 'user', header: '使用者' },
	{ accessorKey: 'status', header: '狀態' },
	{ id: 'roles', header: '身份組' },
	{ id: 'limits', header: '資源限制' },
	{ accessorKey: 'created_at', header: '建立時間' },
	{ id: 'actions', header: '' },
]

const { data: users, pending: isUsersLoading, refresh: refreshUsers } = useApiFetch<AdminUser[]>('/api/v1/users', {
	server: false,
	lazy: true,
	default: () => [],
})

const { data: roles } = useApiFetch<{ id: number, name: string }[]>('/api/v1/roles', {
	server: false,
	lazy: true,
	default: () => [],
})

const config = useRuntimeConfig()
const toast = useToast()
const { user: currentUser, getAvatarUrl } = useAuth()

const displayName = (user: AdminUser) =>
	user.member?.nick || user.member?.global_name || user.member?.username || user.discord_id

const searchQuery = ref('')
const statusFilter = ref('all')

const filteredUsers = computed(() => {
	const query = searchQuery.value.trim().toLowerCase()

	return (users.value || []).filter((user) => {
		if (statusFilter.value !== 'all' && user.status !== statusFilter.value) return false
		if (!query) return true
		const names = [user.member?.username, user.member?.global_name, user.member?.nick]
		return user.discord_id.includes(query)
			|| names.some(name => name?.toLowerCase().includes(query))
			|| (user.roles || []).some(role => role.name.toLowerCase().includes(query))
	})
})

const toLocalInput = (value: string | null) => {
	if (!value) return ''
	const date = new Date(value)
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const isFormModalOpen = ref(false)
const isSubmitting = ref(false)
const formErrorMessage = ref('')
const editingUser = ref<AdminUser | null>(null)
const userForm = ref({
	status: 'active' as AdminUser['status'],
	status_reason: '',
	status_until: '',
	role_ids: [] as number[],
	custom_max_tunnels: null as number | null,
	custom_max_bandwidth: null as number | null,
})

const isSelf = computed(() => editingUser.value?.discord_id === currentUser.value?.discord_id)
const isRestricted = computed(() => userForm.value.status === 'suspended' || userForm.value.status === 'banned')

const editStatusOptions = computed(() =>
	statusOptions.filter(option =>
		option.value !== 'all' && (option.value !== 'deleted' || editingUser.value?.status === 'deleted'),
	),
)

const openEditModal = (user: AdminUser) => {
	editingUser.value = user
	userForm.value = {
		status: user.status,
		status_reason: user.status_reason || '',
		status_until: toLocalInput(user.status_until),
		role_ids: (user.roles || []).map(role => role.id),
		custom_max_tunnels: user.custom_max_tunnels,
		custom_max_bandwidth: user.custom_max_bandwidth,
	}
	formErrorMessage.value = ''
	isFormModalOpen.value = true
}

const toggleRole = (roleId: number, checked: boolean) => {
	const selected = userForm.value.role_ids.filter(id => id !== roleId)
	userForm.value.role_ids = checked ? [...selected, roleId] : selected
}

const toggleCustom = (field: 'custom_max_tunnels' | 'custom_max_bandwidth', checked: boolean) => {
	userForm.value[field] = checked ? (editingUser.value?.limits?.[field === 'custom_max_tunnels' ? 'max_tunnels' : 'max_bandwidth'] ?? 0) : null
}

const isValidLimit = (value: number | null) => value === null || (Number.isInteger(value) && value >= 0)

const submitForm = async () => {
	const user = editingUser.value
	if (!user) return

	const form = userForm.value
	if (!isValidLimit(form.custom_max_tunnels) || !isValidLimit(form.custom_max_bandwidth)) {
		formErrorMessage.value = '自訂的隧道數量與限速必須是 0 以上的整數'
		return
	}

	const body: Record<string, unknown> = {}

	const oldRoleIds = (user.roles || []).map(role => role.id).sort()
	if ([...form.role_ids].sort().join() !== oldRoleIds.join()) body.role_ids = form.role_ids

	const reason = isRestricted.value ? form.status_reason.trim() || null : null
	const until = isRestricted.value && form.status_until ? new Date(form.status_until).toISOString() : null
	const isUntilChanged = form.status_until !== toLocalInput(user.status_until)
	if (until && isUntilChanged && new Date(until) <= new Date()) {
		formErrorMessage.value = '到期時間必須是未來的時間'
		return
	}

	if (form.status !== user.status) {
		body.status = form.status
		if (isRestricted.value) {
			body.status_reason = reason
			body.status_until = until
		}
	}
	else if (isRestricted.value) {
		if (reason !== (user.status_reason || null)) body.status_reason = reason
		if (isUntilChanged) body.status_until = until
	}

	if (form.custom_max_tunnels !== user.custom_max_tunnels) body.custom_max_tunnels = form.custom_max_tunnels
	if (form.custom_max_bandwidth !== user.custom_max_bandwidth) body.custom_max_bandwidth = form.custom_max_bandwidth

	if (!Object.keys(body).length) {
		isFormModalOpen.value = false
		return
	}

	formErrorMessage.value = ''
	isSubmitting.value = true
	try {
		await $fetch(`/api/v1/users/${user.discord_id}`, {
			method: 'PATCH',
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
			body,
		})

		toast.add({
			title: '編輯成功',
			description: `使用者 ${displayName(user)} 已成功更新。`,
			color: 'success',
			icon: 'i-heroicons-check-circle',
		})
		isFormModalOpen.value = false
		refreshUsers()
	}
	catch (error: unknown) {
		const detail = (error as { data?: { detail?: unknown } }).data?.detail
		formErrorMessage.value = typeof detail === 'string' ? detail : '無法更新使用者，請檢查輸入資料或稍後再試。'
	}
	finally {
		isSubmitting.value = false
	}
}

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('zh-TW') : '')

const formatLimit = (value: number | undefined, unit = '') => {
	if (value === undefined) return '-'
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
					placeholder="搜尋名稱、Discord ID 或身份組..."
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
				:data="filteredUsers"
				:columns="columns"
				:loading="isUsersLoading"
			>
				<template #user-cell="{ row }">
					<div class="flex items-center gap-3">
						<UAvatar
							:src="getAvatarUrl({ discord_id: row.original.discord_id, avatar: row.original.member?.avatar ?? null })"
							:alt="displayName(row.original)"
							size="md"
						/>
						<div class="min-w-0">
							<div class="font-medium text-gray-900 dark:text-white truncate">
								{{ displayName(row.original) }}
							</div>
							<div class="text-xs text-gray-500 dark:text-gray-400">
								<span v-if="row.original.member">@{{ row.original.member.username }}・</span>
								<span class="font-mono">{{ row.original.discord_id }}</span>
							</div>
							<UBadge
								v-if="!row.original.member"
								color="neutral"
								variant="subtle"
								size="sm"
								class="mt-1"
							>
								不在伺服器
							</UBadge>
						</div>
					</div>
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

				<template #limits-cell="{ row }">
					<div class="text-sm text-gray-600 dark:text-gray-300">
						<div>
							FRP 隧道：{{ formatLimit(row.original.limits?.max_tunnels, ' 條') }}
							<span
								v-if="row.original.custom_max_tunnels !== null"
								class="text-xs text-primary-500"
							>（自訂）</span>
						</div>
						<div>
							限速：{{ formatLimit(row.original.limits?.max_bandwidth, ' MB/s') }}
							<span
								v-if="row.original.custom_max_bandwidth !== null"
								class="text-xs text-primary-500"
							>（自訂）</span>
						</div>
					</div>
				</template>

				<template #created_at-cell="{ row }">
					<span class="text-sm text-gray-600 dark:text-gray-300">
						{{ formatDate(row.original.created_at) }}
					</span>
				</template>

				<template #actions-cell="{ row }">
					<div class="flex justify-end">
						<UButton
							icon="i-heroicons-pencil-square"
							color="neutral"
							variant="ghost"
							title="編輯"
							@click="openEditModal(row.original)"
						/>
					</div>
				</template>

				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<UIcon
							name="i-heroicons-users"
							class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						/>
						<span class="text-base font-medium text-gray-900 dark:text-white">
							{{ searchQuery || statusFilter !== 'all' ? '找不到符合的使用者' : '目前沒有任何使用者' }}
						</span>
					</div>
				</template>
			</UTable>
		</UCard>

		<div
			v-if="isFormModalOpen && editingUser"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isFormModalOpen = false"
		>
			<UCard class="w-full max-w-2xl shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800 flex flex-col max-h-[90vh]">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							編輯使用者：{{ displayName(editingUser) }}
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

					<UAlert
						v-if="isSelf"
						color="neutral"
						variant="subtle"
						icon="i-heroicons-information-circle"
						title="不能修改自己的帳號狀態與身份組"
					/>

					<div class="space-y-3">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">帳號狀態</label>
							<USelect
								v-model="userForm.status"
								:items="editStatusOptions"
								:disabled="isSelf"
								class="w-full sm:w-48"
							/>
						</div>
						<div
							v-if="isRestricted"
							class="grid grid-cols-1 sm:grid-cols-2 gap-4"
						>
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">原因 (會顯示給使用者)</label>
								<UInput
									v-model="userForm.status_reason"
									:maxlength="500"
									:disabled="isSelf"
									class="w-full"
								/>
							</div>
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">到期時間 (留空表示永久)</label>
								<UInput
									v-model="userForm.status_until"
									type="datetime-local"
									:disabled="isSelf"
									class="w-full"
								/>
							</div>
						</div>
					</div>

					<div class="border-t border-gray-100 dark:border-gray-800" />

					<div class="space-y-2">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">身份組</label>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
							<UCheckbox
								v-for="role in roles"
								:key="role.id"
								:model-value="userForm.role_ids.includes(role.id)"
								:label="role.name"
								:disabled="isSelf"
								@update:model-value="toggleRole(role.id, $event === true)"
							/>
						</div>
					</div>

					<div class="border-t border-gray-100 dark:border-gray-800" />

					<div class="space-y-3">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">資源限制</label>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div class="space-y-2">
								<UCheckbox
									:model-value="userForm.custom_max_tunnels !== null"
									label="自訂 FRP 隧道數量"
									@update:model-value="toggleCustom('custom_max_tunnels', $event === true)"
								/>
								<UInput
									v-if="userForm.custom_max_tunnels !== null"
									v-model.number="userForm.custom_max_tunnels"
									type="number"
									:min="0"
									class="w-full"
								/>
							</div>
							<div class="space-y-2">
								<UCheckbox
									:model-value="userForm.custom_max_bandwidth !== null"
									label="自訂限速 (MB/s)"
									@update:model-value="toggleCustom('custom_max_bandwidth', $event === true)"
								/>
								<UInput
									v-if="userForm.custom_max_bandwidth !== null"
									v-model.number="userForm.custom_max_bandwidth"
									type="number"
									:min="0"
									class="w-full"
								/>
							</div>
						</div>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							沒有勾選時依身份組計算；自訂值填 0 表示無限制
						</p>
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
							label="確認修改"
							:loading="isSubmitting"
							@click="submitForm"
						/>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
