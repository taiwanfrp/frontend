<script setup lang="ts">
definePageMeta({
	layout: 'tickets',
})

const SUBJECT_MAX = 100
const CONTENT_MAX = 2000

const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const { listCategories, createTicket } = useTickets()
const { categoryName, categoryDescription } = useTicketCategoryText()

const { data: categories, pending: isCategoriesLoading } = useAsyncData('ticket-categories', listCategories, {
	server: false,
	lazy: true,
	default: () => [] as TicketCategory[],
})

const form = reactive({
	category_id: '',
	subject: '',
	content: '',
})

const categoryItems = computed(() => categories.value.map(category => ({
	label: categoryName(category),
	value: category.id,
})))

const selectedCategory = computed(() => categories.value.find(category => category.id === form.category_id))

const isSubmitting = ref(false)

const canSubmit = computed(() =>
	form.category_id
	&& form.subject.trim()
	&& form.content.trim()
	&& form.subject.length <= SUBJECT_MAX
	&& form.content.length <= CONTENT_MAX,
)

const submit = async () => {
	if (!canSubmit.value) return

	isSubmitting.value = true
	try {
		const id = await createTicket({
			category_id: form.category_id,
			subject: form.subject.trim(),
			content: form.content.trim(),
		})
		toast.add({ title: t('tickets.new.created'), color: 'success', icon: 'i-heroicons-check-circle' })
		await navigateTo(localePath(`/tickets/${id}`))
	}
	catch (error: unknown) {
		const err = error as { data?: { detail?: string } }
		toast.add({
			title: t('tickets.new.create_failed'),
			description: err.data?.detail || t('tickets.new.create_failed_desc'),
			color: 'error',
			icon: 'i-heroicons-x-circle',
		})
	}
	finally {
		isSubmitting.value = false
	}
}
</script>

<template>
	<div class="max-w-2xl mx-auto space-y-6">
		<NuxtLink
			:to="$localePath('/tickets')"
			class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
		>
			<UIcon
				name="i-heroicons-arrow-left"
				class="w-4 h-4"
			/>
			{{ $t('tickets.common.back_to_list') }}
		</NuxtLink>

		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				{{ $t('tickets.new.title') }}
			</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				{{ $t('tickets.new.subtitle') }}
			</p>
		</div>

		<UCard class="bg-white/50 dark:bg-gray-900/50 backdrop-blur shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-800/50">
			<form
				class="space-y-6"
				@submit.prevent="submit"
			>
				<!-- 分類 -->
				<div class="space-y-2">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.new.category') }} <span class="text-red-500">*</span></label>

					<!-- 電腦版: 卡片 -->
					<div
						v-if="isCategoriesLoading"
						class="hidden sm:grid grid-cols-2 gap-3"
					>
						<div
							v-for="i in 4"
							:key="i"
							class="h-16 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse"
						/>
					</div>

					<div
						v-else
						class="hidden sm:grid grid-cols-2 gap-3"
					>
						<button
							v-for="category in categories"
							:key="category.id"
							type="button"
							class="p-3 rounded-lg border text-left transition-colors"
							:class="form.category_id === category.id
								? 'border-primary-500 bg-primary-500/8 ring-1 ring-primary-500'
								: 'border-gray-200 dark:border-gray-800 hover:bg-gray-900/5 dark:hover:bg-white/5'"
							@click="form.category_id = category.id"
						>
							<span class="block text-sm font-medium text-gray-900 dark:text-white">{{ categoryName(category) }}</span>
							<span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ categoryDescription(category) }}</span>
						</button>
					</div>

					<!-- 手機版: 下拉選單 -->
					<div class="sm:hidden space-y-1">
						<USelect
							v-model="form.category_id"
							:items="categoryItems"
							:loading="isCategoriesLoading"
							:placeholder="$t('tickets.new.category_placeholder')"
							class="w-full"
						/>
						<p
							v-if="selectedCategory"
							class="text-xs text-gray-500 dark:text-gray-400"
						>
							{{ categoryDescription(selectedCategory) }}
						</p>
					</div>
				</div>

				<!-- 主旨 -->
				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.new.subject') }} <span class="text-red-500">*</span></label>
					<UInput
						v-model="form.subject"
						:maxlength="SUBJECT_MAX"
						:placeholder="$t('tickets.new.subject_placeholder')"
						class="w-full"
					/>
				</div>

				<!-- 內容 -->
				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('tickets.new.content') }} <span class="text-red-500">*</span></label>
					<UTextarea
						v-model="form.content"
						:maxlength="CONTENT_MAX"
						:rows="8"
						autoresize
						:placeholder="$t('tickets.new.content_placeholder')"
						class="w-full"
					/>
					<p class="text-xs text-right text-gray-400 dark:text-gray-500">
						{{ form.content.length }} / {{ CONTENT_MAX }}
					</p>
				</div>

				<div class="flex justify-end gap-3">
					<UButton
						color="neutral"
						variant="ghost"
						:label="$t('tickets.common.cancel')"
						:to="$localePath('/tickets')"
						:disabled="isSubmitting"
					/>
					<UButton
						type="submit"
						:label="$t('tickets.new.submit')"
						icon="i-heroicons-paper-airplane"
						:loading="isSubmitting"
						:disabled="!canSubmit"
					/>
				</div>
			</form>
		</UCard>
	</div>
</template>
