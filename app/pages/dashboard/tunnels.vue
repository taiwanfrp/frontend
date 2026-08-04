<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
	layout: 'dashboard',
})

interface AppNode {
	id: number
	name: string
	description: string | null
	host: string
	port_start: number
	port_end: number
	status: string
	is_public: boolean
}

interface AppTunnel {
	id: string
	name: string
	description: string | null
	node_id: number
	protocol: string // tcp, udp, http, https, tcpmux, stcp, sudp
	local_ip: string
	local_port: number
	remote_port: number | null
	custom_domain: string | null
	is_kcp_enabled: boolean
	is_proxy_protocol_v2_enabled: boolean
	is_enabled: boolean // 使用者自行控制
	status: string // 管理員控制 (active, disabled)
	created_at: string
	updated_at: string
}

const toast = useToast()

const { data: tunnels, pending: isTunnelsLoading, refresh: refreshTunnels } = useApiFetch<AppTunnel[]>('/api/v1/tunnels', {
	server: false,
	lazy: true,
	default: () => [],
})

const { data: nodes } = useApiFetch<AppNode[]>('/api/v1/nodes', {
	server: false,
	lazy: true,
	default: () => [],
})

const searchQuery = ref('')

const nodeMap = computed(() => {
	const map: Record<number, AppNode> = {}
	for (const node of (nodes.value || [])) {
		map[node.id] = node
	}
	return map
})

const filteredTunnels = computed(() => {
	if (!searchQuery.value) return tunnels.value || []

	const query = searchQuery.value.toLowerCase()

	return (tunnels.value || []).filter(tunnel =>
		tunnel.name.toLowerCase().includes(query)
		|| (tunnel.description && tunnel.description.toLowerCase().includes(query))
		|| tunnel.local_ip.toLowerCase().includes(query)
		|| (tunnel.custom_domain && tunnel.custom_domain.toLowerCase().includes(query)),
	)
})

// 新增隧道
const isAddModalOpen = ref(false)
const isAdding = ref(false)
const formErrorMessage = ref('')

const tunnelForm = ref({
	name: '',
	description: '',
	node_id: undefined as number | undefined,
	protocol: '',
	local_ip: '127.0.0.1',
	local_port: undefined as number | undefined,
	remote_port: undefined as number | undefined,
	is_kcp_enabled: true,
	is_proxy_protocol_v2_enabled: false,
})

// 協議選項
const protocolOptions = [
	{ label: 'TCP', value: 'tcp', disabled: false },
	{ label: 'UDP', value: 'udp', disabled: false },
	{ label: 'HTTP', value: 'http', disabled: true },
	{ label: 'HTTPS', value: 'https', disabled: true },
	{ label: 'TCPMUX', value: 'tcpmux', disabled: true },
	{ label: 'STCP', value: 'stcp', disabled: true },
	{ label: 'SUDP', value: 'sudp', disabled: true },
]

const nodeItems = computed(() => {
	return (nodes.value || []).map(node => ({
		label: node.name,
		value: node.id,
	}))
})

const remotePortPlaceholder = computed(() => {
	if (!tunnelForm.value.node_id) return '請先選擇上方節點'
	const node = nodeMap.value[tunnelForm.value.node_id]
	return node ? `範圍：${node.port_start} - ${node.port_end}` : '請輸入遠端 Port'
})

const generateRandomPort = () => {
	formErrorMessage.value = ''
	if (!tunnelForm.value.node_id) {
		formErrorMessage.value = '請先選擇節點'
		return
	}
	const node = nodeMap.value[tunnelForm.value.node_id]
	if (node) {
		const start = node.port_start
		const end = node.port_end
		tunnelForm.value.remote_port = Math.floor(Math.random() * (end - start + 1)) + start
	}
}

const enforceLocalPortRange = () => {
	if (!tunnelForm.value.local_port) return

	if (tunnelForm.value.local_port < 1) {
		tunnelForm.value.local_port = 1
		formErrorMessage.value = 'Port 不可小於 1'
	}
	else if (tunnelForm.value.local_port > 65535) {
		tunnelForm.value.local_port = 65535
		formErrorMessage.value = 'Port 不可大於 65535'
	}
	else if (formErrorMessage.value.includes('本地 Port')) {
		formErrorMessage.value = ''
	}
}

