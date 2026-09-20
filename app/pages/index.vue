<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

const config = useRuntimeConfig()
const discordUrl = config.public.discordUrl

const installCommand = 'curl -sfL https://get.taiwanfrp.me | sh -'
// 切換圖示用
const isCopied = ref(false)

const copyCommand = async () => {
	try {
		await navigator.clipboard.writeText(installCommand)
		isCopied.value = true

		setTimeout(() => {
			isCopied.value = false
		}, 1000)
	}
	catch (err) {
		console.error('複製失敗:', err)
	}
}

const snapEnabled = ref(true)

useHead({
	htmlAttrs: {
		// 做平滑動畫時暫時移除 snap-y 以避免跳躍
		class: computed(() => snapEnabled.value ? 'snap-y snap-mandatory hide-scrollbar' : 'hide-scrollbar'),
	},
})

// 滾動攔截
const isScrolling = ref(false)
let scrollTimeout: ReturnType<typeof setTimeout>

// 平滑捲動引擎
const smoothScrollTo = (targetPosition: number, duration: number) => {
	const startPosition = window.scrollY
	const distance = targetPosition - startPosition
	let startTime: number | null = null

	// EaseInOutCubic
	const ease = (t: number, b: number, c: number, d: number) => {
		t /= d / 2
		if (t < 1) return (c / 2) * t * t * t + b
		t -= 2
		return (c / 2) * (t * t * t + 2) + b
	}

	const animation = (currentTime: number) => {
		if (startTime === null) startTime = currentTime
		const timeElapsed = currentTime - startTime
		const run = ease(timeElapsed, startPosition, distance, duration)

		window.scrollTo(0, run)

		if (timeElapsed < duration) {
			requestAnimationFrame(animation)
		}
		else {
			// 定位
			window.scrollTo(0, targetPosition)
		}
	}

	requestAnimationFrame(animation)
}

const handleWheel = (e: WheelEvent) => {
	if (e.ctrlKey || e.metaKey) return

	// 避免短時間連續多次換頁
	if (isScrolling.value) {
		e.preventDefault()
		return
	}

	// 取得所有 snap-start 的區塊
	const sections = Array.from(document.querySelectorAll('section.snap-start')) as HTMLElement[]
	if (!sections.length) return

	// 計算當前畫面顯示哪個區塊
	let currentIndex = 0
	let minDiff = Infinity
	sections.forEach((sec, idx) => {
		const rect = sec.getBoundingClientRect()
		const diff = Math.abs(rect.top)
		if (diff < minDiff) {
			minDiff = diff
			currentIndex = idx
		}
	})

	// 判斷滾動方向
	let targetIndex = currentIndex
	if (e.deltaY > 30) {
		// 往下
		targetIndex = Math.min(currentIndex + 1, sections.length - 1)
	}
	else if (e.deltaY < -30) {
		// 往上
		targetIndex = Math.max(currentIndex - 1, 0)
	}
	else {
		return
	}

	if (targetIndex !== currentIndex) {
		e.preventDefault() // 阻止原生滾動
		isScrolling.value = true

		// 關閉 CSS 的原生吸附
		snapEnabled.value = false

		// 取得目標區塊
		const targetSection = sections[targetIndex]
		if (!targetSection) return

		// 取得目標區塊的 Y 座標
		const targetY = targetSection.getBoundingClientRect().top + window.scrollY

		smoothScrollTo(targetY, 1000)

		// 鎖定並等待滾動完成
		clearTimeout(scrollTimeout)
		scrollTimeout = setTimeout(() => {
			isScrolling.value = false
			// 動畫結束後恢復 CSS 的原生吸附
			snapEnabled.value = true
		}, 1050)
	}
}

onMounted(() => {
	// 必須使用 passive: false 才能調用 e.preventDefault()
	window.addEventListener('wheel', handleWheel, { passive: false })
})

onUnmounted(() => {
	window.removeEventListener('wheel', handleWheel)
	clearTimeout(scrollTimeout)
})
</script>

