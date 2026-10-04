// navigator.clipboard 只在 HTTPS 或 localhost 下存在, 其他情況改用 execCommand
export const copyText = async (text: string) => {
	if (navigator.clipboard && window.isSecureContext) {
		await navigator.clipboard.writeText(text)
		return
	}

	const textarea = document.createElement('textarea')
	textarea.value = text
	textarea.setAttribute('readonly', '')
	textarea.style.position = 'fixed'
	textarea.style.opacity = '0'
	document.body.appendChild(textarea)
	textarea.select()
	const copied = document.execCommand('copy')
	textarea.remove()
	if (!copied) throw new Error('copy failed')
}
