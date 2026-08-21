<script setup lang="ts">
definePageMeta({
	layout: 'dashboard',
})

const config = useRuntimeConfig()

const resources = [
	{
		label: '說明文件',
		description: '閱讀完整的使用教學與 API 串接指南',
		icon: 'i-heroicons-book-open',
		url: '#',
		iconColor: 'text-emerald-600 dark:text-emerald-400',
		iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
	},
	{
		label: 'Discord 社群',
		description: '加入社群與其他使用者交流、尋求技術支援',
		icon: 'i-simple-icons-discord',
		url: config.public.discordUrl,
		iconColor: 'text-[#5865F2]',
		iconBg: 'bg-[#5865F2]/10',
	},
	{
		label: '聯絡客服團隊',
		description: '寄送 Email 聯絡我們 (建議優先透過 Discord)',
		icon: 'i-heroicons-envelope',
		url: 'mailto:support@taiwanfrp.me',
		iconColor: 'text-sky-600 dark:text-sky-400',
		iconBg: 'bg-sky-100 dark:bg-sky-900/50',
	},
]

const legalLinks = [
	{ label: '服務條款', url: '#', icon: 'i-heroicons-document-text' },
	{ label: '隱私權政策', url: '#', icon: 'i-heroicons-shield-check' },
]
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<!-- 頁面標頭 -->
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
				關於平台
			</h1>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div class="space-y-6">
				<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
					<template #header>
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white flex items-center gap-2">
							<UIcon
								name="i-heroicons-information-circle"
								class="w-5 h-5 text-primary-500"
							/>
							TaiwanFRP
						</h3>
					</template>

					<div class="text-sm text-gray-600 dark:text-gray-300 space-y-4">
						<p>
							TaiwanFRP 是一個專為開發者與進階玩家設計的內網穿透管理平台。我們致力於提供穩定、低延遲的連線環境，讓您可以輕鬆地將本地端的服務暴露至公網。
						</p>

						<div class="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
							<span>&copy; {{ new Date().getFullYear() }} TaiwanFRP.</span>
							<span class="flex items-center gap-1">
								Made with <UIcon
									name="i-heroicons-heart-solid"
									class="w-4 h-4 text-red-500"
								/> Vue & Nuxt.
							</span>
						</div>
					</div>
				</UCard>

				<!-- 法律與政策 -->
				<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
					<template #header>
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white flex items-center gap-2">
							<UIcon
								name="i-heroicons-shield-check"
								class="w-5 h-5 text-gray-500"
							/>
							法律與政策
						</h3>
					</template>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<NuxtLink
							v-for="link in legalLinks"
							:key="link.label"
							:to="link.url"
							class="flex items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
						>
							<UIcon
								:name="link.icon"
								class="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"
							/>
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
								{{ link.label }}
							</span>
						</NuxtLink>
					</div>
				</UCard>
			</div>

			<!-- 資源與支援 -->
			<div class="space-y-6">
				<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50 h-full">
					<template #header>
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white flex items-center gap-2">
							<UIcon
								name="i-heroicons-lifebuoy"
								class="w-5 h-5 text-indigo-500"
							/>
							資源與支援
						</h3>
					</template>

					<div class="flex flex-col gap-2">
						<a
							v-for="item in resources"
							:key="item.label"
							:href="item.url"
							target="_blank"
							class="flex items-center gap-4 p-3 -mx-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
						>
							<div :class="['p-3 rounded-lg', item.iconBg, item.iconColor]">
								<UIcon
									:name="item.icon"
									class="w-6 h-6"
								/>
							</div>

							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-white truncate">
									{{ item.label }}
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
									{{ item.description }}
								</p>
							</div>

							<UIcon
								name="i-heroicons-arrow-top-right-on-square"
								class="w-5 h-5 text-gray-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
							/>
						</a>
					</div>
				</UCard>
			</div>
		</div>
	</div>
</template>
