<script setup lang="ts">
const { user, isLoading } = useAuth()
const localePath = useLocalePath()

onMounted(() => {
	if (!isLoading.value && !user.value) {
		navigateTo(localePath('/'))
	}
})

watchEffect(() => {
	if (!isLoading.value && !user.value) {
		navigateTo(localePath('/'))
	}
})
</script>

<template>
	<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<slot />
	</div>
</template>
