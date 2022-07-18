<script lang="ts">
	import Metadata from '$lib/components/blog-metadata.svelte';
</script>

<div>
	<article class="prose mt-4">
		<!-- markdown file is entered here -->
		<slot />
	</article>

	<div class="divider" />
</div>
