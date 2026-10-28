<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const toast = useToast()
const { user, isLoading, isAccountActive, fetchUser } = useAuth()
const localePath = useLocalePath()

onMounted(() => {
	if (!isLoading.value && !user.value) {
		navigateTo(localePath('/'))
	}
})

watchEffect(() => {
	if (!isLoading.value && !user.value) {
		navigateTo(localePath('/'))
	}
})

// 在 Discord 啟用帳號後, 重新取得帳號狀態
const isCheckingActivation = ref(false)
const checkActivation = async () => {
	isCheckingActivation.value = true
	await fetchUser()
	isCheckingActivation.value = false
	if (user.value && !isAccountActive.value) {
		toast.add({
			title: '帳號尚未啟用',
			description: '請在 Discord 伺服器按下「啟用帳號」後再試一次。',
			color: 'warning',
			icon: 'i-heroicons-exclamation-triangle',
		})
	}
}

const menuGroups = [
	{
		title: '核心服務',
		items: [
			{ label: '概覽', icon: 'i-heroicons-squares-2x2', to: '/dashboard' },
			{ label: '節點', icon: 'i-heroicons-server', to: '/dashboard/nodes' },
			{ label: '隧道', icon: 'i-heroicons-arrows-right-left', to: '/dashboard/tunnels' },
			{ label: '連接器', icon: 'i-heroicons-computer-desktop', to: '/dashboard/connectors' },
			{ label: '子網域', icon: 'i-heroicons-globe-alt', to: '/dashboard/subdomains' },
		],
	},
	{
		title: '進階配置',
		items: [
			{ label: '憑證', icon: 'i-heroicons-shield-check', to: '/dashboard/certificates', disabled: true, badge: '即將推出' },
			{ label: 'API', icon: 'i-heroicons-command-line', to: '/dashboard/api' },
		],
	},
	{
		title: '監控與日誌',
		items: [
			{ label: '日誌', icon: 'i-heroicons-clipboard-document-list', to: '/dashboard/logs', disabled: true, badge: '即將推出' },
			{ label: '統計', icon: 'i-heroicons-chart-bar', to: '/dashboard/statistics', disabled: true, badge: '即將推出' },
		],
	},
	{
		title: '帳號與系統',
		items: [
			{ label: '使用者', icon: 'i-heroicons-users', to: '/dashboard/users', disabled: true, badge: '即將推出' },
			// { label: '通知', icon: 'i-heroicons-bell', to: '/dashboard/notifications', disabled: true, badge: '即將推出' },
			// { label: '整合', icon: 'i-heroicons-puzzle-piece', to: '/dashboard/integrations', disabled: true, badge: '即將推出' },
			{ label: '設定', icon: 'i-heroicons-cog-6-tooth', to: '/dashboard/settings' },
		],
	},
	{
		title: '幫助',
		items: [
			// { label: '支援', icon: 'i-heroicons-lifebuoy', to: '/dashboard/support', disabled: true, badge: '即將推出' },
			{ label: '關於', icon: 'i-heroicons-information-circle', to: '/dashboard/about' },
		],
	},
]

const isActive = (itemPath: string) => {
	if (itemPath === '/dashboard') {
		return route.path === itemPath
	}
	return route.path.startsWith(itemPath)
}
</script>

<template>
	<div class="relative min-h-[calc(100vh-4rem)] flex">
		<div class="fixed top-16 left-0 right-0 border border-black/4 dark:border-white/4 z-40 pointer-events-none" />

		<!-- Sidebar -->
		<aside class="hidden md:flex flex-col w-64 fixed left-0 top-16 h-[calc(100vh-4rem)] bg-transparent border-r border-black/4 dark:border-white/4 z-40">
			<nav class="flex-1 overflow-y-auto p-4 space-y-6">
				<div
					v-for="group in menuGroups"
					:key="group.title"
				>
					<h3 class="px-3 mb-2 text-[12px] font-semibold text-gray-500 dark:text-gray-400 tracking-wider">
						{{ group.title }}
					</h3>

					<div class="space-y-1">
						<NuxtLink
							v-for="item in group.items"
							:key="item.to"
							:to="item.disabled ? undefined : item.to"
							class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
							:class="[
								item.disabled ? 'opacity-50 pointer-events-none' : '',
								isActive(item.to)
									? 'bg-primary-500/8 text-primary-600 dark:text-primary-400'
									: 'text-gray-700 dark:text-gray-300 hover:bg-gray-900/5 dark:hover:bg-white/5',
							]"
						>
							<UIcon
								:name="item.icon"
								class="w-5 h-5 shrink-0"
							/>
							{{ item.label }}

							<UBadge
								v-if="item.badge"
								color="primary"
								variant="subtle"
								size="xs"
								class="ml-auto text-[12px] px-1.5 py-0"
							>
								{{ item.badge }}
							</UBadge>
						</NuxtLink>
					</div>
				</div>
			</nav>

			<div class="p-4 border-t border-black/4 dark:border-white/4 text-xs text-gray-500 dark:text-gray-400 text-center">
				TaiwanFRP Dashboard
			</div>
		</aside>

		<!-- Main Content -->
		<main class="relative z-10 flex-1 md:ml-64 w-full">
			<slot v-if="isAccountActive" />

			<!-- 尚未啟用的帳號不能使用儀表板的 API, 只顯示說明 -->
			<div
				v-else-if="user"
				class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
			>
				<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
					<div class="flex flex-col items-center gap-4 py-4 text-center">
						<div class="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-full text-amber-600 dark:text-amber-400">
							<UIcon
								name="i-heroicons-lock-closed"
								class="w-8 h-8"
							/>
						</div>

						<div>
							<h1 class="text-xl font-bold text-gray-900 dark:text-white">
								帳號尚未啟用
							</h1>
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
								您需要加入 TaiwanFRP 的 Discord 伺服器，並在伺服器內按下「啟用帳號」按鈕，才能使用儀表板。
							</p>
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
								如果無法啟用，可以開工單詢問客服。
							</p>
						</div>

						<div class="flex flex-wrap justify-center gap-2">
							<UButton
								v-if="config.public.discordUrl"
								label="加入 Discord 伺服器"
								icon="i-simple-icons-discord"
								:to="config.public.discordUrl"
								target="_blank"
							/>
							<UButton
								label="我已經啟用了"
								icon="i-heroicons-arrow-path"
								color="neutral"
								variant="outline"
								:loading="isCheckingActivation"
								@click="checkActivation"
							/>
							<UButton
								label="開工單"
								icon="i-heroicons-lifebuoy"
								color="neutral"
								variant="ghost"
								:to="localePath('/tickets/new')"
							/>
						</div>
					</div>
				</UCard>
			</div>
		</main>
	</div>
</template>
