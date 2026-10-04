export type TicketStatus = 'open' | 'claimed' | 'closed'
export type TicketMessageSource = 'web' | 'discord' | 'system'

export interface TicketUser {
	discord_id: string
	username: string
	avatar: string | null
}

export interface TicketCategory {
	id: string
	name: string
	description: string
}

export interface Ticket {
	id: number
	subject: string
	status: TicketStatus
	category: TicketCategory
	opener: TicketUser
	assignee: TicketUser | null
	discord_channel_url: string | null
	created_at: string
	last_activity_at: string
	closed_at: string | null
}

export interface TicketMessage {
	id: string
	author: TicketUser | null
	is_staff: boolean
	source: TicketMessageSource
	content: string
	created_at: string
}

export interface TicketDetail extends Ticket {
	messages: TicketMessage[]
}

export const TICKET_STATUS = {
	open: { color: 'warning', icon: 'i-heroicons-clock' },
	claimed: { color: 'info', icon: 'i-heroicons-user' },
	closed: { color: 'neutral', icon: 'i-heroicons-lock-closed' },
} as const

// 分類由後端提供, 前端依 id 翻譯, 不認得的 id (例如後端新增的分類) 直接顯示後端給的文字
export const useTicketCategoryText = () => {
	const { t } = useI18n()

	const texts = computed<Record<string, { name: string, description: string }>>(() => ({
		account: { name: t('tickets.categories.account.name'), description: t('tickets.categories.account.description') },
		tunnel: { name: t('tickets.categories.tunnel.name'), description: t('tickets.categories.tunnel.description') },
		quota: { name: t('tickets.categories.quota.name'), description: t('tickets.categories.quota.description') },
		other: { name: t('tickets.categories.other.name'), description: t('tickets.categories.other.description') },
	}))

	const categoryName = (category: TicketCategory) => texts.value[category.id]?.name ?? category.name
	const categoryDescription = (category: TicketCategory) => texts.value[category.id]?.description ?? category.description

	return { categoryName, categoryDescription }
}

// 依目前語系顯示, 在 template 中呼叫時切換語系會自動重新渲染
export const formatRelativeTime = (iso: string) => {
	const { locale, t } = useNuxtApp().$i18n
	const diffSeconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		['day', 86400],
		['hour', 3600],
		['minute', 60],
	]
	const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
	for (const [unit, seconds] of units) {
		if (Math.abs(diffSeconds) >= seconds) {
			return rtf.format(Math.round(diffSeconds / seconds), unit)
		}
	}
	return t('tickets.time.just_now')
}

export const formatDateTime = (iso: string) => {
	return new Date(iso).toLocaleString(useNuxtApp().$i18n.locale.value, {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})
}

// fake data for demo

const MOCK_CATEGORIES: TicketCategory[] = [
	{ id: 'account', name: '帳號問題', description: '登入、綁定、帳號狀態等問題' },
	{ id: 'tunnel', name: '隧道 / 節點', description: '隧道無法連線、節點異常、延遲過高' },
	{ id: 'quota', name: '額度申請', description: '申請更多隧道數量或頻寬' },
	{ id: 'other', name: '其他', description: '建議回饋、檢舉或其他問題' },
]

const MOCK_STAFF: TicketUser = { discord_id: '1', username: 'TaiwanFRP 客服', avatar: null }
const MOCK_OPENER: TicketUser = { discord_id: '0', username: 'demo_user', avatar: null }

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600 * 1000).toISOString()
const unixHoursAgo = (hours: number) => Math.floor(Date.now() / 1000 - hours * 3600)