<template>
	<div class="w-full">
		<!-- Hero -->
		<section class="snap-start min-h-dvh flex flex-col items-center justify-center relative px-4 sm:px-6 lg:px-8 -mt-16 pt-16">
			<!-- Main Content -->
			<div class="relative z-10 text-center max-w-4xl mx-auto flex flex-col items-center">
				<!-- Badge -->
				<div class="mb-8 flex justify-center">
					<span class="inline-flex items-center rounded-full bg-primary-50/60 dark:bg-primary-500/10 px-4 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 ring-1 ring-inset ring-primary-500/20 shadow-sm backdrop-blur-sm">
						{{ $t('home.hero.badge') }}
					</span>
				</div>

				<!-- Main Heading -->
				<h1 class="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 dark:text-white drop-shadow-sm">
					{{ $t('home.hero.title') }}
				</h1>

				<!-- Subheading -->
				<p class="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
					{{ $t('home.hero.subtitle_line1') }}
					<br class="hidden sm:block">
					{{ $t('home.hero.subtitle_line2') }}
				</p>

				<div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full sm:w-auto">
					<UButton
						:label="$t('home.hero.btn_start')"
						trailing-icon="i-heroicons-arrow-right-20-solid"
						size="xl"
						color="primary"
						to="https://api.taiwanfrp.me/api/v1/auth/discord/login"
						class="rounded-lg px-8 py-3 font-semibold transition-transform hover:scale-105 w-full sm:w-auto justify-center"
					/>

					<UButton
						:label="$t('home.hero.btn_video')"
						icon="i-heroicons-play-circle"
						size="xl"
						color="secondary"
						variant="soft"
						to="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
						class="rounded-lg px-8 py-3 font-semibold w-full sm:w-auto justify-center bg-secondary-200 dark:bg-secondary-500/40 transition hover:scale-105"
					/>
				</div>
			</div>
		</section>

		<div class="bg-white/40 dark:bg-gray-900/30 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-800/50">
			<!-- What is FRP -->
			<section
				id="what-is-frp"
				class="snap-start min-h-dvh flex flex-col items-center justify-center relative py-20"
			>
				<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
					<div class="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
						<!-- Text -->
						<div class="flex-1 text-center lg:text-left">
							<h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl mb-6">
								{{ $t('home.what_is_frp.title_line1') }}<br class="hidden sm:block">{{ $t('home.what_is_frp.title_line2') }}
							</h2>
							<div class="space-y-6 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
								<p v-html="$t('home.what_is_frp.paragraph1')" />
								<p v-html="$t('home.what_is_frp.paragraph2')" />
							</div>
						</div>

						<!-- Visual -->
						<div class="flex-1 w-full max-w-lg mx-auto relative mt-8 lg:mt-0">
							<div class="flex items-center justify-between relative bg-white/60 dark:bg-gray-900/60 p-6 sm:p-8 rounded-4xl border border-gray-200 dark:border-gray-800 shadow-sm backdrop-blur-sm">
								<div class="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-0 border-t-2 border-dashed border-gray-300 dark:border-gray-700 z-0" />
								<!-- Local Host -->
								<div class="flex flex-col items-center z-10 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
									<div class="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
										<UIcon
											name="i-heroicons-computer-desktop"
											class="w-7 h-7 text-gray-600 dark:text-gray-300"
										/>
									</div>
									<span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('home.what_is_frp.local_host') }}</span>
									<span class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('home.what_is_frp.local_ip') }}</span>
								</div>

								<!-- Tunnel -->
								<div class="flex flex-col items-center z-10">
									<div class="w-16 h-16 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(var(--color-primary-500),0.3)] ring-4 ring-white dark:ring-gray-900">
										<UIcon
											name="i-heroicons-arrows-right-left"
											class="w-8 h-8 text-primary-600 dark:text-primary-400"
										/>
									</div>
									<span class="text-sm font-bold text-primary-600 dark:text-primary-400">{{ $t('home.what_is_frp.secure_tunnel') }}</span>
								</div>

								<!-- Internet -->
								<div class="flex flex-col items-center z-10 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
									<div class="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
										<UIcon
											name="i-heroicons-globe-alt"
											class="w-7 h-7 text-gray-600 dark:text-gray-300"
										/>
									</div>
									<span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('home.what_is_frp.internet') }}</span>
									<span class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('home.what_is_frp.public_visitor') }}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Why you should use FRP -->
			<section
				id="why-use-frp"
				class="snap-start min-h-dvh flex flex-col items-center justify-center relative py-20"
			>
				<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
					<div class="text-center max-w-3xl mx-auto mb-10 md:mb-14">
						<h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
							{{ $t('home.why_use_frp.title') }}
						</h2>
						<p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
							{{ $t('home.why_use_frp.subtitle') }}
						</p>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
						<div class="flex flex-col items-center text-center p-8 bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
							<UIcon
								name="i-heroicons-code-bracket"
								class="w-12 h-12 text-primary-600 dark:text-primary-400 mb-5"
							/>
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
								{{ $t('home.why_use_frp.case1_title') }}
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								{{ $t('home.why_use_frp.case1_desc') }}
							</p>
						</div>

						<div class="flex flex-col items-center text-center p-8 bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
							<UIcon
								name="i-heroicons-puzzle-piece"
								class="w-12 h-12 text-primary-600 dark:text-primary-400 mb-5"
							/>
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
								{{ $t('home.why_use_frp.case2_title') }}
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								{{ $t('home.why_use_frp.case2_desc') }}
							</p>
						</div>

						<div class="flex flex-col items-center text-center p-8 bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
							<UIcon
								name="i-heroicons-computer-desktop"
								class="w-12 h-12 text-primary-600 dark:text-primary-400 mb-5"
							/>
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
								{{ $t('home.why_use_frp.case3_title') }}
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								{{ $t('home.why_use_frp.case3_desc') }}
							</p>
						</div>
					</div>
				</div>
			</section>

			<!-- Service features -->
			<section class="snap-start min-h-dvh flex flex-col items-center justify-center relative py-20">
				<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
					<div class="text-center max-w-3xl mx-auto mb-10 md:mb-14">
						<h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
							{{ $t('home.service_features.title') }}
						</h2>
						<p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
							{{ $t('home.service_features.subtitle') }}
						</p>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
						<div class="p-8 rounded-3xl bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
							<div class="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-6">
								<UIcon
									name="i-heroicons-bolt"
									class="w-6 h-6 text-primary-600 dark:text-primary-400"
								/>
							</div>
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
								{{ $t('home.service_features.feature1_title') }}
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								{{ $t('home.service_features.feature1_desc') }}
							</p>
						</div>
						<div class="p-8 rounded-3xl bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
							<div class="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-6">
								<UIcon
									name="i-heroicons-computer-desktop"
									class="w-6 h-6 text-primary-600 dark:text-primary-400"
								/>
							</div>
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
								{{ $t('home.service_features.feature2_title') }}
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								{{ $t('home.service_features.feature2_desc') }}
							</p>
						</div>
						<div class="p-8 rounded-3xl bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
							<div class="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-6">
								<UIcon
									name="i-heroicons-command-line"
									class="w-6 h-6 text-primary-600 dark:text-primary-400"
								/>
							</div>
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
								{{ $t('home.service_features.feature3_title') }}
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								{{ $t('home.service_features.feature3_desc') }}
							</p>
						</div>
					</div>
				</div>
			</section>

			<!-- Pricing Plans -->
			<section class="snap-start min-h-dvh flex flex-col items-center justify-center relative py-20">
				<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
					<div class="text-center max-w-3xl mx-auto mb-10 md:mb-14">
						<h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
							{{ $t('home.pricing.title') }}
						</h2>
						<p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
							{{ $t('home.pricing.subtitle') }}
						</p>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
						<!-- Free -->
						<div class="flex flex-col p-8 bg-white dark:bg-gray-900/90 rounded-3xl border-2 border-primary-500/20 dark:border-primary-500/30 shadow-lg relative overflow-hidden">
							<div class="absolute top-0 right-0 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
								{{ $t('home.pricing.free_badge') }}
							</div>
							<h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
								{{ $t('home.pricing.free_title') }}
							</h3>
							<p class="text-gray-500 dark:text-gray-400 mb-6 text-sm">
								{{ $t('home.pricing.free_subtitle') }}
							</p>
							<div class="flex items-baseline gap-2 mb-8">
								<span class="text-5xl font-extrabold text-gray-900 dark:text-white">{{ $t('home.pricing.free_price') }}</span>
								<span class="text-gray-500 dark:text-gray-400 font-medium">{{ $t('home.pricing.free_period') }}</span>
							</div>
							<ul class="space-y-4 mb-8 flex-1">
								<li class="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-medium">
									<UIcon
										name="i-heroicons-check-circle"
										class="w-6 h-6 text-primary-500 shrink-0"
									/>
									{{ $t('home.pricing.free_feature1') }}
								</li>
								<li class="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-medium">
									<UIcon
										name="i-heroicons-check-circle"
										class="w-6 h-6 text-primary-500 shrink-0"
									/>
									{{ $t('home.pricing.free_feature2') }}
								</li>
								<li class="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-medium">
									<UIcon
										name="i-heroicons-check-circle"
										class="w-6 h-6 text-primary-500 shrink-0"
									/>
									{{ $t('home.pricing.free_feature3') }}
								</li>
								<li class="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-medium">
									<UIcon
										name="i-heroicons-check-circle"
										class="w-6 h-6 text-primary-500 shrink-0"
									/>
									{{ $t('home.pricing.free_feature4') }}
								</li>
							</ul>
							<UButton
								:label="$t('home.pricing.free_btn')"
								color="primary"
								block
								size="xl"
								to="https://api.taiwanfrp.me/api/v1/auth/discord/login"
								class="rounded-xl font-bold transition-transform hover:scale-[1.02]"
							/>
						</div>

						<!-- Advanced Customized -->
						<div class="flex flex-col p-8 bg-gray-50/80 dark:bg-gray-800/50 rounded-3xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow relative">
							<h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
								{{ $t('home.pricing.advanced_title') }}
							</h3>
							<p class="text-gray-500 dark:text-gray-400 mb-6 text-sm">
								{{ $t('home.pricing.advanced_subtitle') }}
							</p>
							<div class="flex items-baseline gap-2 mb-8">
								<span class="text-4xl font-extrabold text-gray-900 dark:text-white">{{ $t('home.pricing.advanced_price') }}</span>
							</div>
							<ul class="space-y-4 mb-8 flex-1">
								<li class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
									<UIcon
										name="i-heroicons-check"
										class="w-5 h-5 text-gray-400 shrink-0"
									/>
									{{ $t('home.pricing.advanced_feature1') }}
								</li>
								<li class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
									<UIcon
										name="i-heroicons-check"
										class="w-5 h-5 text-gray-400 shrink-0"
									/>
									{{ $t('home.pricing.advanced_feature2') }}
								</li>
								<li class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
									<UIcon
										name="i-heroicons-check"
										class="w-5 h-5 text-gray-400 shrink-0"
									/>
									{{ $t('home.pricing.advanced_feature3') }}
								</li>
								<li class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
									<UIcon
										name="i-heroicons-check"
										class="w-5 h-5 text-gray-400 shrink-0"
									/>
									{{ $t('home.pricing.advanced_feature4') }}
								</li>
							</ul>
							<UButton
								:label="$t('home.pricing.advanced_btn')"
								color="neutral"
								variant="solid"
								block
								size="xl"
								:to="discordUrl"
								target="_blank"
								class="rounded-xl font-bold"
							/>
						</div>
					</div>
				</div>
			</section>

			<!-- Open Source and Security -->
			<section class="snap-start min-h-dvh flex flex-col items-center justify-center relative py-20">
				<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl w-full">
					<div class="bg-gray-900 dark:bg-gray-950 rounded-4xl overflow-hidden shadow-2xl border border-gray-800 relative">
						<div class="absolute inset-0 bg-[url('/background.png')] opacity-10 bg-cover bg-center mix-blend-overlay" />

						<div class="relative p-10 sm:p-16 flex flex-col lg:flex-row items-center justify-between gap-12">
							<div class="text-left max-w-xl">
								<h2 class="text-3xl font-bold text-white sm:text-4xl mb-4">
									{{ $t('home.open_source.title') }}
								</h2>
								<p class="text-gray-300 text-lg mb-8 leading-relaxed">
									{{ $t('home.open_source.desc') }}
								</p>
								<div class="flex gap-4">
									<UButton
										:label="$t('home.open_source.btn')"
										icon="i-simple-icons-github"
										color="neutral"
										variant="solid"
										size="lg"
										to="https://github.com/taiwanfrp"
										target="_blank"
										class="px-6 rounded-xl font-medium"
									/>
								</div>
							</div>

							<div class="w-full lg:w-96 bg-black/80 backdrop-blur rounded-xl p-6 border border-gray-700 font-mono text-sm text-gray-300 shadow-inner">
								<div class="flex items-center gap-2 mb-4">
									<div class="w-3 h-3 rounded-full bg-red-500" />
									<div class="w-3 h-3 rounded-full bg-yellow-500" />
									<div class="w-3 h-3 rounded-full bg-green-500" />
								</div>
								<p class="text-green-400">
									$ taiwanfrp tunnel run --token zM2...
								</p>
								<p class="mt-1 text-gray-400">
									[info] Checking version (v2.4.0)...
								</p>
								<p class="mt-1 text-gray-400">
									[info] Verifying authentication token...
								</p>
								<p class="mt-1">
									[info] Create tunnel [my-website] success
								</p>
								<div class="mt-4 pt-4 border-t border-gray-800">
									<p class="text-primary-400">
										Status: <span class="text-white">Connected to TPE-Node</span>
									</p>
									<p class="text-gray-500">
										Latency: 12ms
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Quick Start / Software download -->
			<section class="snap-start min-h-dvh flex flex-col items-center justify-center relative py-20">
				<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl w-full">
					<div class="text-center max-w-3xl mx-auto mb-10 md:mb-14">
						<h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
							{{ $t('home.quick_start.title') }}
						</h2>
						<p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
							{{ $t('home.quick_start.subtitle') }}
						</p>
					</div>

					<div class="bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-lg p-8 sm:p-12">
						<div class="flex flex-col md:flex-row items-center justify-between gap-8">
							<div class="w-full md:w-3/5">
								<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
									<UIcon
										name="i-heroicons-command-line"
										class="w-5 h-5 text-primary-500"
									/>
									{{ $t('home.quick_start.script_title') }}
								</h3>

								<div class="group relative flex items-center justify-between bg-gray-900 text-gray-300 font-mono text-sm sm:text-base rounded-xl p-4 overflow-hidden">
									<div class="truncate mr-4 overflow-x-auto whitespace-nowrap hide-scrollbar">
										<span class="text-green-400 select-none mr-2">$</span>
										<span>{{ installCommand }}</span>
									</div>
									<UButton
										:icon="isCopied ? 'i-heroicons-check-circle' : 'i-heroicons-clipboard-document'"
										:color="isCopied ? 'primary' : 'neutral'"
										variant="ghost"
										class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800/80 hover:bg-gray-700"
										aria-label="Copy to clipboard"
										@click="copyCommand"
									/>
								</div>
								<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
									{{ $t('home.quick_start.script_desc') }}
								</p>
							</div>

							<div class="hidden md:block w-px h-32 bg-gray-200 dark:bg-gray-800" />
							<div class="md:hidden w-full h-px bg-gray-200 dark:bg-gray-800" />

							<div class="w-full md:w-2/5 flex flex-col items-center text-center">
								<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									{{ $t('home.quick_start.other_title') }}
								</h3>
								<p class="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
									{{ $t('home.quick_start.other_desc') }}
								</p>
								<UButton
									:label="$t('home.quick_start.other_btn')"
									icon="i-heroicons-arrow-down-tray"
									size="lg"
									color="neutral"
									variant="solid"
									to="#"
									target="_blank"
									class="rounded-xl font-medium w-full max-w-50"
								/>
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Join and Contact -->
			<section class="snap-start min-h-dvh flex flex-col items-center justify-between relative pt-20">
				<!-- CTA -->
				<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl w-full flex-1 flex flex-col justify-center items-center text-center pb-20">
					<div class="w-20 h-20 bg-primary-100 dark:bg-primary-900/50 rounded-2xl flex items-center justify-center mb-8 shadow-sm">
						<UIcon
							name="i-heroicons-server-stack"
							class="w-10 h-10 text-primary-600 dark:text-primary-400"
						/>
					</div>
					<h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl mb-6">
						{{ $t('home.join_contact.title') }}
					</h2>
					<p class="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
						{{ $t('home.join_contact.desc_line1') }}<br class="hidden sm:block">
						{{ $t('home.join_contact.desc_line2') }}
					</p>

					<UButton
						:label="$t('home.join_contact.btn')"
						icon="i-simple-icons-discord"
						size="xl"
						color="primary"
						variant="solid"
						:to="discordUrl"
						target="_blank"
						class="rounded-xl font-bold px-8 shadow-md hover:shadow-lg transition-shadow"
					/>
				</div>

				<!-- Footer -->
				<footer class="w-full bg-white/60 dark:bg-gray-950/60 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-800/50 py-6 sm:py-8 mt-auto z-10">
					<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
						<div class="flex items-center gap-3 text-center md:text-left">
							<span class="text-xl font-bold text-gray-900 dark:text-white">TaiwanFRP</span>
							<span class="text-gray-400 dark:text-gray-600">|</span>
							<span class="text-sm font-medium text-gray-500 dark:text-gray-400">
								&copy; {{ new Date().getFullYear() }} All rights reserved.
							</span>
						</div>

						<div class="flex items-center gap-6">
							<a
								href="mailto:support@taiwanfrp.me"
								class="group flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
							>
								<div class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/50 flex items-center justify-center transition-colors">
									<UIcon
										name="i-heroicons-envelope-solid"
										class="w-4 h-4"
									/>
								</div>
								<span class="text-sm font-semibold">support@taiwanfrp.me</span>
							</a>
							<a
								:href="discordUrl"
								target="_blank"
								class="group flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-[#5865F2] dark:hover:text-[#5865F2] transition-colors"
							>
								<div class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-[#5865F2]/10 flex items-center justify-center transition-colors">
									<UIcon
										name="i-simple-icons-discord"
										class="w-4 h-4"
									/>
								</div>
								<span class="text-sm font-semibold">{{ $t('home.join_contact.footer_discord') }}</span>
							</a>
						</div>
					</div>
				</footer>
			</section>
		</div>
	</div>
</template>
