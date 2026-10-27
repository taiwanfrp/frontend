<script setup lang="ts">
const props = defineProps<{
	emoji: string
}>()

// 分類的表情: Unicode 表情直接顯示, 伺服器的自訂表情 (<:name:id> 或 <a:name:id>) 改用 Discord CDN 的圖片
const custom = computed(() => {
	const match = /^<(a?):(\w+):(\d+)>$/.exec(props.emoji)
	if (!match) return null
	return {
		name: match[2],
		url: `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] ? 'gif' : 'webp'}?size=48`,
	}
})
</script>

<template>
	<img
		v-if="custom"
		:src="custom.url"
		:alt="custom.name"
		class="inline-block w-[1.2em] h-[1.2em] object-contain align-[-0.2em]"
	>
	<span v-else>{{ emoji }}</span>
</template>
