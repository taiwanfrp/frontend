export interface User {
	internal_user_id: string
	internal_account_status: string
	discord_id: string
	username: string
	avatar: string | null
	mfa_enabled: boolean
	locale: string
	email: string | null
	verified: boolean
	roles: string[]
	permissions: string[]
	limits?: {
		max_tunnels: number
		max_bandwidth: number
	}
	[key: string]: unknown
}

export const useAuth = () => {
	const config = useRuntimeConfig()
	// 使用 useState 建立全域狀態避免跨頁面切換時重複請求
	const user = useState<User | null>('auth_user', () => null)
	// 建立 loading 狀態避免在檢查登入前畫面閃爍
	const isLoading = useState<boolean>('auth_loading', () => true)

	const fetchUser = async () => {
		isLoading.value = true
		try {
			const data = await $fetch(`${config.public.apiUrl}/api/v1/users/me`, {
				// 帶上 cookie
				credentials: 'include',
			})
			user.value = data as User
		}
		catch (error) {
			user.value = null
			console.error('Fetch user failed:', error)
		}
		finally {
			isLoading.value = false
		}
	}

	const logout = async () => {
		try {
			await $fetch(`${config.public.apiUrl}/api/v1/auth/logout`, {
				method: 'POST',
				credentials: 'include',
			})
		}
		catch (error) {
			console.error('Logout failed:', error)
		}
		finally {
			// 無論是否成功都清空狀態
			user.value = null
		}
	}

	const getAvatarUrl = (user: User | null) => {
		if (!user || !user.discord_id) return ''

		// 如果有自訂頭像
		if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`

		// 如果沒有自訂頭像, 計算預設 Discord 頭像索引
		let defaultAvatarIndex: number

		try {
			// 64-bit Snowflake 右移 22 位元後取餘數, 以取得預設頭像索引 (0~5)
			defaultAvatarIndex = Number((BigInt(user.discord_id) >> 22n) % 6n)
		}
		catch (error) {
			defaultAvatarIndex = 0
			console.error('Error calculating default avatar index:', error)
		}
		return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`
	}

	return { user, isLoading, fetchUser, logout, getAvatarUrl }
}
