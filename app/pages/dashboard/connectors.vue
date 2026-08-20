<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'dashboard',
})

interface AppConnector {
	id: string
	token_prefix: string
	tunnel_name: string
	os: string
	arch: string
	version: string
	status: 'online' | 'offline'
	last_seen: string
}

const columns: TableColumn<AppConnector>[] = [
	{ accessorKey: 'status', header: '狀態' },
	{ accessorKey: 'token_prefix', header: 'Token 前綴' },
	{ accessorKey: 'tunnel_name', header: '對應隧道' },
	{ id: 'device_info', header: '裝置資訊' },
	{ id: 'actions', header: '' },
]

const mockConnectors = ref<AppConnector[]>([
	{
		id: '1',
		token_prefix: 'twfrp_abc123',
		tunnel_name: 'Minecraft 伺服器',
		os: 'linux',
		arch: 'amd64',
		version: 'v1.0.2',
		status: 'online',
		last_seen: '剛剛',
	},
	{
		id: '2',
		token_prefix: 'twfrp_xyz789',
		tunnel_name: 'XAMPP',
		os: 'windows',
		arch: 'amd64',
		version: 'v1.0.1',
		status: 'offline',
		last_seen: '114514 分鐘前',
	},
	{
		id: '3',
		token_prefix: 'twfrp_qwe456',
		tunnel_name: '伺服器官網',
		os: 'darwin',
		arch: 'arm64',
		version: 'v1.0.2',
		status: 'online',
		last_seen: '剛剛',
	},
])

const searchQuery = ref('')
const isConnectorsLoading = ref(false)

const filteredConnectors = computed(() => {
	if (!searchQuery.value) return mockConnectors.value || []

	const query = searchQuery.value.toLowerCase()

	return (mockConnectors.value || []).filter(connector =>
		connector.tunnel_name.toLowerCase().includes(query)
		|| connector.token_prefix.toLowerCase().includes(query)
		|| connector.arch.toLowerCase().includes(query)
		|| connector.os.toLowerCase().includes(query),
	)
})

const isConfirmModalOpen = ref(false)
const isResetting = ref(false)
const connectorToReset = ref<AppConnector | null>(null)

const handleRegenerateToken = (connector: AppConnector) => {
	connectorToReset.value = connector
	isConfirmModalOpen.value = true
}

