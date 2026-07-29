<script setup lang="ts">
import { computed } from 'vue'
import {
	Chart as ChartJS,
	Title,
	Tooltip,
	Legend,
	BarElement,
	CategoryScale,
	LinearScale,
	LineElement,
	PointElement,
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'

definePageMeta({
	layout: 'dashboard',
})

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend)

interface Tunnel {
	id: string
	name: string
	description: string
	node_id: number
	protocol: string
	local_ip: string
	local_port: number
	remote_port: number
	is_kcp_enabled: boolean
	is_proxy_protocol_v2_enabled: boolean
	is_enabled: boolean
	status: string
	created_at: string
	updated_at: string
}

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const config = useRuntimeConfig()
const { user } = useAuth()

const { data: tunnels, pending: isTunnelsLoading } = useFetch<Tunnel[]>(`${config.public.apiUrl}/api/v1/tunnels`, {
	credentials: 'include',
	server: false,
	lazy: true,
	default: () => [],
})

// 計算隧道數量與配額
const currentTunnelsCount = computed(() => tunnels.value?.length || 0)
const maxTunnels = computed(() => user.value?.limits?.max_tunnels || 0)

const chartOptions = computed(() => {
	const textColor = isDark.value ? '#E5E7EB' : '#374151'
	const gridColor = isDark.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'

	return {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: 'top' as const,
				labels: { color: textColor, font: { family: 'sans-serif', size: 13 } },
			},
			tooltip: {
				mode: 'index' as const,
				intersect: false,
			},
		},
		scales: {
			x: { ticks: { color: textColor }, grid: { display: false } },
			y: { ticks: { color: textColor }, grid: { color: gridColor } },
		},
		interaction: {
			mode: 'nearest' as const,
			axis: 'x' as const,
			intersect: false,
		},
	}
})

// 動態產生近 7 天的日期 (MM/DD)
const last7DaysLabels = Array.from({ length: 7 }).map((_, i) => {
	const d = new Date()
	// 從 6 天前開始到今天 (0 天前)
	d.setDate(d.getDate() - (6 - i))
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${month}/${day}`
})

// 歷史網路用量 (GB) (demo)
const networkUsageData = computed(() => ({
	labels: last7DaysLabels,
	datasets: [
		{
			label: 'Web 伺服器',
			backgroundColor: 'rgba(14, 165, 233, 0.8)', // Sky
			data: [1.2, 2.5, 1.8, 3.2, 4.1, 5.5, 4.2],
		},
		{
			label: 'Minecraft',
			backgroundColor: 'rgba(139, 92, 246, 0.8)', // Violet
			data: [5.5, 8.2, 10.1, 7.8, 12.3, 15.6, 14.1],
		},
		{
			label: 'SSH',
			backgroundColor: 'rgba(34, 197, 94, 0.8)', // Green
			data: [0.1, 0.2, 0.1, 0.3, 0.5, 0.2, 0.1],
		},
	],
}))

// 歷史連線數 (次) (demo)
const connectionsData = computed(() => ({
	labels: last7DaysLabels,
	datasets: [
		{
			label: 'Web 伺服器',
			borderColor: 'rgba(14, 165, 233, 1)',
			backgroundColor: 'rgba(14, 165, 233, 0.2)',
			tension: 0.4, // 曲線平滑度
			data: [150, 230, 180, 320, 410, 550, 420],
		},
		{
			label: 'Minecraft',
			borderColor: 'rgba(139, 92, 246, 1)',
			backgroundColor: 'rgba(139, 92, 246, 0.2)',
			tension: 0.4,
			data: [25, 45, 60, 55, 80, 110, 95],
		},
		{
			label: 'SSH',
			borderColor: 'rgba(34, 197, 94, 1)',
			backgroundColor: 'rgba(34, 197, 94, 0.2)',
			tension: 0.4,
			data: [2, 5, 3, 8, 12, 4, 2],
		},
	],
}))
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<!-- 頁面標頭與總覽卡片 -->
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
				概覽
			</h1>

			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<!-- 隧道數量 -->
				<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
					<div class="flex items-center gap-4">
						<div class="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-lg text-primary-600 dark:text-primary-400">
							<UIcon
								name="i-heroicons-arrows-right-left"
								class="w-6 h-6"
							/>
						</div>
						<div class="flex-1">
							<p class="text-sm font-medium text-gray-500 dark:text-gray-400">
								已建立隧道數量
							</p>
							<div class="flex items-end justify-between mt-1">
								<!-- 保留數字高度避免跳動 -->
								<div
									v-if="isTunnelsLoading || !user"
									class="h-8 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"
								/>
								<h3
									v-else
									class="text-2xl font-bold text-gray-900 dark:text-white"
								>
									{{ currentTunnelsCount }} <span class="text-lg font-normal text-gray-500">/ {{ maxTunnels }}</span>
								</h3>
							</div>
						</div>
					</div>

					<!-- 載入動畫 -->
					<div
						v-if="isTunnelsLoading || !user"
						class="mt-4"
					>
						<UProgress
							color="primary"
							size="sm"
						/>
					</div>
				</UCard>
			</div>
		</div>

		<!-- 圖表 -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
			<!-- 網路用量 -->
			<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50 flex flex-col">
				<template #header>
					<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white flex items-center gap-2">
						<UIcon
							name="i-heroicons-chart-bar"
							class="w-5 h-5 text-sky-500"
						/>
						歷史網路用量 (7日)
					</h3>
				</template>
				<div class="relative h-72 w-full">
					<ClientOnly>
						<Bar
							:data="networkUsageData"
							:options="chartOptions"
						/>
						<template #fallback>
							<div class="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800/20 rounded animate-pulse" />
						</template>
					</ClientOnly>
				</div>
			</UCard>

			<!-- 連線數 -->
			<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50 flex flex-col">
				<template #header>
					<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white flex items-center gap-2">
						<UIcon
							name="i-heroicons-bolt"
							class="w-5 h-5 text-purple-500"
						/>
						歷史連線數 (7日)
					</h3>
				</template>
				<div class="relative h-72 w-full">
					<ClientOnly>
						<Line
							:data="connectionsData"
							:options="chartOptions"
						/>
						<template #fallback>
							<div class="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800/20 rounded animate-pulse" />
						</template>
					</ClientOnly>
				</div>
			</UCard>
		</div>
	</div>
</template>
