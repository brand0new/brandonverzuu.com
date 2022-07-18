<script>
	import '../app.css';
	import Navbar from '$lib/components/navbar.svelte';
	import Footer from '$lib/components/footer.svelte';
</script>

<div class="h-screen">
	<Navbar />
	<main class="mx-10 md:mx-10">
		<div class="mx-auto max-w-max flex items-center space-x-6">
			<slot />
			<!-- content goes into slot -->
		</div>
	</main>
</div>