<script setup lang="ts">
definePageMeta({
	layout: 'tickets',
})

interface GuildChannel {
	id: string
	name: string
	type: 'text' | 'category'
	parent_id: string | null
	position: number
}

interface GuildRole {
	id: string
	name: string
	color: number
	position: number
	managed: boolean
}

interface TicketSettings {
	panel_channel_id: string | null
	panel_message_id: string | null
	log_channel_id: string | null
	default_discord_category_id: string | null
	channel_name_template: string
	max_open_tickets_per_user: number
	inactivity_remind_after_hours: number | null
	inactivity_close_after_hours: number | null
	max_attachment_size: number
	// null 表示使用 bot 內建的預設類型
	allowed_file_types: string[] | null
}

interface PermissionRoles {
	admin_role_ids: string[]
	category_roles: { category_id: number, role_ids: string[] }[]
}

const MB = 1024 * 1024

const { t } = useI18n()
const toast = useToast()
const { request } = useTicketApi()
const { me, fetchMe, listCategories } = useTickets()

const channels = ref<GuildChannel[]>([])
const roles = ref<GuildRole[]>([])
const categories = ref<TicketCategory[]>([])
const settings = ref<TicketSettings | null>(null)
const isLoading = ref(true)

const showError = (title: string, error: unknown) => {
	toast.add({
		title,
		description: ticketErrorMessage(error) || t('tickets.common.try_again'),
		color: 'error',
		icon: 'i-heroicons-x-circle',
	})
}

const showSaved = () => {
	toast.add({ title: t('tickets.settings.saved'), color: 'success', icon: 'i-heroicons-check-circle' })
}

// 下拉選單的選項
const channelName = (id: string | null) => channels.value.find(channel => channel.id === id)?.name
const textChannelItems = computed(() => channels.value
	.filter(channel => channel.type === 'text')
	.sort((a, b) => a.position - b.position)
	.map(channel => ({
		label: `#${channel.name}`,
		value: channel.id,
		description: channelName(channel.parent_id),
	})))
const categoryChannelItems = computed(() => channels.value
	.filter(channel => channel.type === 'category')
	.sort((a, b) => a.position - b.position)
	.map(channel => ({ label: channel.name, value: channel.id })))
// 整合服務管理的身份組 (bot 等) 不能指派給成員, 不列出
const roleItems = computed(() => roles.value
	.filter(role => !role.managed)
	.sort((a, b) => b.position - a.position)
	.map(role => ({ label: role.name, value: role.id })))

// 一般設定
const settingsForm = reactive({
	log_channel_id: null as string | null,
	default_discord_category_id: null as string | null,
	channel_name_template: '',
	max_open_tickets_per_user: 3,
	remind_enabled: false,
	inactivity_remind_after_hours: 96,
	close_enabled: false,
	inactivity_close_after_hours: 24,
	max_attachment_size_mb: 1024,
	use_default_file_types: true,
	allowed_file_types: [] as string[],
})

const fillSettingsForm = (value: TicketSettings) => {
	settings.value = value
	Object.assign(settingsForm, {
		log_channel_id: value.log_channel_id,
		default_discord_category_id: value.default_discord_category_id,
		channel_name_template: value.channel_name_template,
		max_open_tickets_per_user: value.max_open_tickets_per_user,
		remind_enabled: value.inactivity_remind_after_hours !== null,
		inactivity_remind_after_hours: value.inactivity_remind_after_hours ?? 96,
		close_enabled: value.inactivity_close_after_hours !== null,
		inactivity_close_after_hours: value.inactivity_close_after_hours ?? 24,
		max_attachment_size_mb: Math.round(value.max_attachment_size / MB),
		use_default_file_types: value.allowed_file_types === null,
		allowed_file_types: value.allowed_file_types ?? [],
	})
}