const confirmRegenerate = async () => {
	if (!connectorToReset.value) return

	isConfirmModalOpen.value = false
}
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<!-- 頁面標題 -->
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				連接器列表
			</h1>

			<!-- 搜尋輸入框 -->
			<div class="w-full sm:w-72">
				<UInput
					v-model="searchQuery"
					icon="i-heroicons-magnifying-glass"
					placeholder="搜尋設備、隧道或 Token..."
					size="md"
				>
					<!-- 如果有輸入文字就顯示清除按鈕 -->
					<template
						v-if="searchQuery"
						#trailing
					>
						<UButton
							color="neutral"
							variant="link"
							icon="i-heroicons-x-mark-20-solid"
							:padded="false"
							@click="searchQuery = ''"
						/>
					</template>
				</UInput>
			</div>
		</div>

		<!-- 連接器表格卡片 -->
		<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
			<UTable
				:data="filteredConnectors"
				:columns="columns"
				:loading="isConnectorsLoading"
				class="text-base [&_th]:text-center! [&_td]:text-center!"
			>
				<!-- 連接器狀態 -->
				<template #status-cell="{ row }">
					<div class="flex flex-col items-center justify-center">
						<div class="flex items-center gap-2">
							<span class="relative flex h-3 w-3">
								<span
									v-if="row.original.status === 'online'"
									class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
								/>
								<span
									class="relative inline-flex rounded-full h-3 w-3"
									:class="row.original.status === 'online' ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'"
								/>
							</span>
							<span :class="row.original.status === 'online' ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500'">
								{{ row.original.status === 'online' ? '上線' : '離線' }}
							</span>
						</div>
						<!-- 如果離線則顯示最後連線時間 -->
						<div
							v-if="row.original.status === 'offline'"
							class="text-xs text-gray-400 mt-1"
						>
							最後連線: {{ row.original.last_seen }}
						</div>
					</div>
				</template>

				<!-- Token 前綴 -->
				<template #token_prefix-cell="{ row }">
					<span class="text-base text-gray-600 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md">
						{{ row.original.token_prefix }}......
					</span>
				</template>

				<!-- 對應隧道 -->
				<template #tunnel_name-cell="{ row }">
					<div class="flex flex-col items-center justify-center">
						<span class="text-base font-semibold text-gray-900 dark:text-white">
							{{ row.original.tunnel_name }}
						</span>
					</div>
				</template>

				<!-- 裝置資訊 (OS + Arch + Version) -->
				<template #device_info-cell="{ row }">
					<div class="flex flex-col items-center justify-center gap-1">
						<div class="flex items-center gap-1.5">
							<UIcon
								v-if="row.original.os === 'windows'"
								name="i-heroicons-window"
								class="w-4 h-4 text-blue-500"
							/>
							<UIcon
								v-else-if="row.original.os === 'darwin'"
								name="i-heroicons-computer-desktop"
								class="w-4 h-4 text-gray-700 dark:text-gray-300"
							/>
							<UIcon
								v-else
								name="i-heroicons-command-line"
								class="w-4 h-4 text-orange-500"
							/>

							<span class="text-base font-medium capitalize text-gray-700 dark:text-gray-300">{{ row.original.os }}</span>
							<span class="text-sm text-gray-500 dark:text-gray-400">({{ row.original.arch }})</span>
						</div>
						<span class="text-xs text-gray-400 font-mono">Agent {{ row.original.version }}</span>
					</div>
				</template>

				<!-- 操作按鈕 -->
				<template #actions-cell="{ row }">
					<div class="flex items-center justify-center">
						<UButton
							color="warning"
							variant="ghost"
							icon="i-heroicons-arrow-path-rounded-square"
							size="lg"
							title="重新產生 Token (將導致現有連接器斷線)"
							@click="handleRegenerateToken(row.original)"
						/>
					</div>
				</template>

				<!-- 空狀態 -->
				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<UIcon
							name="i-heroicons-server-stack"
							class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						/>
						<span class="text-base font-medium text-gray-900 dark:text-white">
							{{ searchQuery ? '找不到符合的連接器' : '目前沒有任何連線中的連接器' }}
						</span>
						<span
							v-if="searchQuery"
							class="text-sm text-gray-500 mt-1"
						>
							請嘗試使用不同的關鍵字搜尋
						</span>
					</div>
				</template>
			</UTable>
		</UCard>

		<!-- 確認重置對話框 -->
		<div
			v-if="isConfirmModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isConfirmModalOpen = false"
		>
			<UCard class="w-full max-w-lg shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white flex items-center gap-2">
							<UIcon
								name="i-heroicons-exclamation-triangle"
								class="w-5 h-5 text-warning-500"
							/>
							重新產生 Agent Token
						</h3>
						<UButton
							color="neutral"
							variant="ghost"
							icon="i-heroicons-x-mark-20-solid"
							class="-my-1"
							@click="isConfirmModalOpen = false"
						/>
					</div>
				</template>

				<div class="py-2">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						確定要為隧道 <span class="font-bold text-gray-900 dark:text-white">{{ connectorToReset?.tunnel_name }}</span> 重新產生 Token 嗎？
						<br><br>
						<span class="text-warning-600 dark:text-warning-500 font-medium">注意：此操作將會導致使用舊 Token 的連接器斷線。</span>
					</p>
				</div>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							label="取消"
							:disabled="isResetting"
							@click="isConfirmModalOpen = false"
						/>
						<UButton
							color="warning"
							label="確認重置"
							:loading="isResetting"
							@click="confirmRegenerate"
						/>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
