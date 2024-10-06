<template>
Android Only

<div>
	Server Api Call:
	<div>
		{{ data ?? error ?? status }}
	</div>
</div>
</template>

<script setup lang="ts">
const { data, error, status } = useAsyncData("test", () => $fetch("/api/test"))
</script>
