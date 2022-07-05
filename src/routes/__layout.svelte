<script>
	import '../app.css';
	import Navbar from '../lib/components/navbar.svelte';
</script>

<section class="h-screen">
	<Navbar />
	<main>
		<div class="container prose">
			<slot />
			<!-- content goes into slot -->
		</div>
	</main>	
</section>

<style>
	.container {
		max-width: 1400px;
		margin: 50px auto;
	}
</style>