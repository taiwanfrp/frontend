<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'dashboard',
})

interface _AppConnector {
	id: string
	token_prefix: string
	tunnel_name: string
	os: string
	arch: string
	version: string
	status: 'online' | 'offline'
	last_seen: string
}

interface AppTunnel {
	id: string
	name: string
	description: string | null
	node_id: number
	protocol: string
	local_ip: string
	local_port: number
	remote_port: number | null
	custom_domain: string | null
	is_kcp_enabled: boolean
	is_proxy_protocol_v2_enabled: boolean
	is_enabled: boolean
	status: string
	token_prefix: string
	created_at: string
	updated_at: string
}

const toast = useToast()
const config = useRuntimeConfig()

const columns: TableColumn<AppTunnel>[] = [
	{ id: 'connection_status', header: '狀態' },
	{ accessorKey: 'token_prefix', header: 'Token 前綴' },
	{ accessorKey: 'name', header: '對應隧道' },
	{ id: 'device_info', header: '裝置資訊' },
	{ id: 'actions', header: '' },
]

const { data: tunnels, pending: isTunnelsLoading, refresh: refreshTunnels } = useApiFetch<AppTunnel[]>('/api/v1/tunnels', {
	server: false,
	lazy: true,
	default: () => [],
})

const searchQuery = ref('')

const filteredTunnels = computed(() => {
	if (!searchQuery.value) return tunnels.value || []

	const query = searchQuery.value.toLowerCase()

	return (tunnels.value || []).filter(tunnel =>
		tunnel.name.toLowerCase().includes(query)
		|| (tunnel.token_prefix && tunnel.token_prefix.toLowerCase().includes(query)),
	)
})

const isConfirmModalOpen = ref(false)
const isResetting = ref(false)
const tunnelToReset = ref<AppTunnel | null>(null)

const isSuccessModalOpen = ref(false)
const newlyCreatedToken = ref('')
const isCopied = ref(false)

const handleRegenerateToken = (tunnel: AppTunnel) => {
	tunnelToReset.value = tunnel
	isConfirmModalOpen.value = true
}

const confirmRegenerate = async () => {
	if (!tunnelToReset.value) return

	isResetting.value = true
	try {
		const response = await $fetch<{ agent_token: string }>(`/api/v1/tunnels/${tunnelToReset.value.id}/reset-token`, {
			method: 'POST',
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
		})

		isConfirmModalOpen.value = false
		newlyCreatedToken.value = response.agent_token
		isSuccessModalOpen.value = true

		refreshTunnels()
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		toast.add({
			title: '重置失敗',
			description: err.data?.detail || '無法重新產生 Token，請稍後再試。',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		})
	}
	finally {
		isResetting.value = false
	}
}

const copyToken = async () => {
	try {
		await navigator.clipboard.writeText(newlyCreatedToken.value)
		isCopied.value = true
		setTimeout(() => {
			isCopied.value = false
		}, 2000)
	}
	catch {
		toast.add({ title: '複製失敗，請手動選取', color: 'error' })
	}
}

const closeSuccessModal = () => {
	isSuccessModalOpen.value = false
	newlyCreatedToken.value = ''
	tunnelToReset.value = null
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
				:data="filteredTunnels"
				:columns="columns"
				:loading="isTunnelsLoading"
				class="text-base [&_th]:text-center! [&_td]:text-center!"
			>
				<template #connection_status-cell>
					<div class="flex flex-col items-center justify-center">
						<div class="flex items-center gap-2">
							<span class="relative inline-flex rounded-full h-3 w-3 bg-gray-300 dark:bg-gray-700" />
							<span class="text-gray-400 dark:text-gray-500 font-medium">
								尚無資料
							</span>
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
				<template #name-cell="{ row }">
					<div class="flex flex-col items-center justify-center">
						<span class="text-base font-semibold text-gray-900 dark:text-white">
							{{ row.original.name }}
						</span>
					</div>
				</template>

				<template #device_info-cell>
					<div class="flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-600">
						<span class="text-sm">等待連線...</span>
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
							{{ searchQuery ? '找不到符合的連接器' : '目前沒有任何隧道資料' }}
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
						確定要為隧道 <span class="font-bold text-gray-900 dark:text-white">{{ tunnelToReset?.name }}</span> 重新產生 Token 嗎？
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

		<!-- Token 重置成功對話框 -->
		<div
			v-if="isSuccessModalOpen"
			class="fixed inset-0 z-110 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="closeSuccessModal"
		>
			<UCard class="w-full max-w-lg shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800 flex flex-col max-h-[90vh]">
				<template #header>
					<div class="flex items-center gap-2">
						<UIcon
							name="i-heroicons-check-circle"
							class="w-6 h-6 text-green-500"
						/>
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							Agent Token 重置成功
						</h3>
					</div>
				</template>

				<div class="py-2 space-y-4 overflow-y-auto px-1">
					<UAlert
						color="warning"
						variant="soft"
						icon="i-heroicons-exclamation-triangle"
						title="請立即複製您的新 Token！"
						description="基於安全考量，這將是您唯一一次能看見完整 Token 的機會。請在您的連接器設備上使用此 Token 重新啟動服務。"
					/>

					<div class="group relative flex items-center justify-between bg-gray-900 text-gray-300 font-mono text-sm sm:text-base rounded-xl p-4 overflow-hidden">
						<div class="truncate mr-4 overflow-x-auto whitespace-nowrap hide-scrollbar select-all">
							{{ newlyCreatedToken }}
						</div>
						<UButton
							:icon="isCopied ? 'i-heroicons-check-circle' : 'i-heroicons-clipboard-document'"
							:color="isCopied ? 'primary' : 'neutral'"
							variant="ghost"
							class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all bg-gray-800/80 hover:bg-gray-700"
							aria-label="複製 Token"
							title="複製 Token"
							@click="copyToken"
						/>
					</div>
				</div>

				<template #footer>
					<div class="flex justify-end">
						<UButton
							color="primary"
							label="我已妥善保存，關閉視窗"
							@click="closeSuccessModal"
						/>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
