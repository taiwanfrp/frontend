import type { UseFetchOptions } from 'nuxt/app'
import type { Ref } from 'vue'

type CustomFetchOptions<T> = Omit<UseFetchOptions<T>, 'default'> & {
	default?: () => T | Ref<T>
}

export const useApiFetch = <T>(
	url: string | (() => string),
	options?: CustomFetchOptions<T>,
) => {
	const config = useRuntimeConfig()

	return useFetch<T>(url, {
		baseURL: config.public.apiUrl as string,

		credentials: 'include',

		...options,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any)
}