const enforcePortRange = () => {
	if (!tunnelForm.value.node_id || !tunnelForm.value.remote_port) return

	const node = nodeMap.value[tunnelForm.value.node_id]
	if (node) {
		if (tunnelForm.value.remote_port < node.port_start) {
			tunnelForm.value.remote_port = node.port_start
			formErrorMessage.value = `已自動修正為該節點的最小 Port (${node.port_start})`
		}
		else if (tunnelForm.value.remote_port > node.port_end) {
			tunnelForm.value.remote_port = node.port_end
			formErrorMessage.value = `已自動修正為該節點的最大 Port (${node.port_end})`
		}
		else {
			formErrorMessage.value = ''
		}
	}
}

const confirmAdd = async () => {
	formErrorMessage.value = ''
	if (!tunnelForm.value.name) {
		formErrorMessage.value = '請填寫隧道名稱'
		return
	}
	if (!tunnelForm.value.node_id) {
		formErrorMessage.value = '請選擇節點'
		return
	}
	if (!tunnelForm.value.local_ip || !tunnelForm.value.local_port) {
		formErrorMessage.value = '請填寫本地端 IP 與 Port'
		return
	}
	if (tunnelForm.value.local_port < 1 || tunnelForm.value.local_port > 65535) {
		formErrorMessage.value = '本地 Port 必須介於 1 - 65535 之間'
		return
	}
	if (!tunnelForm.value.protocol) {
		formErrorMessage.value = '請選擇通訊協議'
		return
	}

	if (['tcp', 'udp'].includes(tunnelForm.value.protocol)) {
		if (!tunnelForm.value.remote_port) {
			formErrorMessage.value = 'TCP/UDP 協議需要指定遠端 Port'
			return
		}

		const node = nodeMap.value[tunnelForm.value.node_id]
		if (node && (tunnelForm.value.remote_port < node.port_start || tunnelForm.value.remote_port > node.port_end)) {
			formErrorMessage.value = `遠端 Port 必須介於 ${node.port_start} - ${node.port_end} 之間`
			return
		}
	}

	isAdding.value = true
	const config = useRuntimeConfig()

	try {
		await $fetch('/api/v1/tunnels', {
			method: 'POST',
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
			body: {
				name: tunnelForm.value.name,
				description: tunnelForm.value.description || null,
				node_id: tunnelForm.value.node_id,
				protocol: tunnelForm.value.protocol,
				local_ip: tunnelForm.value.local_ip,
				local_port: tunnelForm.value.local_port,
				remote_port: tunnelForm.value.remote_port || null,
				is_kcp_enabled: tunnelForm.value.is_kcp_enabled,
				is_proxy_protocol_v2_enabled: tunnelForm.value.is_proxy_protocol_v2_enabled,
			},
		})

		toast.add({
			title: '新增成功',
			description: `隧道 ${tunnelForm.value.name} 已成功建立。`,
			color: 'success',
			icon: 'i-heroicons-check-circle',
		})

		isAddModalOpen.value = false
		refreshTunnels()

		tunnelForm.value = {
			name: '',
			description: '',
			node_id: undefined,
			protocol: '',
			local_ip: '127.0.0.1',
			local_port: undefined,
			remote_port: undefined,
			is_kcp_enabled: true,
			is_proxy_protocol_v2_enabled: false,
		}
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		let errorMsg = '無法建立隧道，請檢查輸入資料或稍後再試。'

		if (err.data && err.data.detail) {
			const detail = err.data.detail

			if (typeof detail === 'string') {
				if (detail.includes('maximum tunnel limit')) {
					errorMsg = '您已達到最大隧道數量限制，無法建立更多隧道。'
				}
				else if (detail.includes('remote_port is already in use')) {
					errorMsg = '該遠端 Port 已經被佔用，請嘗試使用其他數字或點擊隨機產生。'
				}
				else if (detail.includes('remote_port must be between')) {
					errorMsg = '遠端 Port 超出該節點允許的範圍。'
				}
				else {
					errorMsg = detail
				}
			}
			else if (Array.isArray(detail)) {
				errorMsg = '欄位格式錯誤，請檢查您的輸入。'
			}
		}
		formErrorMessage.value = errorMsg
	}
	finally {
		isAdding.value = false
	}
}

// 刪除隧道
const isDeleteModalOpen = ref(false)
const tunnelToDelete = ref<AppTunnel | null>(null)
const isDeleting = ref(false)

const openDeleteModal = (tunnel: AppTunnel) => {
	tunnelToDelete.value = tunnel
	isDeleteModalOpen.value = true
}

