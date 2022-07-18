<script lang="ts">
	let experience: number = new Date(Date.now()).getTime() - new Date('01-01-2016').getTime();
	experience /= 1000 * 60 * 60 * 24;
	experience = Math.abs(Math.floor(experience / 365.25));

	export { experience };
</script>

<svelte:head>
	<title>Over Brandon</title>
</svelte:head>

<div class="prose">
	<section>
		<h1 class="text-7xl font-bold mt-20">Hoi! 👋</h1>
		<div class="-mt-8">
			<p>
				Ik ben afgestudeerd bedrijfskundig informaticus met meer dan 6 jaar praktijkervaring in 
				software ontwikkeling voor MKB en enterprise partijen. Ik richt me op nieuwe ontwikkelingen
				binnen de sector en pragmatische manieren om deze toe te passen en hiervan te leren.
			</p>
			<p>
				Hiervoor ligt een hoofdrol weggelegd voor het onderzoeken naar en adviseren over de
				toepassing van nieuwe ontwikkelingen. De afgelopen vijf jaar heb ik een voorliefde
				ontwikkeld voor blockchain en (systeem)architectuur.
			</p>
			<p>
				Contact opnemen kan via <a href="mailto:brandonverzuu@gmail.com">brandonverzuu@gmail.com</a>
				of <a href="https://www.linkedin.com/in/brandonverzuu/">LinkedIn</a>
			</p>
		</div>
	</section>
</div>