const isSavingSettings = ref(false)
const saveSettings = async () => {
	isSavingSettings.value = true
	try {
		fillSettingsForm(await request<TicketSettings>('/settings', {
			method: 'PATCH',
			body: {
				// 清除選單時是 undefined, 送出 null 表示不設定
				log_channel_id: settingsForm.log_channel_id ?? null,
				default_discord_category_id: settingsForm.default_discord_category_id ?? null,
				channel_name_template: settingsForm.channel_name_template.trim(),
				max_open_tickets_per_user: settingsForm.max_open_tickets_per_user,
				inactivity_remind_after_hours: settingsForm.remind_enabled ? settingsForm.inactivity_remind_after_hours : null,
				inactivity_close_after_hours: settingsForm.close_enabled ? settingsForm.inactivity_close_after_hours : null,
				max_attachment_size: settingsForm.max_attachment_size_mb * MB,
				allowed_file_types: settingsForm.use_default_file_types ? null : settingsForm.allowed_file_types,
			},
		}))
		showSaved()
	}
	catch (error: unknown) {
		showError(t('tickets.settings.save_failed'), error)
	}
	finally {
		isSavingSettings.value = false
	}
}

// 身份組的用途
const adminRoleIds = ref<string[]>([])
const categoryRoleIds = ref<Record<number, string[]>>({})

const loadPermissionRoles = async () => {
	const value = await request<PermissionRoles>('/permission-roles')
	adminRoleIds.value = value.admin_role_ids
	categoryRoleIds.value = Object.fromEntries(value.category_roles.map(item => [item.category_id, item.role_ids]))
}

const isSavingRoles = ref(false)
const saveRoles = async () => {
	isSavingRoles.value = true
	try {
		// 整份取代
		await request('/permission-roles', {
			method: 'PUT',
			body: {
				admin_role_ids: adminRoleIds.value,
				category_roles: categories.value.map(category => ({
					category_id: category.id,
					role_ids: categoryRoleIds.value[category.id] ?? [],
				})),
			},
		})
		await loadPermissionRoles()
		showSaved()
	}
	catch (error: unknown) {
		showError(t('tickets.settings.save_failed'), error)
	}
	finally {
		isSavingRoles.value = false
	}
}

// 分類
const categoryForm = reactive({
	id: null as number | null,
	name: '',
	emoji: '',
	description: '',
	position: 0,
	enabled: true,
	discord_category_id: null as string | null,
})
const isCategoryModalOpen = ref(false)
const isSavingCategory = ref(false)

const openCategoryModal = (category?: TicketCategory) => {
	Object.assign(categoryForm, category
		? {
				id: category.id,
				name: category.name,
				emoji: category.emoji ?? '',
				description: category.description ?? '',
				position: category.position,
				enabled: category.enabled,
				discord_category_id: category.discord_category_id,
			}
		: {
				id: null,
				name: '',
				emoji: '',
				description: '',
				position: categories.value.length,
				enabled: true,
				discord_category_id: null,
			})
	isCategoryModalOpen.value = true
}

const loadCategories = async () => {
	categories.value = await listCategories()
}

const saveCategory = async () => {
	isSavingCategory.value = true
	const body = {
		name: categoryForm.name.trim(),
		emoji: categoryForm.emoji.trim() || null,
		description: categoryForm.description.trim() || null,
		position: categoryForm.position,
		enabled: categoryForm.enabled,
		discord_category_id: categoryForm.discord_category_id ?? null,
	}
	try {
		if (categoryForm.id === null) await request('/categories', { method: 'POST', body })
		else await request(`/categories/${categoryForm.id}`, { method: 'PATCH', body })
		isCategoryModalOpen.value = false
		// 新的分類也要能設定負責的身份組
		await Promise.all([loadCategories(), loadPermissionRoles()])
		showSaved()
	}
	catch (error: unknown) {
		showError(t('tickets.settings.save_failed'), error)
	}
	finally {
		isSavingCategory.value = false
	}
}

const deletingCategory = ref<TicketCategory | null>(null)
const isDeletingCategory = ref(false)

const confirmDeleteCategory = async () => {
	if (!deletingCategory.value) return
	isDeletingCategory.value = true
	try {
		await request(`/categories/${deletingCategory.value.id}`, { method: 'DELETE' })
		deletingCategory.value = null
		await Promise.all([loadCategories(), loadPermissionRoles()])
		showSaved()
	}
	catch (error: unknown) {
		// 已經有客服單的分類不能刪除 (409), 只能停用
		showError(t('tickets.settings.delete_failed'), error)
	}
	finally {
		isDeletingCategory.value = false
	}
}

