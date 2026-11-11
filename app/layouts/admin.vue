<script setup lang="ts">
const route = useRoute()
const { isLoading, isAdmin } = useAuth()
const localePath = useLocalePath()

watchEffect(() => {
	if (!isLoading.value && !isAdmin.value) {
		navigateTo(localePath('/'))
	}
})

const menuGroups = [
	{
		title: '管理',
		items: [
			{ label: '概覽', icon: 'i-heroicons-squares-2x2', to: '/admin' },
			{ label: '使用者', icon: 'i-heroicons-users', to: '/admin/users' },
			{ label: '身份組', icon: 'i-heroicons-identification', to: '/admin/roles' },
			{ label: '權限節點', icon: 'i-heroicons-key', to: '/admin/permissions' },
		],
	},
]

const isActive = (itemPath: string) => {
	if (itemPath === '/admin') {
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
							:class="isActive(item.to)
								? 'bg-primary-500/8 text-primary-600 dark:text-primary-400'
								: 'text-gray-700 dark:text-gray-300 hover:bg-gray-900/5 dark:hover:bg-white/5'"
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
				TaiwanFRP Admin
			</div>
		</aside>

		<!-- Main Content -->
		<main class="relative z-10 flex-1 md:ml-64 w-full">
			<slot />
		</main>
	</div>
</template>
