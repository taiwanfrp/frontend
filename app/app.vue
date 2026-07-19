<script setup lang="ts">
const colorMode = useColorMode()
const isDark = computed({
	get: () => colorMode.value === 'dark',
	set: (value) => {
		colorMode.preference = value ? 'dark' : 'light'
	},
})

const { locale, locales, setLocale, t } = useI18n()

const isLangOpen = ref(false)
const isMobileMenuOpen = ref(false)

const selectLanguage = (code: Parameters<typeof setLocale>[0]) => {
	setLocale(code)
	isLangOpen.value = false
}

const isAtTop = ref(true)

onMounted(() => {
	const handleScroll = () => {
		// 當往下滾動超過 10px 時 isAtTop 變為 false (顯示捲軸)
		isAtTop.value = window.scrollY < 10
	}

	window.addEventListener('scroll', handleScroll, { passive: true })
	handleScroll() // 初始化執行一次確認位置

	// 元件卸載時清除監聽，避免記憶體洩漏
	onUnmounted(() => {
		window.removeEventListener('scroll', handleScroll)
	})
})

// 將判斷結果綁定到 <html> tag 的 class 上
useHead({
	htmlAttrs: {
		class: computed(() => isAtTop.value ? 'hide-scrollbar' : ''),
	},
})

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
		<header
			class="sticky top-0 z-50 transition-all duration-300"
			:class="isMobileMenuOpen
				? 'bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-800/50'
				: 'bg-transparent border-b border-transparent hover:border-gray-200 dark:hover:border-gray-800 hover:bg-white/75 dark:hover:bg-gray-950/75 backdrop-blur'"
		>
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
						<div
							v-if="isLangOpen"
							class="fixed inset-0 z-40"
							@click="isLangOpen = false"
						/>
						<UButton
							icon="i-heroicons-language-20-solid"
							color="neutral"
							variant="ghost"
							square
							class="relative z-50"
							@click="isLangOpen = !isLangOpen"
						/>

						<!-- 下拉內容: 預設隱藏 (opacity-0, invisible), 當滑鼠移入 group 時顯示 -->
						<!-- pt-2 (padding-top: 0.5rem) 防止滑鼠往下移時不會斷開接觸 -->
						<div
							class="absolute right-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50"
							:class="isLangOpen ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'"
						>
							<!-- 選單本體外觀 -->
							<div class="w-36 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg flex flex-col relative z-50">
								<button
									v-for="l in locales"
									:key="l.code"
									class="flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-colors w-full text-left"
									:class="locale === l.code ? 'bg-gray-100 dark:bg-gray-800 text-primary-500 font-medium' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'"
									@click="selectLanguage(l.code)"
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

					<UButton
						:icon="isMobileMenuOpen ? 'i-heroicons-x-mark-20-solid' : 'i-heroicons-bars-3-solid'"
						color="neutral"
						variant="ghost"
						square
						class="md:hidden"
						aria-label="Toggle Menu"
						@click="isMobileMenuOpen = !isMobileMenuOpen"
					/>
				</div>
			</div>

			<!-- 手機版下拉導覽列 -->
			<Transition
				enter-active-class="transition duration-300 ease-out"
				enter-from-class="opacity-0 -translate-y-2"
				enter-to-class="opacity-100 translate-y-0"
				leave-active-class="transition duration-200 ease-in"
				leave-from-class="opacity-100 translate-y-0"
				leave-to-class="opacity-0 -translate-y-2"
			>
				<div
					v-show="isMobileMenuOpen"
					class="md:hidden absolute top-full left-0 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-800/50 shadow-lg py-2"
				>
					<nav class="flex flex-col px-4 space-y-1">
						<NuxtLink
							v-for="link in navLinks"
							:key="link.label"
							:to="link.to"
							class="px-4 py-3 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors"
							@click="isMobileMenuOpen = false"
						>
							{{ link.label }}
						</NuxtLink>

						<div class="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2">
							<UButton
								label="Log In"
								color="neutral"
								variant="ghost"
								class="w-full justify-start px-4 py-3 text-base font-medium"
							/>
						</div>
					</nav>
				</div>
			</Transition>
		</header>

		<main>
			<NuxtPage />
		</main>
	</div>
</template>