// 面板
const panelChannelId = ref<string>()
const isPublishing = ref(false)

const publishPanel = async () => {
	if (!panelChannelId.value) return
	isPublishing.value = true
	try {
		await request('/panel/publish', { method: 'POST', body: { channel_id: panelChannelId.value } })
		fillSettingsForm(await request<TicketSettings>('/settings'))
		toast.add({ title: t('tickets.settings.panel_published'), color: 'success', icon: 'i-heroicons-check-circle' })
	}
	catch (error: unknown) {
		showError(t('tickets.settings.panel_publish_failed'), error)
	}
	finally {
		isPublishing.value = false
	}
}

whenLoggedIn(async () => {
	try {
		await fetchMe()
		if (!me.value?.is_admin) return
		const [channelList, roleList, value] = await Promise.all([
			request<GuildChannel[]>('/guild/channels'),
			request<GuildRole[]>('/guild/roles'),
			request<TicketSettings>('/settings'),
			loadCategories(),
			loadPermissionRoles(),
		])
		channels.value = channelList
		roles.value = roleList
		fillSettingsForm(value)
		panelChannelId.value = value.panel_channel_id ?? undefined
	}
	catch (error: unknown) {
		showError(t('tickets.settings.load_failed'), error)
	}
	finally {
		isLoading.value = false
	}
})
</script>

