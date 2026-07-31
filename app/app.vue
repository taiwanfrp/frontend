<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
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

const isUserMenuOpen = ref(false)
const isMobileUserMenuOpen = ref(false)

const selectLanguage = (code: Parameters<typeof setLocale>[0]) => {
	setLocale(code)
	isLangOpen.value = false
}

const { user, isLoading, fetchUser, logout, getAvatarUrl } = useAuth()

const isAtTop = ref(true)

onMounted(() => {
	const handleScroll = () => {
		// 當往下滾動超過 10px 時 isAtTop 變為 false (顯示捲軸)
		isAtTop.value = window.scrollY < 10
	}

	window.addEventListener('scroll', handleScroll, { passive: true })
	handleScroll() // 初始化執行一次確認位置

	// 元件卸載時清除監聽, 避免記憶體洩漏
	onUnmounted(() => {
		window.removeEventListener('scroll', handleScroll)
	})

	fetchUser()
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
	<div class="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans antialiased relative">
		<!-- 背景 -->
		<div
			v-if="!route.meta.hideBackground"
			class="fixed inset-0 z-0 flex items-center justify-center bg-white dark:bg-gray-950 pointer-events-none"
		>
			<!-- Background Image -->
			<div
				class="absolute inset-0 bg-cover bg-center bg-no-repeat"
				style="background-image: url('/background.png');"
			/>

			<!-- 中層半透明顏色遮罩 (不透明度 + 輕微毛玻璃) -->
			<div class="absolute inset-0 bg-white/30 dark:bg-gray-950/55 backdrop-blur-sm" />

			<!-- Dotted Background -->
			<div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNEMUQ1REIiLz48L3N2Zz4=')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiMzNzQxNTEiLz48L3N2Zz4=')] mask-[radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
		</div>

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

					<ClientOnly>
						<div
							v-if="isLoading"
							class="hidden sm:inline-flex w-16 h-8 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg"
						/>
						<UButton
							v-else-if="!user"
							label="Log In"
							color="neutral"
							variant="ghost"
							class="hidden sm:inline-flex text-sm"
							to="https://api.taiwanfrp.me/api/v1/auth/discord/login"
						/>

						<div
							v-else
							class="relative group hidden sm:block"
						>
							<!-- 點擊外部關閉的透明遮罩 -->
							<div
								v-if="isUserMenuOpen"
								class="fixed inset-0 z-40"
								@click="isUserMenuOpen = false"
							/>

							<!-- 顯示 username 與頭像 -->
							<UButton
								color="neutral"
								variant="ghost"
								class="relative z-50 inline-flex text-sm font-medium px-2"
								trailing-icon="i-heroicons-chevron-down-20-solid"
								@click="isUserMenuOpen = !isUserMenuOpen"
							>
								<div class="flex items-center gap-2">
									<img
										:src="getAvatarUrl(user)"
										class="w-5 h-5 rounded-full object-cover"
										alt="Avatar"
									>
									<span>{{ user.username || 'User' }}</span>
								</div>
							</UButton>

							<!-- 下拉選單內容 -->
							<div
								class="absolute right-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50"
								:class="isUserMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'"
							>
								<div class="w-40 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg flex flex-col relative z-50">
									<NuxtLink
										to="/dashboard"
										class="flex items-center gap-2 px-2.5 py-2 text-sm rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full text-left font-medium mb-1"
										@click="isUserMenuOpen = false"
									>
										<UIcon
											name="i-heroicons-chart-pie-20-solid"
											class="w-4 h-4 shrink-0"
										/>
										儀表板
									</NuxtLink>
									<NuxtLink
										to="/profile"
										class="flex items-center gap-2 px-2.5 py-2 text-sm rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full text-left font-medium mb-1"
										@click="isUserMenuOpen = false"
									>
										<UIcon
											name="i-heroicons-user-circle-20-solid"
											class="w-4 h-4 shrink-0"
										/>
										個人資料
									</NuxtLink>

									<!-- 登出按鈕 -->
									<button
										class="flex items-center gap-2 px-2.5 py-2 text-sm rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full text-left font-medium"
										@click="logout"
									>
										<UIcon
											name="i-heroicons-arrow-right-on-rectangle-20-solid"
											class="w-4 h-4 shrink-0"
										/>
										登出
									</button>
								</div>
							</div>
						</div>
					</ClientOnly>

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

					<!-- 手機版使用者選單 -->
					<ClientOnly>
						<div
							v-if="user"
							class="relative group md:hidden flex items-center ml-1"
						>
							<!-- 點擊外部關閉的透明遮罩 -->
							<div
								v-if="isMobileUserMenuOpen"
								class="fixed inset-0 z-40"
								@click="isMobileUserMenuOpen = false"
							/>

							<!-- 頭像按鈕 -->
							<button
								class="relative z-50 flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 font-semibold text-sm ring-2 ring-transparent hover:ring-primary-500 transition-all overflow-hidden"
								@click="isMobileUserMenuOpen = !isMobileUserMenuOpen"
							>
								<img
									:src="getAvatarUrl(user)"
									class="w-full h-full object-cover"
									alt="Avatar"
								>
							</button>

							<!-- 頭像下拉選單內容 -->
							<div
								class="absolute right-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50"
								:class="isMobileUserMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'"
							>
								<div class="w-48 p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg flex flex-col relative z-50 overflow-hidden">
									<!-- 最上方顯示 username -->
									<div class="px-3 py-2 border-b border-gray-200 dark:border-gray-800 mb-1">
										<p class="text-xs text-gray-500 dark:text-gray-400">
											登入身分
										</p>
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">
											{{ user.username }}
										</p>
									</div>

									<!-- 個人資料 -->
									<NuxtLink
										to="/profile"
										class="flex items-center gap-2 px-2.5 py-2 text-sm rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full text-left font-medium mb-1"
										@click="isMobileUserMenuOpen = false"
									>
										<UIcon
											name="i-heroicons-user-circle-20-solid"
											class="w-4 h-4 shrink-0"
										/>
										個人資料
									</NuxtLink>

									<!-- 登出 -->
									<button
										class="flex items-center gap-2 px-2.5 py-2 text-sm rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full text-left font-medium"
										@click="logout"
									>
										<UIcon
											name="i-heroicons-arrow-right-on-rectangle-20-solid"
											class="w-4 h-4 shrink-0"
										/>
										登出
									</button>
								</div>
							</div>
						</div>
					</ClientOnly>

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

						<ClientOnly>
							<div
								v-if="isLoading"
								class="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2"
							>
								<div
									class="w-full h-10 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg mx-4"
									style="width: calc(100% - 2rem);"
								/>
							</div>

							<!-- 未登入 -->
							<div
								v-else-if="!user"
								class="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2"
							>
								<UButton
									label="Log In"
									color="neutral"
									variant="ghost"
									class="w-full justify-start px-4 py-3 text-base font-medium"
									to="https://api.taiwanfrp.me/api/auth/discord/login"
								/>
							</div>
						</ClientOnly>
					</nav>
				</div>
			</Transition>
		</header>

		<main class="relative z-10">
			<NuxtLayout>
				<NuxtPage />
			</NuxtLayout>
		</main>
	</div>
</template>
