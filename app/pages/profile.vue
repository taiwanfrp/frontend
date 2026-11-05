<script setup lang="ts">
import Bowser from 'bowser'

interface AuthSession {
	session_id: string | null
	created_at: string | null
	ip: string | null
	user_agent: string | null
	current: boolean
}

const { user, isLoading, getAvatarUrl, clearSession } = useAuth()
const toast = useToast()
const config = useRuntimeConfig()

const { data: sessions, pending: isSessionsLoading, refresh: refreshSessions } = useApiFetch<AuthSession[]>('/api/v1/auth/sessions', {
	server: false,
	lazy: true,
	default: () => [],
})

// 目前的裝置放在最前面
const orderedSessions = computed(() => [...(sessions.value || [])].sort((a, b) => Number(b.current) - Number(a.current)))

// 例如 Linux · Firefox 157
const describeDevice = (userAgent: string | null) => {
	if (!userAgent) return { name: '未知裝置', icon: 'i-heroicons-question-mark-circle' }

	const { browser, os, platform } = Bowser.parse(userAgent)
	const browserName = [browser.name, browser.version?.split('.')[0]].filter(Boolean).join(' ')
	const name = [os.name, browserName].filter(Boolean).join(' · ') || userAgent

	let icon = 'i-heroicons-computer-desktop'
	if (platform.type === 'mobile') icon = 'i-heroicons-device-phone-mobile'
	else if (platform.type === 'tablet') icon = 'i-heroicons-device-tablet'

	return { name, icon }
}

// 舊的 session 沒有記錄登入時間
const formatLoginTime = (createdAt: string | null) =>
	createdAt ? new Date(createdAt).toLocaleString('zh-TW') : '未記錄'

// null 表示登出所有裝置
const sessionToLogout = ref<AuthSession | null>(null)
const isLogoutModalOpen = ref(false)
const isLoggingOut = ref(false)

const openLogoutModal = (session: AuthSession | null) => {
	sessionToLogout.value = session
	isLogoutModalOpen.value = true
}

const confirmLogout = async () => {
	const session = sessionToLogout.value
	isLoggingOut.value = true

	try {
		await $fetch(session ? `/api/v1/auth/sessions/${session.session_id}` : '/api/v1/auth/sessions', {
			method: 'DELETE',
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
		})

		isLogoutModalOpen.value = false

		// 目前的裝置也被登出了
		if (!session || session.current) {
			await clearSession()
			return
		}

		toast.add({ title: '已登出該裝置', color: 'success', icon: 'i-heroicons-check-circle' })
		refreshSessions()
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		toast.add({
			title: '登出失敗',
			description: err.data?.detail || '請稍後再試。',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		})
	}
	finally {
		isLoggingOut.value = false
	}
}

onMounted(() => {
	if (!isLoading.value && !user.value) {
		navigateTo('/')
	}
})

watchEffect(() => {
	if (!isLoading.value && !user.value) {
		navigateTo('/')
	}
})
</script>

