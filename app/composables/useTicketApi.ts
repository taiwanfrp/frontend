// 客服單 bot 的 API: bot 有自己的網域與 session cookie, 跟主要 API 分開
// 收到 401 時向主要 API 取得一次性授權碼, 跟 bot 交換 cookie 後重送一次 (bot repo 的 docs/auth.md)

export type TicketRequestOptions = {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
	body?: Record<string, unknown>
	query?: Record<string, string | number | boolean | undefined>
}

export interface TicketEvent {
	id: number
	ticket_id: number
	type: string
	actor_id: string | null
	data: Record<string, string | null> | null
	created_at: string
}

// 同時有多個請求收到 401 時只交換一次
let exchanging: Promise<void> | null = null

// bot 的路徑不是這個網站的, 不需要 Nitro 依照路徑推導型別 (推導 method 時會超過 TypeScript 的遞迴深度)
const fetchTicketApi = $fetch as unknown as (request: string, options: object) => Promise<unknown>

const statusCode = (error: unknown) => (error as { statusCode?: number }).statusCode

// bot 回傳的錯誤訊息: 一般是字串; 欄位驗證錯誤是陣列, 自訂的檢查訊息前面會有 pydantic 加上的 "Value error, "
export const ticketErrorMessage = (error: unknown) => {
	const detail = (error as { data?: { detail?: unknown } }).data?.detail
	if (typeof detail === 'string') return detail
	if (!Array.isArray(detail)) return undefined
	const messages = detail
		.map(item => (item as { msg?: unknown }).msg)
		.filter((msg): msg is string => typeof msg === 'string')
		.map(msg => msg.replace(/^Value error, /, ''))
	return messages.length ? messages.join('\n') : undefined
}

export const useTicketApi = () => {
	const config = useRuntimeConfig()
	const baseURL = config.public.ticketApiUrl as string

	const exchange = () => {
		exchanging ??= (async () => {
			const { code } = await $fetch<{ code: string }>(`${config.public.apiUrl}/api/v1/auth/ticket-code`, {
				method: 'POST',
				credentials: 'include',
			})
			await $fetch(`${baseURL}/auth/exchange`, {
				method: 'POST',
				credentials: 'include',
				body: { code },
			})
		})().finally(() => {
			exchanging = null
		})
		return exchanging
	}

	const send = <T>(path: string, options: TicketRequestOptions) => fetchTicketApi(path, {
		baseURL,
		credentials: 'include',
		method: options.method ?? 'GET',
		body: options.body,
		query: options.query,
		// bot 只接受 JSON 的修改請求 (擋 CSRF), 沒有 body 的 POST 與 DELETE 也要帶
		headers: options.method && options.method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
	}) as Promise<T>

	const request = async <T>(path: string, options: TicketRequestOptions = {}): Promise<T> => {
		try {
			return await send<T>(path, options)
		}
		catch (error) {
			if (statusCode(error) !== 401) throw error
			// 主要 API 也回傳 401 時代表沒有登入, 直接丟出錯誤
			await exchange()
			return await send<T>(path, options)
		}
	}

	// SSE: EventSource 失敗時拿不到狀態碼, 先關閉, 用 GET /me 判斷是不是 401 (會自動重新交換) 再重新連線
	// 自己重新連線不會帶 Last-Event-ID, 斷線期間的事件可能漏掉, 所以重新連上時呼叫 onReconnect 重新載入資料
	const subscribe = (
		path: string,
		types: string[],
		onEvent: (event: TicketEvent) => void,
		onReconnect?: () => void,
	) => {
		let source: EventSource | null = null
		let timer: ReturnType<typeof setTimeout> | undefined
		let stopped = false
		let reconnecting = false

		const connect = () => {
			source = new EventSource(`${baseURL}${path}`, { withCredentials: true })
			source.onopen = () => {
				if (!reconnecting) return
				reconnecting = false
				onReconnect?.()
			}
			for (const type of types) {
				source.addEventListener(type, (event) => {
					onEvent(JSON.parse((event as MessageEvent<string>).data) as TicketEvent)
				})
			}
			source.onerror = () => {
				source?.close()
				if (stopped) return
				reconnecting = true
				timer = setTimeout(async () => {
					await request('/me').catch(() => undefined)
					if (!stopped) connect()
				}, 3000)
			}
		}

		connect()

		return () => {
			stopped = true
			clearTimeout(timer)
			source?.close()
		}
	}

	return { request, subscribe }
}
