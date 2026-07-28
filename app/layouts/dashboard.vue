<script setup lang="ts">
const route = useRoute()
const { user, isLoading } = useAuth()

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

const menuGroups = [
	{
		title: '核心服務',
		items: [
			{ label: '概覽', icon: 'i-heroicons-squares-2x2', to: '/dashboard' },
			{ label: '節點', icon: 'i-heroicons-server', to: '/dashboard/nodes' },
			{ label: '隧道', icon: 'i-heroicons-arrows-right-left', to: '/dashboard/tunnels' },
			{ label: '子網域', icon: 'i-heroicons-globe-alt', to: '/dashboard/subdomains' },
		],
	},
	{
		title: '進階配置',
		items: [
			{ label: '憑證', icon: 'i-heroicons-shield-check', to: '/dashboard/certificates' },
			{ label: 'API', icon: 'i-heroicons-command-line', to: '/dashboard/api' },
		],
	},
	{
		title: '監控與日誌',
		items: [
			{ label: '日誌', icon: 'i-heroicons-clipboard-document-list', to: '/dashboard/logs' },
			{ label: '統計', icon: 'i-heroicons-chart-bar', to: '/dashboard/statistics' },
		],
	},
	{
		title: '帳號與系統',
		items: [
			{ label: '使用者', icon: 'i-heroicons-users', to: '/dashboard/users' },
			{ label: '通知', icon: 'i-heroicons-bell', to: '/dashboard/notifications' },
			{ label: '整合', icon: 'i-heroicons-puzzle-piece', to: '/dashboard/integrations' },
			{ label: '設定', icon: 'i-heroicons-cog-6-tooth', to: '/dashboard/settings' },
		],
	},
	{
		title: '幫助',
		items: [
			{ label: '支援', icon: 'i-heroicons-lifebuoy', to: '/dashboard/support' },
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
							:to="item.to"
							class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
							:class="
								isActive(item.to)
									? 'bg-primary-500/8 text-primary-600 dark:text-primary-400'
									: 'text-gray-700 dark:text-gray-300 hover:bg-gray-900/5 dark:hover:bg-white/5'
							"
						>
							<UIcon
								:name="item.icon"
								class="w-5 h-5 shrink-0"
							/>
							{{ item.label }}
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
			<slot />
		</main>
	</div>
</template>
