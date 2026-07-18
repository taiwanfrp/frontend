<script setup lang="ts">
const colorMode = useColorMode()
const isDark = computed({
	get: () => colorMode.value === 'dark',
	set: (value) => {
		colorMode.preference = value ? 'dark' : 'light'
	},
})

const { locale, locales, setLocale, t } = useI18n()

const navLinks = computed(() => [
	{ label: t('nav.about'), to: '#' },
	{ label: t('nav.services'), to: '#' },
	{ label: t('nav.download'), to: '#' },
	{ label: t('nav.tutorials'), to: '#' },
	{ label: t('nav.blacklist_lookup'), to: '#' },
	{ label: t('nav.docs'), to: '#' },
])
</script>

<template>
	<div class="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans antialiased">
		<!-- Top Bar -->
		<header class="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/75 dark:bg-gray-950/75 backdrop-blur">
			<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl flex items-center justify-between h-16">
				<!-- Logo -->
				<NuxtLink
					:to="$localePath('/')"
					class="flex items-center gap-2 group"
				>
					<!-- <UIcon name="i-heroicons-globe-alt-20-solid" class="w-7 h-7 text-primary group-hover:text-primary-600 transition-colors" /> -->
					<span class="text-xl font-bold">TaiwanFRP</span>
				</NuxtLink>

				<!-- 導覽連結 -->
				<nav class="hidden md:flex items-center gap-6">
					<NuxtLink
						v-for="link in navLinks"
						:key="link.label"
						:to="link.to"
						class="text-sm font-medium text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary-400 transition-colors"
					>
						{{ link.label }}
					</NuxtLink>
				</nav>

				<!-- 右側按鈕群 -->
				<div class="flex items-center gap-2 sm:gap-3">
					<!-- 搜尋按鈕 -->
					<!-- <UButton
						icon="i-heroicons-magnifying-glass-20-solid"
						color="neutral"
						variant="ghost"
						square
					/> -->

					<!-- 語言切換選單 -->
					<!-- 加入 group class 連動滑鼠狀態 -->
					<div class="relative group">
						<UButton
							icon="i-heroicons-language-20-solid"
							color="neutral"
							variant="ghost"
							square
						/>

						<!-- 下拉內容: 預設隱藏 (opacity-0, invisible), 當滑鼠移入 group 時顯示 -->
						<!-- pt-2 (padding-top: 0.5rem) 防止滑鼠往下移時不會斷開接觸 -->
						<div class="absolute right-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
							<!-- 選單本體外觀 -->
							<div class="w-36 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg flex flex-col">
								<button
									v-for="l in locales"
									:key="l.code"
									class="flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-colors w-full text-left"
									:class="locale === l.code ? 'bg-gray-100 dark:bg-gray-800 text-primary-500 font-medium' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'"
									@click="setLocale(l.code)"
								>
									<UIcon
										name="i-heroicons-check-20-solid"
										class="w-4 h-4 shrink-0 transition-opacity"
										:class="locale === l.code ? 'opacity-100' : 'opacity-0'"
									/>
									{{ l.name }}
								</button>
							</div>
						</div>
					</div>

					<!-- 深淺色切換按鈕 -->
					<UButton
						:icon="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'"
						color="neutral"
						variant="ghost"
						square
						@click="isDark = !isDark"
					/>

					<UButton
						label="Log In"
						color="neutral"
						variant="ghost"
						class="hidden sm:inline-flex text-sm"
					/>

					<!-- <UButton
						label="Get started"
						color="primary"
						class="px-4 py-2 text-sm rounded-lg font-semibold"
					/> -->
					<UButton
						icon="i-simple-icons-github"
						to="https://github.com/taiwanfrp"
						target="_blank"
						color="neutral"
						variant="ghost"
						square
						aria-label="GitHub repository"
					/>
				</div>
			</div>
		</header>

		<main>
			<NuxtPage />
		</main>
	</div>
</template>