<template>
	<div class="max-w-4xl mx-auto space-y-6">
		<NuxtLink
			:to="$localePath('/tickets')"
			class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
		>
			<UIcon
				name="i-heroicons-arrow-left"
				class="w-4 h-4"
			/>
			{{ $t('tickets.common.back_to_list') }}
		</NuxtLink>

		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				{{ $t('tickets.settings.title') }}
			</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				{{ $t('tickets.settings.subtitle') }}
			</p>
		</div>

		<!-- 載入中 -->
		<div
			v-if="isLoading"
			class="space-y-4"
		>
			<div
				v-for="i in 3"
				:key="i"
				class="h-40 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse"
			/>
		</div>

		<!-- 不是管理員 -->
		<UCard
			v-else-if="!me?.is_admin"
			class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50"
		>
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<UIcon
					name="i-heroicons-lock-closed"
					class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
				/>
				<span class="text-base font-medium text-gray-900 dark:text-white">
					{{ $t('tickets.settings.forbidden') }}
				</span>
			</div>
		</UCard>

		<template v-else>
			<!-- 分類 -->
			<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
				<template #header>
					<div class="flex items-center justify-between gap-3">
						<div>
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">
								{{ $t('tickets.settings.categories') }}
							</h2>
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
								{{ $t('tickets.settings.categories_desc') }}
							</p>
						</div>
						<UButton
							icon="i-heroicons-plus"
							:label="$t('tickets.settings.add_category')"
							@click="openCategoryModal()"
						/>
					</div>
				</template>

				<p
					v-if="!categories.length"
					class="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
				>
					{{ $t('tickets.settings.no_categories') }}
				</p>

				<ul
					v-else
					class="divide-y divide-gray-200 dark:divide-gray-800"
				>
					<li
						v-for="category in categories"
						:key="category.id"
						class="flex items-center gap-3 py-3"
					>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="font-medium text-gray-900 dark:text-white">
									<TicketEmoji
										v-if="category.emoji"
										:emoji="category.emoji"
										class="mr-1"
									/>
									{{ category.name }}
								</span>
								<UBadge
									v-if="!category.enabled"
									:label="$t('tickets.settings.disabled')"
									color="neutral"
									variant="subtle"
									size="sm"
								/>
							</div>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{{ category.description || '—' }}
								·
								{{ $t('tickets.settings.discord_category') }}:
								{{ category.discord_category_id ? channelName(category.discord_category_id) ?? category.discord_category_id : $t('tickets.settings.use_default') }}
							</p>
						</div>
						<UButton
							icon="i-heroicons-pencil-square"
							color="neutral"
							variant="ghost"
							:title="$t('tickets.settings.edit')"
							@click="openCategoryModal(category)"
						/>
						<UButton
							icon="i-heroicons-trash"
							color="error"
							variant="ghost"
							:title="$t('tickets.settings.delete')"
							@click="deletingCategory = category"
						/>
					</li>
				</ul>
			</UCard>

			<!-- 身份組的用途 -->
			<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
				<template #header>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">
						{{ $t('tickets.settings.roles') }}
					</h2>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						{{ $t('tickets.settings.roles_desc') }}
					</p>
				</template>

				<form
					class="space-y-4"
					@submit.prevent="saveRoles"
				>
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.admin_roles') }}</label>
						<USelectMenu
							v-model="adminRoleIds"
							:items="roleItems"
							value-key="value"
							multiple
							:placeholder="$t('tickets.settings.select_roles')"
							class="w-full"
						/>
					</div>

					<div
						v-for="category in categories"
						:key="category.id"
						class="space-y-1"
					>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
							{{ $t('tickets.settings.category_roles', { name: category.name }) }}
						</label>
						<USelectMenu
							v-model="categoryRoleIds[category.id]"
							:items="roleItems"
							value-key="value"
							multiple
							:placeholder="$t('tickets.settings.select_roles')"
							class="w-full"
						/>
					</div>

					<div class="flex justify-end">
						<UButton
							type="submit"
							:label="$t('tickets.settings.save')"
							:loading="isSavingRoles"
						/>
					</div>
				</form>
			</UCard>

			<!-- 面板 -->
			<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
				<template #header>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">
						{{ $t('tickets.settings.panel') }}
					</h2>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						{{ $t('tickets.settings.panel_desc') }}
					</p>
				</template>

				<form
					class="flex flex-col gap-3 sm:flex-row sm:items-end"
					@submit.prevent="publishPanel"
				>
					<div class="flex-1 space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.panel_channel') }}</label>
						<USelectMenu
							v-model="panelChannelId"
							:items="textChannelItems"
							value-key="value"
							:placeholder="$t('tickets.settings.select_channel')"
							class="w-full"
						/>
					</div>
					<UButton
						type="submit"
						icon="i-heroicons-megaphone"
						:label="settings?.panel_message_id ? $t('tickets.settings.republish_panel') : $t('tickets.settings.publish_panel')"
						:loading="isPublishing"
						:disabled="!panelChannelId"
					/>
				</form>
			</UCard>

			<!-- 一般設定 -->
			<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
				<template #header>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">
						{{ $t('tickets.settings.general') }}
					</h2>
				</template>

				<form
					class="space-y-5"
					@submit.prevent="saveSettings"
				>
					<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.log_channel') }}</label>
							<USelectMenu
								v-model="settingsForm.log_channel_id"
								:items="textChannelItems"
								value-key="value"
								clear
								:placeholder="$t('tickets.settings.not_set')"
								class="w-full"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{{ $t('tickets.settings.log_channel_desc') }}
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.default_category') }}</label>
							<USelectMenu
								v-model="settingsForm.default_discord_category_id"
								:items="categoryChannelItems"
								value-key="value"
								clear
								:placeholder="$t('tickets.settings.not_set')"
								class="w-full"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{{ $t('tickets.settings.default_category_desc') }}
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.channel_name_template') }}</label>
							<UInput
								v-model="settingsForm.channel_name_template"
								:maxlength="100"
								class="w-full"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{{ $t('tickets.settings.channel_name_template_desc') }}
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.max_open_tickets') }}</label>
							<UInputNumber
								v-model="settingsForm.max_open_tickets_per_user"
								:min="1"
								:max="100"
								class="w-full"
							/>
						</div>

						<div class="space-y-1">
							<div class="flex items-center justify-between">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.remind_after') }}</label>
								<USwitch v-model="settingsForm.remind_enabled" />
							</div>
							<UInputNumber
								v-model="settingsForm.inactivity_remind_after_hours"
								:min="1"
								:max="8760"
								:disabled="!settingsForm.remind_enabled"
								class="w-full"
							/>
						</div>

						<div class="space-y-1">
							<div class="flex items-center justify-between">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.close_after') }}</label>
								<USwitch v-model="settingsForm.close_enabled" />
							</div>
							<UInputNumber
								v-model="settingsForm.inactivity_close_after_hours"
								:min="1"
								:max="8760"
								:disabled="!settingsForm.close_enabled"
								class="w-full"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.max_attachment_size') }}</label>
							<UInputNumber
								v-model="settingsForm.max_attachment_size_mb"
								:min="1"
								:max="1024"
								class="w-full"
							/>
						</div>
					</div>

					<div class="space-y-1">
						<div class="flex items-center justify-between">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.file_types') }}</label>
							<div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
								{{ $t('tickets.settings.use_default_file_types') }}
								<USwitch v-model="settingsForm.use_default_file_types" />
							</div>
						</div>
						<UInputTags
							v-if="!settingsForm.use_default_file_types"
							v-model="settingsForm.allowed_file_types"
							:placeholder="$t('tickets.settings.file_types_placeholder')"
							add-on-paste
							add-on-blur
							class="w-full"
						/>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							{{ $t('tickets.settings.file_types_desc') }}
						</p>
					</div>

					<div class="flex justify-end">
						<UButton
							type="submit"
							:label="$t('tickets.settings.save')"
							:loading="isSavingSettings"
						/>
					</div>
				</form>
			</UCard>
		</template>

		<!-- 新增, 編輯分類 -->
		<div
			v-if="isCategoryModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isCategoryModalOpen = false"
		>
			<UCard class="w-full max-w-lg shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							{{ categoryForm.id === null ? $t('tickets.settings.add_category') : $t('tickets.settings.edit_category') }}
						</h3>
						<UButton
							color="neutral"
							variant="ghost"
							icon="i-heroicons-x-mark-20-solid"
							class="-my-1"
							@click="isCategoryModalOpen = false"
						/>
					</div>
				</template>

				<form
					id="category-form"
					class="space-y-4"
					@submit.prevent="saveCategory"
				>
					<div class="grid grid-cols-[6rem_1fr] gap-3">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.category_emoji') }}</label>
							<UInput
								v-model="categoryForm.emoji"
								:maxlength="64"
								class="w-full"
							/>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.category_name') }} <span class="text-red-500">*</span></label>
							<UInput
								v-model="categoryForm.name"
								:maxlength="100"
								class="w-full"
							/>
						</div>
					</div>
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.category_description') }}</label>
						<UInput
							v-model="categoryForm.description"
							:maxlength="100"
							class="w-full"
						/>
					</div>
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.discord_category') }}</label>
						<USelectMenu
							v-model="categoryForm.discord_category_id"
							:items="categoryChannelItems"
							value-key="value"
							clear
							:placeholder="$t('tickets.settings.use_default')"
							class="w-full"
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.category_position') }}</label>
							<UInputNumber
								v-model="categoryForm.position"
								class="w-full"
							/>
						</div>
						<div class="flex items-end justify-between gap-2 pb-1.5">
							<label class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.settings.category_enabled') }}</label>
							<USwitch v-model="categoryForm.enabled" />
						</div>
					</div>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{{ $t('tickets.settings.category_emoji_desc') }}
					</p>
				</form>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							:label="$t('tickets.common.cancel')"
							:disabled="isSavingCategory"
							@click="isCategoryModalOpen = false"
						/>
						<UButton
							type="submit"
							form="category-form"
							:label="$t('tickets.settings.save')"
							:loading="isSavingCategory"
							:disabled="!categoryForm.name.trim()"
						/>
					</div>
				</template>
			</UCard>
		</div>

		<!-- 確認刪除分類 -->
		<div
			v-if="deletingCategory"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="deletingCategory = null"
		>
			<UCard class="w-full max-w-lg shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50">
				<template #header>
					<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white flex items-center gap-2">
						<UIcon
							name="i-heroicons-exclamation-triangle"
							class="w-5 h-5 text-error-500"
						/>
						{{ $t('tickets.settings.delete_category') }}
					</h3>
				</template>

				<p class="text-sm text-gray-500 dark:text-gray-400">
					{{ $t('tickets.settings.delete_category_confirm', { name: deletingCategory.name }) }}
				</p>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							:label="$t('tickets.common.cancel')"
							:disabled="isDeletingCategory"
							@click="deletingCategory = null"
						/>
						<UButton
							color="error"
							:label="$t('tickets.settings.delete')"
							:loading="isDeletingCategory"
							@click="confirmDeleteCategory"
						/>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
