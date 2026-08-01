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

const { data: tunnels, pending: isTunnelsLoading } = useApiFetch<AppTunnel[]>('/api/v1/tunnels', {
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
	</div>
</template>
