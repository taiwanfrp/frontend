<script setup lang="ts">
const props = defineProps<{
	status: TicketStatus
}>()

const meta = computed(() => TICKET_STATUS[props.status])
</script>

<template>
	<UBadge
		:color="meta.color"
		variant="subtle"
		:icon="meta.icon"
		:label="meta.label"
	/>
</template>
