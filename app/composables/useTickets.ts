// 客服單 bot 的資料格式 (bot repo 的 bot/api/schemas.py), Discord ID 一律是字串

export type TicketStatus = 'open' | 'closed' | 'failed'
// 顯示用的狀態: 開啟中而且有人接手時是 claimed
export type TicketDisplayStatus = 'open' | 'claimed' | 'closed' | 'failed'
export type TicketSource = 'discord' | 'web'

// 客服單裡某個人的快照, 顯示名稱的順序: nickname → global_name → username
export interface TicketUser {
	id: string
	username: string
	global_name: string | null
	nickname: string | null
	avatar_url: string | null
	role_name: string | null
	role_color: number | null
	is_bot: boolean
}

export interface TicketMe {
	id: string
	username: string
	global_name: string | null
	nickname: string | null
	avatar_url: string
	in_guild: boolean
	guild_id: string
	is_admin: boolean
	category_ids: number[]
}

export interface TicketCategory {
	id: number
	name: string
	emoji: string | null
	description: string | null
	position: number
	enabled: boolean
	// null 表示使用設定裡的預設 Discord 類別
	discord_category_id: string | null
	created_at: string
	updated_at: string
}

export interface Ticket {
	id: number
	category_id: number
	status: TicketStatus
	source: TicketSource
	channel_id: string | null
	opener_id: string
	claimed_by_id: string | null
	subject: string
	created_at: string
	last_message_at: string
	closed_at: string | null
	// null 表示系統自動關閉
	closed_by_id: string | null
}

export interface TicketSummary extends Ticket {
	opener: TicketUser | null
	claimed_by: TicketUser | null
}

export interface TicketDetail extends Ticket {
	content: string
	claimed_at: string | null
	inactivity_reminded_at: string | null
	close_reason: string | null
	rating: number | null
	feedback: string | null
	rated_at: string | null
	users: TicketUser[]
	members: { user_id: string, added_by_id: string, added_at: string }[]
}

export type TicketAttachmentStatus = 'pending' | 'done' | 'rejected' | 'failed'

export interface TicketAttachment {
	id: number
	ticket_id: number
	message_id: number | null
	uploader_id: string
	source: TicketSource
	filename: string
	content_type: string | null
	size: number
	status: TicketAttachmentStatus
	removed_at: string | null
	created_at: string
	// presigned URL, 會過期, 需要時用 getAttachment 重新取得
	download_url: string | null
}

export interface TicketMessage {
	id: number
	ticket_id: number
	source: TicketSource
	author_id: string
	content: string
	created_at: string
	edited_at: string | null
	// 被刪除的訊息只有客服看得到內容
	deleted_at: string | null
	// 網頁訊息才有
	delivery_status: 'pending' | 'sent' | 'failed' | null
	attachments: TicketAttachment[]
	// 編輯前的每一版, 只有客服拿得到
	revisions: { content: string, created_at: string, replaced_at: string }[]
}

export interface TicketMessagePage {
	messages: TicketMessage[]
	users: TicketUser[]
}

export interface TicketListQuery {
	status?: TicketStatus
	before?: number
	limit?: number
}

export const TICKET_STATUS = {
	open: { color: 'warning', icon: 'i-heroicons-clock' },
	claimed: { color: 'info', icon: 'i-heroicons-user' },
	closed: { color: 'neutral', icon: 'i-heroicons-lock-closed' },
	failed: { color: 'error', icon: 'i-heroicons-exclamation-triangle' },
} as const

export const displayStatus = (ticket: Ticket): TicketDisplayStatus => {
	if (ticket.status === 'open' && ticket.claimed_by_id) return 'claimed'
	return ticket.status
}

export const displayName = (user: Pick<TicketUser, 'username' | 'global_name' | 'nickname'>) =>
	user.nickname || user.global_name || user.username

// 沒有自訂頭像時使用 Discord 的預設頭像
export const ticketAvatarUrl = (user: Pick<TicketUser, 'id' | 'avatar_url'>) =>
	user.avatar_url || useAuth().getAvatarUrl({ discord_id: user.id, avatar: null })

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

export const formatFileSize = (bytes: number) => {
	const units = ['B', 'KB', 'MB', 'GB']
	let size = bytes
	let unit = 0
	while (size >= 1024 && unit < units.length - 1) {
		size /= 1024
		unit++
	}
	return `${unit === 0 ? size : size.toFixed(1)} ${units[unit]}`
}

interface TicketUpload {
	attachment: TicketAttachment
	// 不超過 part_size 時直接 PUT 整個檔案到這個網址
	url: string | null
	part_size: number | null
	part_count: number | null
}

// 分塊上傳時每次申請的網址數量, 網址會過期 (預設 10 分鐘), 所以在上傳前才分批申請
const PART_BATCH = 10

const putToStorage = async (url: string, body: Blob) => {
	// 直接上傳到 S3, 不帶 cookie; 簽章包含檔案大小, 瀏覽器會自動帶上 Content-Length
	const response = await fetch(url, { method: 'PUT', body })
	if (!response.ok) throw new Error(`upload failed: ${response.status}`)
}

