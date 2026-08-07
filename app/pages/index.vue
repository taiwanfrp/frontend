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
			<section class="snap-start min-h-dvh flex flex-col items-center justify-center relative py-20">
				<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
					<div class="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
						<!-- Text -->
						<div class="flex-1 text-center lg:text-left">
							<h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl mb-6">
								什麼是內網穿透 (FRP)？<br class="hidden sm:block">它解決了什麼問題？
							</h2>
							<div class="space-y-6 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
								<p>
									在一般的網路環境中（如社區網路、學校或辦公室），設備通常處於複雜的網路架構下，面臨著<strong>浮動 IP 經常變動</strong>，且往往<strong>無法登入路由器去設定 Port Forwarding (端口轉發)</strong> 的困境。這導致外部網路根本無法穩定地連線到你電腦或伺服器上的服務。
								</p>
								<p>
									<strong>FRP (Fast Reverse Proxy)</strong> 的出現正是為了解決這個痛點。它透過在「帶有固定公網 IP 的節點」與「你的本地主機」之間主動建立一條加密的安全隧道，將外部請求精準地轉發回本地端，讓你免去設定複雜路由器的煩惱。
								</p>
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
									<span class="text-sm font-medium text-gray-700 dark:text-gray-200">本地主機</span>
									<span class="text-xs text-gray-500 dark:text-gray-400 mt-1">內網 IP</span>
								</div>

								<!-- Tunnel -->
								<div class="flex flex-col items-center z-10">
									<div class="w-16 h-16 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(var(--color-primary-500),0.3)] ring-4 ring-white dark:ring-gray-900">
										<UIcon
											name="i-heroicons-arrows-right-left"
											class="w-8 h-8 text-primary-600 dark:text-primary-400"
										/>
									</div>
									<span class="text-sm font-bold text-primary-600 dark:text-primary-400">安全隧道</span>
								</div>

								<!-- Internet -->
								<div class="flex flex-col items-center z-10 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
									<div class="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
										<UIcon
											name="i-heroicons-globe-alt"
											class="w-7 h-7 text-gray-600 dark:text-gray-300"
										/>
									</div>
									<span class="text-sm font-medium text-gray-700 dark:text-gray-200">網際網路</span>
									<span class="text-xs text-gray-500 dark:text-gray-400 mt-1">公網訪客</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<!-- Why you should use FRP -->
			<section class="snap-start min-h-dvh flex flex-col items-center justify-center relative py-20">
				<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
					<div class="text-center max-w-3xl mx-auto mb-10 md:mb-14">
						<h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
							你能在什麼情境下使用？
						</h2>
						<p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
							打破網路限制，提供輕量、彈性且具隱私的連線方案。
						</p>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
						<div class="flex flex-col items-center text-center p-8 bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
							<UIcon
								name="i-heroicons-code-bracket"
								class="w-12 h-12 text-primary-600 dark:text-primary-400 mb-5"
							/>
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
								網站架設與開發測試
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								無需為了單一 Port 特地租用 VPS。完美解決 Ngrok 高延遲的痛點，為本地專案、API 測試或個人網站提供極速的對外連線。
							</p>
						</div>

						<div class="flex flex-col items-center text-center p-8 bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
							<UIcon
								name="i-heroicons-puzzle-piece"
								class="w-12 h-12 text-primary-600 dark:text-primary-400 mb-5"
							/>
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
								遊戲伺服器自架連線
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								自架 Minecraft 或帕魯伺服器，朋友免裝 Radmin VPN 即可輕鬆直連。享受低延遲暢玩的同時，完美隱藏自家真實 IP 以保護隱私。
							</p>
						</div>

						<div class="flex flex-col items-center text-center p-8 bg-white dark:bg-gray-900/80 rounded-3xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
							<UIcon
								name="i-heroicons-computer-desktop"
								class="w-12 h-12 text-primary-600 dark:text-primary-400 mb-5"
							/>
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
								遠端桌面與主機管理
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								出門在外需要連回主機？擺脫 TeamViewer 等第三方軟體的商業限制與緩慢連線。透過映射 SSH 或遠端桌面 (RDP) 端口，享受台灣在地節點的大頻寬直連通道。
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
							我們的核心優勢
						</h2>
						<p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
							告別繁雜的指令與設定檔，用最現代化的方式管理你的內網穿透。
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
								全平台支援，極簡啟動
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								完美相容 Windows、Linux、ARM 架構與 Docker。徹底告別繁瑣的本地設定檔，只需一行指令啟動連接器，即可全自動上線。
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
								網頁面板全權管理
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								將控制權完全轉移至雲端。隧道新增、通訊埠修改、流量監控到節點狀態，皆可透過直覺的視覺化儀表板即時操作與管理。
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
								API First 優先設計
							</h3>
							<p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base">
								提供完整的 OpenAPI (Swagger) 文件。讓開發者能輕鬆呼叫 API 來控制與管理服務，自由整合至自製的應用程式中。
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
							簡單透明的方案
						</h2>
						<p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
							我們提供穩定免費的基礎服務。若有更高規格的需求，歡迎與我們聯繫。
						</p>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
						<!-- Free -->
						<div class="flex flex-col p-8 bg-white dark:bg-gray-900/90 rounded-3xl border-2 border-primary-500/20 dark:border-primary-500/30 shadow-lg relative overflow-hidden">
							<div class="absolute top-0 right-0 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
								最受歡迎
							</div>
							<h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
								免費版
							</h3>
							<p class="text-gray-500 dark:text-gray-400 mb-6 text-sm">
								適合個人與小型專案
							</p>
							<div class="flex items-baseline gap-2 mb-8">
								<span class="text-5xl font-extrabold text-gray-900 dark:text-white">NT$ 0</span>
								<span class="text-gray-500 dark:text-gray-400 font-medium">/ 永久</span>
							</div>
							<ul class="space-y-4 mb-8 flex-1">
								<li class="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-medium">
									<UIcon
										name="i-heroicons-check-circle"
										class="w-6 h-6 text-primary-500 shrink-0"
									/>
									最多支援 3 條隧道
								</li>
								<li class="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-medium">
									<UIcon
										name="i-heroicons-check-circle"
										class="w-6 h-6 text-primary-500 shrink-0"
									/>
									單一隧道限速 24 Mbps (3 MB/s)
								</li>
								<li class="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-medium">
									<UIcon
										name="i-heroicons-check-circle"
										class="w-6 h-6 text-primary-500 shrink-0"
									/>
									流量完全不限
								</li>
								<li class="flex items-center gap-3 text-gray-700 dark:text-gray-300 font-medium">
									<UIcon
										name="i-heroicons-check-circle"
										class="w-6 h-6 text-primary-500 shrink-0"
									/>
									社群與工單客服協助
								</li>
							</ul>
							<UButton
								label="立即開始"
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
								進階客製版
							</h3>
							<p class="text-gray-500 dark:text-gray-400 mb-6 text-sm">
								適合需要大頻寬與客製化需求的專案
							</p>
							<div class="flex items-baseline gap-2 mb-8">
								<span class="text-4xl font-extrabold text-gray-900 dark:text-white">聯繫客服</span>
							</div>
							<ul class="space-y-4 mb-8 flex-1">
								<li class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
									<UIcon
										name="i-heroicons-check"
										class="w-5 h-5 text-gray-400 shrink-0"
									/>
									自訂隧道數量與資源上限
								</li>
								<li class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
									<UIcon
										name="i-heroicons-check"
										class="w-5 h-5 text-gray-400 shrink-0"
									/>
									解除限速，大頻寬連線保證
								</li>
								<li class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
									<UIcon
										name="i-heroicons-check"
										class="w-5 h-5 text-gray-400 shrink-0"
									/>
									客製化網路架構諮詢與整合建議
								</li>
								<li class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
									<UIcon
										name="i-heroicons-check"
										class="w-5 h-5 text-gray-400 shrink-0"
									/>
									優先處理的專屬技術支援
								</li>
							</ul>
							<UButton
								label="聯繫客服"
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
									擁抱開源，安全透明
								</h2>
								<p class="text-gray-300 text-lg mb-8 leading-relaxed">
									我們深知安全與信任的重要性。我們的核心元件遵循 MIT 與 Apache-2.0 開源協議託管於 GitHub，讓每一行程式碼都公開透明、經得起社群檢視，並隨時歡迎參與貢獻。
								</p>
								<div class="flex gap-4">
									<UButton
										label="前往 GitHub"
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
							快速安裝連接器
						</h2>
						<p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
							支援 Linux, Windows, macOS 與 Docker。複製指令，快速完成部署。
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
									Linux / macOS 一鍵安裝腳本
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
									執行上述指令即可自動下載並安裝適合您系統架構的連接器。
								</p>
							</div>

							<div class="hidden md:block w-px h-32 bg-gray-200 dark:bg-gray-800" />
							<div class="md:hidden w-full h-px bg-gray-200 dark:bg-gray-800" />

							<div class="w-full md:w-2/5 flex flex-col items-center text-center">
								<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									其他平台與手動下載
								</h3>
								<p class="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
									需要 Windows 版本或想取得二進位檔？立即前往下載頁面。
								</p>
								<UButton
									label="前往下載頁面"
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
						加入社群，成為合作夥伴
					</h2>
					<p class="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
						TaiwanFRP 的運作仰賴每一位開發者的支持。我們歡迎您加入 Discord 進行技術交流與回報建議；<br class="hidden sm:block">
						同時，如果您有閒置的伺服器與頻寬資源，也誠摯邀請您申請成為「節點贊助夥伴」，與我們一同擴大服務網路！
					</p>

					<UButton
						label="加入 Discord 社群"
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
								<span class="text-sm font-semibold">Discord 群組</span>
							</a>
						</div>
					</div>
				</footer>
			</section>
		</div>
	</div>
</template>