const createMockTickets = (): TicketDetail[] => [
	{
		id: 1042,
		subject: 'Minecraft 隧道連線一直逾時',
		status: 'claimed',
		category: MOCK_CATEGORIES[1]!,
		opener: MOCK_OPENER,
		assignee: MOCK_STAFF,
		discord_channel_url: '#',
		created_at: hoursAgo(26),
		last_activity_at: hoursAgo(2),
		closed_at: null,
		messages: [
			{ id: 'm1', author: MOCK_OPENER, is_staff: false, source: 'web', content: '我的 Minecraft 伺服器用 TCP 隧道開在 25565，朋友連線都會顯示 Timed out。\n本機連 127.0.0.1:25565 是正常的。', created_at: hoursAgo(26) },
			{ id: 'm2', author: null, is_staff: false, source: 'system', content: 'TaiwanFRP 客服 已認領此工單', created_at: hoursAgo(25) },
			{ id: 'm3', author: MOCK_STAFF, is_staff: true, source: 'discord', content: `您好，請問連接器的日誌有出現 \`login to server success\` 嗎？另外麻煩提供一下隧道名稱。\n-# 節點將於 <t:${unixHoursAgo(-20)}:F>（<t:${unixHoursAgo(-20)}:R>）進行例行維護`, created_at: hoursAgo(25) },
			{ id: 'm4', author: MOCK_OPENER, is_staff: false, source: 'discord', content: '> 請問連接器的日誌有出現 `login to server success` 嗎？\n有顯示 **success**，隧道名稱是 `mc-survival`\n```\n[I] [service.go:301] login to server success\n```\n設定檔如下：\n```toml\nserverAddr = "tw1.taiwanfrp.me"\nserverPort = 7000\n\n[[proxies]]\nname = "mc-survival"\ntype = "tcp"\nlocalPort = 25565 # Minecraft 預設埠\n```', created_at: hoursAgo(2) },
		],
	},
	{
		id: 1038,
		subject: '申請增加隧道數量',
		status: 'open',
		category: MOCK_CATEGORIES[2]!,
		opener: MOCK_OPENER,
		assignee: null,
		discord_channel_url: '#',
		created_at: hoursAgo(50),
		last_activity_at: hoursAgo(50),
		closed_at: null,
		messages: [
			{ id: 'm1', author: MOCK_OPENER, is_staff: false, source: 'web', content: '目前額度 3 個隧道不夠用，想申請到 5 個，用途是社團的遊戲伺服器。', created_at: hoursAgo(50) },
		],
	},
	{
		id: 1001,
		subject: 'Discord 帳號綁定錯誤',
		status: 'closed',
		category: MOCK_CATEGORIES[0]!,
		opener: MOCK_OPENER,
		assignee: MOCK_STAFF,
		discord_channel_url: null,
		created_at: hoursAgo(240),
		last_activity_at: hoursAgo(200),
		closed_at: hoursAgo(200),
		messages: [
			{ id: 'm1', author: MOCK_OPENER, is_staff: false, source: 'web', content: '登入後顯示的是我另一個 Discord 帳號。', created_at: hoursAgo(240) },
			{ id: 'm2', author: MOCK_STAFF, is_staff: true, source: 'discord', content: '請先到 Discord 登出另一個帳號後再重新登入即可。', created_at: hoursAgo(230) },
			{ id: 'm3', author: null, is_staff: false, source: 'system', content: '工單已關閉', created_at: hoursAgo(200) },
		],
	},
]

const mockDelay = () => new Promise(resolve => setTimeout(resolve, 300))

// 不用 crypto.randomUUID(), 它只在 HTTPS 或 localhost 下存在, 用區網 IP 開啟時會是 undefined
const mockMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

export const useTickets = () => {
	const tickets = useState<TicketDetail[]>('tickets_mock', createMockTickets)

	const listCategories = async (): Promise<TicketCategory[]> => {
		await mockDelay()
		return MOCK_CATEGORIES
	}

	const listTickets = async (): Promise<Ticket[]> => {
		await mockDelay()
		return [...tickets.value].sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
	}

	const getTicket = async (id: number): Promise<TicketDetail | null> => {
		await mockDelay()
		return tickets.value.find(t => t.id === id) ?? null
	}

	const createTicket = async (input: { category_id: string, subject: string, content: string }): Promise<number> => {
		await mockDelay()
		const now = new Date().toISOString()
		const id = Math.max(...tickets.value.map(t => t.id)) + 1
		tickets.value.push({
			id,
			subject: input.subject,
			status: 'open',
			category: MOCK_CATEGORIES.find(c => c.id === input.category_id) ?? MOCK_CATEGORIES[3]!,
			opener: MOCK_OPENER,
			assignee: null,
			discord_channel_url: null,
			created_at: now,
			last_activity_at: now,
			closed_at: null,
			messages: [
				{ id: mockMessageId(), author: MOCK_OPENER, is_staff: false, source: 'web', content: input.content, created_at: now },
			],
		})
		return id
	}

	const replyTicket = async (id: number, content: string) => {
		await mockDelay()
		const ticket = tickets.value.find(t => t.id === id)
		if (!ticket) throw new Error('找不到工單')
		const now = new Date().toISOString()
		ticket.messages.push({ id: mockMessageId(), author: MOCK_OPENER, is_staff: false, source: 'web', content, created_at: now })
		ticket.last_activity_at = now
	}

	const closeTicket = async (id: number) => {
		await mockDelay()
		const ticket = tickets.value.find(t => t.id === id)
		if (!ticket) throw new Error('找不到工單')
		const now = new Date().toISOString()
		ticket.status = 'closed'
		ticket.closed_at = now
		ticket.last_activity_at = now
		ticket.messages.push({ id: mockMessageId(), author: null, is_staff: false, source: 'system', content: '工單已關閉', created_at: now })
	}

	return { listCategories, listTickets, getTicket, createTicket, replyTicket, closeTicket }
}