export const useTickets = () => {
	const { request, subscribe } = useTicketApi()
	// 在 bot 的身分 (是不是管理員, 負責哪些分類)
	const me = useState<TicketMe | null>('ticket_me', () => null)

	const fetchMe = async () => {
		me.value = await request<TicketMe>('/me')
		return me.value
	}

	const isStaff = (categoryId: number) =>
		!!me.value && (me.value.is_admin || me.value.category_ids.includes(categoryId))

	const listCategories = () => request<TicketCategory[]>('/categories')

	const listTickets = (query: TicketListQuery = {}) =>
		request<TicketSummary[]>('/tickets', { query: { ...query } })

	const getTicket = (id: number) => request<TicketDetail>(`/tickets/${id}`)

	const createTicket = (input: { category_id: number, subject: string, content: string }) =>
		request<Ticket>('/tickets', { method: 'POST', body: input })

	const listMessages = (id: number, query: { before?: number, after?: number, limit?: number } = {}) =>
		request<TicketMessagePage>(`/tickets/${id}/messages`, { query })

	const getMessage = (id: number, messageId: number) =>
		request<TicketMessagePage>(`/tickets/${id}/messages/${messageId}`)

	const sendMessage = (id: number, content: string, attachmentIds: number[]) =>
		request<TicketMessage>(`/tickets/${id}/messages`, {
			method: 'POST',
			body: { content, attachment_ids: attachmentIds },
		})

	const closeTicket = (id: number, reason: string | null) =>
		request<Ticket>(`/tickets/${id}/close`, { method: 'POST', body: { reason } })

	const claimTicket = (id: number) => request<Ticket>(`/tickets/${id}/claim`, { method: 'POST' })

	const unclaimTicket = (id: number) => request<Ticket>(`/tickets/${id}/unclaim`, { method: 'POST' })

	const rateTicket = (id: number, rating: number, feedback: string | null) =>
		request(`/tickets/${id}/rating`, { method: 'PUT', body: { rating, feedback } })

	const getAttachment = (attachmentId: number) => request<TicketAttachment>(`/attachments/${attachmentId}`)

	const removeAttachment = (attachmentId: number) =>
		request(`/attachments/${attachmentId}`, { method: 'DELETE' })

	// 上傳附件: 向 bot 申請網址, 瀏覽器直接上傳到 S3, 完成後由 worker 檢查內容 (結果用 SSE 的 attachment.updated 通知)
	// onCreated 在申請到附件 id 時呼叫, 讓呼叫端在上傳途中也能取消; onProgress 的值是 0 到 1
	const uploadAttachment = async (
		ticketId: number,
		file: File,
		onCreated?: (attachment: TicketAttachment) => void,
		onProgress?: (ratio: number) => void,
	) => {
		const upload = await request<TicketUpload>(`/tickets/${ticketId}/attachments`, {
			method: 'POST',
			body: { filename: file.name, size: file.size },
		})
		const attachmentId = upload.attachment.id
		onCreated?.(upload.attachment)

		if (upload.url) {
			await putToStorage(upload.url, file)
		}
		else {
			const partSize = upload.part_size!
			const partCount = upload.part_count!
			for (let first = 1; first <= partCount; first += PART_BATCH) {
				const numbers = Array.from({ length: Math.min(PART_BATCH, partCount - first + 1) }, (_, i) => first + i)
				const parts = await request<{ part_number: number, url: string }[]>(`/attachments/${attachmentId}/parts`, {
					method: 'POST',
					body: { part_numbers: numbers },
				})
				for (const part of parts) {
					const start = (part.part_number - 1) * partSize
					await putToStorage(part.url, file.slice(start, start + partSize))
					onProgress?.(part.part_number / partCount)
				}
			}
		}

		onProgress?.(1)
		return await request<TicketAttachment>(`/attachments/${attachmentId}/complete`, { method: 'POST' })
	}

	// 客服單列表的變動 (新開單, 被接手, 已關閉)
	const subscribeList = (onEvent: (event: TicketEvent) => void, onReconnect?: () => void) =>
		subscribe('/events', LIST_EVENT_TYPES, onEvent, onReconnect)

	// 單一客服單的事件
	const subscribeTicket = (id: number, onEvent: (event: TicketEvent) => void, onReconnect?: () => void) =>
		subscribe(`/tickets/${id}/events`, [...MESSAGE_EVENT_TYPES, ...LIST_EVENT_TYPES], onEvent, onReconnect)

	return {
		me,
		fetchMe,
		isStaff,
		listCategories,
		listTickets,
		getTicket,
		createTicket,
		listMessages,
		getMessage,
		sendMessage,
		closeTicket,
		claimTicket,
		unclaimTicket,
		rateTicket,
		getAttachment,
		removeAttachment,
		uploadAttachment,
		subscribeList,
		subscribeTicket,
	}
}

const MESSAGE_EVENT_TYPES = ['message.created', 'message.updated', 'message.deleted', 'attachment.updated']

const LIST_EVENT_TYPES = [
	'ticket.created',
	'ticket.claimed',
	'ticket.unclaimed',
	'ticket.transferred',
	'ticket.member_added',
	'ticket.member_removed',
	'ticket.opener_added',
	'ticket.inactivity_reminded',
	'ticket.closed',
	'ticket.rated',
]

// 主要 API 確認登入後才呼叫 bot 的 API (沒有登入時 layout 會導回首頁, 不需要再顯示錯誤)
export const whenLoggedIn = (callback: () => void) => {
	const { user, isLoading } = useAuth()
	let called = false
	watch(() => !isLoading.value && !!user.value, (ready) => {
		if (!ready || called) return
		called = true
		callback()
	}, { immediate: true })
}
