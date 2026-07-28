<script setup lang="ts">
const { user, isLoading, getAvatarUrl } = useAuth()

onMounted(() => {
	if (!isLoading.value && !user.value) {
		navigateTo('/')
	}
})

watchEffect(() => {
	if (!isLoading.value && !user.value) {
		navigateTo('/')
	}
})
</script>

<template>
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-24">
		<!-- 標題 -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
				個人資料
			</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				檢視您的個人資料
			</p>
		</div>

		<!-- 資料卡片 -->
		<UCard
			v-if="user"
			class="ring-1 ring-gray-200 dark:ring-gray-800 shadow-sm"
		>
			<div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
				<!-- 頭像 -->
				<div class="shrink-0">
					<img
						:src="getAvatarUrl(user)"
						class="w-24 h-24 rounded-full object-cover ring-4 ring-gray-50 dark:ring-gray-900 shadow-sm"
						alt="User Avatar"
					>
				</div>

				<!-- 資訊 -->
				<div class="flex-1 text-center sm:text-left mt-2 sm:mt-0">
					<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						{{ user.username }}
					</h2>

					<div class="inline-flex flex-col space-y-4 text-left w-full sm:w-auto">
						<!-- Email -->
						<div class="flex items-center gap-3 sm:gap-4">
							<span class="text-sm font-medium text-gray-500 dark:text-gray-400 w-20 sm:w-24 shrink-0">Email</span>
							<span class="text-base text-gray-900 dark:text-gray-100 truncate">{{ user.email || '未提供' }}</span>
						</div>

						<!-- Discord ID -->
						<div class="flex items-center gap-3 sm:gap-4">
							<span class="text-sm font-medium text-gray-500 dark:text-gray-400 w-20 sm:w-24 shrink-0">Discord ID</span>
							<div class="truncate">
								<span class="text-gray-900 dark:text-gray-100 font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{{ user.discord_id }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</UCard>
	</div>
</template>