<template>
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-24">
		<!-- 標題 -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
				個人資料
			</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				檢視您的個人資料
			</p>
		</div>

		<!-- 資料卡片 -->
		<UCard
			v-if="user"
			class="ring-1 ring-gray-200 dark:ring-gray-800 shadow-sm"
		>
			<div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
				<!-- 頭像 -->
				<div class="shrink-0">
					<img
						:src="getAvatarUrl(user)"
						class="w-24 h-24 rounded-full object-cover ring-4 ring-gray-50 dark:ring-gray-900 shadow-sm"
						alt="User Avatar"
					>
				</div>

				<!-- 資訊 -->
				<div class="flex-1 text-center sm:text-left mt-2 sm:mt-0">
					<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						{{ user.username }}
					</h2>

					<div class="inline-flex flex-col space-y-4 text-left w-full sm:w-auto">
						<!-- Email -->
						<div class="flex items-center gap-3 sm:gap-4">
							<span class="text-sm font-medium text-gray-500 dark:text-gray-400 w-20 sm:w-24 shrink-0">Email</span>
							<span class="text-base text-gray-900 dark:text-gray-100 truncate">{{ user.email || '未提供' }}</span>
						</div>

						<!-- Discord ID -->
						<div class="flex items-center gap-3 sm:gap-4">
							<span class="text-sm font-medium text-gray-500 dark:text-gray-400 w-20 sm:w-24 shrink-0">Discord ID</span>
							<div class="truncate">
								<span class="text-gray-900 dark:text-gray-100 font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{{ user.discord_id }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</UCard>

		<!-- 登入的裝置 -->
		<UCard
			v-if="user"
			class="mt-8 ring-1 ring-gray-200 dark:ring-gray-800 shadow-sm"
		>
			<template #header>
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
							登入的裝置
						</h2>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
							如果有不認得的裝置, 可以將它登出
						</p>
					</div>
					<UButton
						color="error"
						variant="soft"
						icon="i-heroicons-arrow-right-on-rectangle"
						label="登出所有裝置"
						:disabled="isSessionsLoading"
						@click="openLogoutModal(null)"
					/>
				</div>
			</template>

			<div
				v-if="isSessionsLoading && orderedSessions.length === 0"
				class="py-8 flex justify-center"
			>
				<UIcon
					name="i-heroicons-arrow-path"
					class="w-6 h-6 animate-spin text-gray-400"
				/>
			</div>

			<ul
				v-else
				class="divide-y divide-gray-100 dark:divide-gray-800"
			>
				<li
					v-for="session in orderedSessions"
					:key="session.session_id ?? 'current'"
					class="flex items-center gap-4 py-3"
				>
					<UIcon
						:name="describeDevice(session.user_agent).icon"
						class="w-8 h-8 shrink-0 text-gray-500 dark:text-gray-400"
					/>

					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<span
								class="font-medium text-gray-900 dark:text-white truncate"
								:title="session.user_agent ?? undefined"
							>
								{{ describeDevice(session.user_agent).name }}
							</span>
							<UBadge
								v-if="session.current"
								color="success"
								variant="subtle"
								size="sm"
							>
								目前的裝置
							</UBadge>
						</div>
						<div class="text-sm text-gray-500 dark:text-gray-400 truncate">
							<span v-if="session.ip">{{ session.ip }} · </span>登入時間 {{ formatLoginTime(session.created_at) }}
						</div>
					</div>

					<!-- 舊的 session 沒有 session_id, 只能用登出所有裝置 -->
					<UButton
						v-if="session.session_id"
						color="error"
						variant="ghost"
						icon="i-heroicons-arrow-right-on-rectangle"
						:title="session.current ? '登出' : '登出這個裝置'"
						@click="openLogoutModal(session)"
					/>
				</li>
			</ul>
		</UCard>

		<!-- 登出確認對話框 -->
		<div
			v-if="isLogoutModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isLogoutModalOpen = false"
		>
			<UCard class="w-full max-w-lg shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800">
				<template #header>
					<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
						{{ sessionToLogout ? '登出裝置' : '登出所有裝置' }}
					</h3>
				</template>

				<p class="py-2 text-sm text-gray-500 dark:text-gray-400">
					<template v-if="!sessionToLogout">
						所有裝置 (包括目前的裝置) 都會被登出, 需要重新登入。
					</template>
					<template v-else-if="sessionToLogout.current">
						確定要登出目前的裝置嗎？
					</template>
					<template v-else>
						確定要登出 <span class="font-bold text-gray-900 dark:text-white">{{ describeDevice(sessionToLogout.user_agent).name }}</span> 嗎？
					</template>
				</p>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							label="取消"
							:disabled="isLoggingOut"
							@click="isLogoutModalOpen = false"
						/>
						<UButton
							color="error"
							label="確認登出"
							:loading="isLoggingOut"
							@click="confirmLogout"
						/>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
