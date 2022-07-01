<script>
	import '../app.css';
	import Navbar from '../lib/components/navbar.svelte';
</script>

<Navbar />
<main class="flex items-center justify-center bg-base-100">
	<div class="w-4/5 m-4 px-4 py-4 sm:px-0">
		<slot />
		<!-- content goes into slot -->
	</div>
</main>