const confirmDelete = async () => {
	if (!tunnelToDelete.value) return

	isDeleting.value = true
	const config = useRuntimeConfig()

	try {
		await $fetch(`/api/v1/tunnels/${tunnelToDelete.value.id}`, {
			method: 'DELETE',
			baseURL: config.public.apiUrl as string,
			credentials: 'include',
		})

		toast.add({
			title: '刪除成功',
			description: `隧道 ${tunnelToDelete.value.name} 已成功移除。`,
			color: 'success',
			icon: 'i-heroicons-check-circle',
		})

		// 關閉 Modal 並重新整理列表
		isDeleteModalOpen.value = false
		refreshTunnels()
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		toast.add({
			title: '刪除失敗',
			description: err.data?.detail || '無法刪除該隧道，請稍後再試。',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		})
	}
	finally {
		isDeleting.value = false
	}
}

const columns: TableColumn<AppTunnel>[] = [
	{ accessorKey: 'name', header: '隧道名稱' },
	{ accessorKey: 'node_id', header: '所屬節點' },
	{ accessorKey: 'protocol', header: '協議' },
	{ id: 'local', header: '本地端 (Local)' },
	{ id: 'remote', header: '遠端 (Remote)' },
	{ accessorKey: 'is_enabled', header: '啟用' },
	{ accessorKey: 'status', header: '審核狀態' },
	{ id: 'connection_status', header: '連線狀態' },
	{ id: 'actions', header: '' },
]

const protocolColors: Record<string, 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'> = {
	tcp: 'info',
	udp: 'warning',
	http: 'success',
	https: 'primary',
	tcpmux: 'info',
	stcp: 'neutral',
	sudp: 'neutral',
}
</script>

