<script>
	import '../app.css';
	import Navbar from '../lib/components/navbar.svelte';
</script>

<section>
	<Navbar />
	<main>
		<div class="mx-auto max-w-max flex items-center space-x-6">
			<slot />
			<!-- content goes into slot -->
		</div>
	</main>	
</section>