<script setup lang="ts">
const props = defineProps<{
	status: TicketStatus
}>()

const { t } = useI18n()

const meta = computed(() => TICKET_STATUS[props.status])

const labels = computed(() => ({
	open: t('tickets.status.open'),
	claimed: t('tickets.status.claimed'),
	closed: t('tickets.status.closed'),
}))
</script>

<template>
	<UBadge
		:color="meta.color"
		variant="subtle"
		:icon="meta.icon"
		:label="labels[status]"
	/>
</template>
