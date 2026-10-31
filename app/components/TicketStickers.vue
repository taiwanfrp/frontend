<script setup lang="ts">
defineProps<{
	stickers: TicketSticker[]
}>()
</script>

<template>
	<!-- 貼圖: Lottie 是 JSON 動畫, 目前只顯示名稱 -->
	<div class="flex flex-wrap gap-2">
		<template
			v-for="sticker in stickers"
			:key="sticker.id"
		>
			<img
				v-if="sticker.url && sticker.format !== 'lottie'"
				:src="sticker.url"
				:alt="sticker.name"
				:title="sticker.name"
				class="w-40 h-40 object-contain"
				loading="lazy"
			>
			<span
				v-else
				class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
			>
				<UIcon
					name="i-heroicons-face-smile"
					class="w-4 h-4 shrink-0"
				/>
				{{ $t('tickets.detail.sticker', { name: sticker.name }) }}
			</span>
		</template>
	</div>
</template>
