export default defineNuxtPlugin(() => {
	const config = useRuntimeConfig()
	const version = config.public.version as string

	const isPrerelease = /-(beta|alpha|rc|apache|dev)/i.test(version)
	const color = isPrerelease
		? 'color: #ffc107; font-size: 16px; font-weight: bold;'
		: 'color: #42b983; font-size: 16px; font-weight: bold;'

	console.log(`%c TaiwanFRP v${version}`, color)
})
