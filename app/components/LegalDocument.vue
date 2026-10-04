<script setup lang="ts">
const props = defineProps<{
	page: 'terms' | 'privacy'
}>()

const { locale } = useI18n()

// 內容放在 content/legal/<語系>/<頁面>.md, 該語系還沒有翻譯時改用正體中文
// Nuxt Content 產生的 path 會轉成小寫 (zh-Hant → zh-hant)
const { data: doc } = await useAsyncData(() => `legal-${props.page}-${locale.value}`, async () => {
	const query = (lang: string) => queryCollection('legal').path(`/legal/${lang.toLowerCase()}/${props.page}`).first()
	return await query(locale.value) ?? await query('zh-Hant')
})

if (!doc.value) {
	throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const updatedAt = computed(() => doc.value && new Date(doc.value.updatedAt).toLocaleDateString(locale.value, {
	year: 'numeric',
	month: 'long',
	day: 'numeric',
}))

useSeoMeta({
	title: () => doc.value?.title,
	description: () => doc.value?.description,
})
</script>

<template>
	<div
		v-if="doc"
		class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-24"
	>
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
			{{ doc.title }}
		</h1>
		<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
			{{ $t('legal.updated_at', { date: updatedAt }) }}
		</p>

		<ContentRenderer
			:value="doc"
			class="mt-8"
		/>
	</div>
</template>