<template>
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
		<!-- 頁面標頭 -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				隧道列表
			</h1>

			<div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
				<!-- 新增隧道按鈕 -->
				<UButton
					icon="i-heroicons-plus"
					color="primary"
					label="新增隧道"
					size="md"
					class="w-full sm:w-auto justify-center"
					@click="isAddModalOpen = true"
				/>

				<!-- 搜尋輸入框 -->
				<div class="w-full sm:w-72">
					<UInput
						v-model="searchQuery"
						icon="i-heroicons-magnifying-glass"
						placeholder="搜尋名稱、IP 或網域..."
						size="md"
					>
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
		</div>

		<!-- 隧道表格卡片 -->
		<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
			<UTable
				:data="filteredTunnels"
				:columns="columns"
				:loading="isTunnelsLoading"
				class="text-base [&_th]:text-center! [&_td]:text-center!"
			>
				<!-- 名稱與描述 -->
				<template #name-cell="{ row }">
					<div class="flex flex-col items-center">
						<span class="text-base font-semibold text-gray-900 dark:text-white">{{ row.original.name }}</span>
						<span
							v-if="row.original.description"
							class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate max-w-xs"
						>
							{{ row.original.description }}
						</span>
					</div>
				</template>

				<!-- 懸浮顯示節點詳細資訊 -->
				<template #node_id-cell="{ row }">
					<UPopover mode="hover">
						<span class="font-medium text-gray-600 dark:text-gray-400 cursor-pointer border-gray-400 dark:border-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors pb-0.5">
							{{ nodeMap[row.original.node_id]?.name || `#${row.original.node_id}` }}
						</span>

						<!-- 浮動視窗內容 -->
						<template #content>
							<div
								v-if="nodeMap[row.original.node_id]"
								class="p-4 w-64 space-y-3 text-left"
							>
								<div class="border-b border-gray-200 dark:border-gray-700 pb-3">
									<div class="font-bold text-base text-gray-900 dark:text-white">
										{{ nodeMap[row.original.node_id]?.name }}
									</div>
									<div
										v-if="nodeMap[row.original.node_id]?.description"
										class="text-sm text-gray-500 dark:text-gray-400 mt-1"
									>
										{{ nodeMap[row.original.node_id]?.description }}
									</div>
								</div>

								<div class="flex justify-between items-center text-sm pt-1">
									<span class="text-gray-500 dark:text-gray-400">伺服器位址</span>
									<span class="font-mono text-gray-900 dark:text-white">
										{{ nodeMap[row.original.node_id]?.host }}
									</span>
								</div>

								<div class="flex justify-between items-center text-sm">
									<span class="text-gray-500 dark:text-gray-400">可用連接埠</span>
									<span class="font-mono text-gray-900 dark:text-white">
										{{ nodeMap[row.original.node_id]?.port_start }} - {{ nodeMap[row.original.node_id]?.port_end }}
									</span>
								</div>
							</div>

							<div
								v-else
								class="p-4 text-sm text-gray-500 text-center"
							>
								正在載入節點資訊或無權限查看
							</div>
						</template>
					</UPopover>
				</template>

				<!-- 協議 -->
				<template #protocol-cell="{ row }">
					<UBadge
						:color="protocolColors[row.original.protocol] || 'neutral'"
						variant="subtle"
						size="md"
						class="uppercase font-bold"
					>
						{{ row.original.protocol }}
					</UBadge>
				</template>

				<!-- 本地端 (Local IP : Port) -->
				<template #local-cell="{ row }">
					<span class="text-base text-gray-600 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md">
						{{ row.original.local_ip }}:{{ row.original.local_port }}
					</span>
				</template>

				<!-- 遠端 (Remote URL:Port 或 Custom Domain) -->
				<template #remote-cell="{ row }">
					<!-- HTTP/HTTPS 顯示自訂網域 -->
					<span
						v-if="['http', 'https'].includes(row.original.protocol) && row.original.custom_domain"
						class="text-base text-primary-600 dark:text-primary-400"
					>
						{{ row.original.custom_domain }}
					</span>
					<!-- TCP/UDP 顯示 節點主機:Port -->
					<span
						v-else-if="row.original.remote_port"
						class="text-base text-gray-600 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md"
					>
						<template v-if="nodeMap[row.original.node_id]?.host">
							{{ nodeMap[row.original.node_id]?.host }}:{{ row.original.remote_port }}
						</template>
						<template v-else>
							:{{ row.original.remote_port }}
						</template>
					</span>
					<span
						v-else
						class="text-gray-400"
					>-</span>
				</template>

				<!-- 用戶自訂啟用狀態 -->
				<template #is_enabled-cell="{ row }">
					<UBadge
						:color="row.original.is_enabled ? 'success' : 'neutral'"
						variant="subtle"
						size="md"
						class="flex justify-center w-20 mx-auto"
					>
						{{ row.original.is_enabled ? '執行中' : '已停止' }}
					</UBadge>
				</template>

				<!-- 系統管理員狀態 -->
				<template #status-cell="{ row }">
					<UBadge
						:color="row.original.status === 'active' ? 'success' : 'error'"
						:variant="row.original.status === 'active' ? 'subtle' : 'solid'"
						size="md"
						class="flex justify-center items-center gap-1 w-32 mx-auto"
					>
						<UIcon
							v-if="row.original.status !== 'active'"
							name="i-heroicons-lock-closed-16-solid"
							class="w-3.5 h-3.5"
						/>
						{{ row.original.status === 'active' ? '正常' : '已被管理員停用' }}
					</UBadge>
				</template>

				<!-- 連線狀態預留 -->
				<template #connection_status-cell>
					<span class="text-gray-400 dark:text-gray-500">-</span>
				</template>

				<template #actions-cell="{ row }">
					<div class="flex items-center justify-center gap-1">
						<UButton
							color="neutral"
							variant="ghost"
							icon="i-heroicons-pencil-square"
							size="lg"
							title="編輯隧道"
						/>
						<UButton
							color="error"
							variant="ghost"
							icon="i-heroicons-trash"
							size="lg"
							title="刪除隧道"
							@click="openDeleteModal(row.original)"
						/>
					</div>
				</template>

				<!-- 空狀態 -->
				<template #empty>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<UIcon
							name="i-heroicons-arrows-right-left"
							class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						/>
						<span class="text-base font-medium text-gray-900 dark:text-white">
							{{ searchQuery ? '找不到符合的隧道' : '您目前還沒有建立任何隧道' }}
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

		<!-- 刪除確認對話框 -->
		<div
			v-if="isDeleteModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isDeleteModalOpen = false"
		>
			<UCard class="w-full max-w-lg shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							刪除隧道
						</h3>
						<UButton
							color="neutral"
							variant="ghost"
							icon="i-heroicons-x-mark-20-solid"
							class="-my-1"
							@click="isDeleteModalOpen = false"
						/>
					</div>
				</template>

				<div class="py-2">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						確定要刪除隧道 <span class="font-bold text-gray-900 dark:text-white">{{ tunnelToDelete?.name }}</span> 嗎？
						<br><br>
						<span class="text-red-500 font-medium">注意：此操作無法復原，與該隧道相關的所有連線隨後將被中斷。</span>
					</p>
				</div>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							label="取消"
							:disabled="isDeleting"
							@click="isDeleteModalOpen = false"
						/>
						<UButton
							color="error"
							label="確認刪除"
							:loading="isDeleting"
							@click="confirmDelete"
						/>
					</div>
				</template>
			</UCard>
		</div>

		<!-- 新增隧道對話框 -->
		<div
			v-if="isAddModalOpen"
			class="fixed inset-0 z-100 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 transition-opacity"
			@click.self="isAddModalOpen = false"
		>
			<UCard
				class="w-full max-w-2xl shadow-2xl ring-1 ring-gray-200/50 dark:ring-gray-800/50 divide-y divide-gray-100 dark:divide-gray-800 flex flex-col max-h-[90vh]"
			>
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							新增隧道
						</h3>
						<UButton
							color="neutral"
							variant="ghost"
							icon="i-heroicons-x-mark-20-solid"
							class="-my-1"
							@click="isAddModalOpen = false"
						/>
					</div>
				</template>

				<!-- 表單內容 -->
				<div class="py-2 space-y-5 overflow-y-auto px-1">
					<UAlert
						v-if="formErrorMessage"
						color="error"
						variant="soft"
						icon="i-heroicons-exclamation-triangle"
						:title="formErrorMessage"
					/>

					<!-- 名稱與描述 -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">隧道名稱 <span class="text-red-500">*</span></label>
							<UInput
								v-model="tunnelForm.name"
								placeholder="例如：我的 Minecraft 伺服器"
							/>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">描述 (選填)</label>
							<UInput
								v-model="tunnelForm.description"
								placeholder="簡單描述這個隧道的用途"
							/>
						</div>
					</div>

					<div class="border-t border-gray-100 dark:border-gray-800" />

					<!-- 節點與協議 -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">選擇節點 <span class="text-red-500">*</span></label>
							<USelect
								v-model="tunnelForm.node_id"
								:items="nodeItems"
								placeholder="請選擇可用節點"
							/>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">通訊協議 <span class="text-red-500">*</span></label>
							<USelect
								v-model="tunnelForm.protocol"
								:items="protocolOptions"
								placeholder="請選擇協議"
							/>
						</div>
					</div>

					<!-- 本地端設定 -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">本地 IP <span class="text-red-500">*</span></label>
							<UInput
								v-model="tunnelForm.local_ip"
								placeholder="例如：127.0.0.1"
							/>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">本地 Port <span class="text-red-500">*</span></label>
							<UInput
								v-model="tunnelForm.local_port"
								type="number"
								placeholder="例如：25565"
								@blur="enforceLocalPortRange"
							/>
						</div>
					</div>

					<!-- 遠端 Port -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">遠端 Port <span class="text-red-500">*</span></label>
							<div class="flex gap-2">
								<UInput
									v-model="tunnelForm.remote_port"
									type="number"
									:placeholder="remotePortPlaceholder"
									:disabled="!tunnelForm.node_id"
									class="flex-1"
									@blur="enforcePortRange"
								/>
								<UButton
									color="neutral"
									variant="soft"
									icon="i-heroicons-sparkles"
									label="隨機"
									:disabled="!tunnelForm.node_id"
									@click="generateRandomPort"
								/>
							</div>
						</div>
					</div>

					<div class="border-t border-gray-100 dark:border-gray-800" />

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="flex flex-col justify-center space-y-1">
							<UCheckbox
								v-model="tunnelForm.is_kcp_enabled"
								label="啟用 KCP 加速傳輸"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400 pl-6">
								適用於不穩定網路，能有效降低延遲
							</p>
						</div>
						<div class="flex flex-col justify-center space-y-1">
							<UCheckbox
								v-model="tunnelForm.is_proxy_protocol_v2_enabled"
								label="啟用 Proxy Protocol v2"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400 pl-6">
								將訪客真實 IP 傳遞給後端 (若不確定，請勿啟用)
							</p>
						</div>
					</div>
				</div>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="neutral"
							variant="ghost"
							label="取消"
							:disabled="isAdding"
							@click="isAddModalOpen = false"
						/>
						<UButton
							color="primary"
							label="確認新增"
							:loading="isAdding"
							@click="confirmAdd"
						/>
					</div>
				</template>
			</UCard>
		</div>
	</div>
</template>
