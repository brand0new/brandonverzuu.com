<script lang="ts" context="module">
	const allPosts = import.meta.glob('./*.md');

	let body: any[] = [];

	for (let path in allPosts) {
		body.push(
			allPosts[path]().then(({ metadata }) => {
				return { path, metadata };
			})
		);
	}

	export const load = async () => {
		const posts = await Promise.all(body);

		return {
			props: {
				posts
			}
		};
	};
</script>

<script lang="ts">
	export let posts : any[];
</script>

<div>
	<h1 class="text-7xl font-bold mt-20">Posts 📚</h1>
	<div class="mt-3">
		<p>Van tijd tot tijd schrijf ik een blogposts over een onderwerp dat ik interessant vind. Hiervoor heb ik geen vast schema, maar updates worden verstuurd via LinkedIn.</p>
		<p>Lees ze!</p>
	</div>
	<div class="divider" />
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-8">
		{#each posts as { path, metadata }}
		<div class="card w-80 bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title text-2xl text-primary-focus">{metadata.title}</h2>
				<p>{metadata.description}</p>
				<div class="card-actions justify-end">
					<button class="btn btn-sm btn-tertiary">
                        <a href={`/blog/${path.replace(".md", "")}`}>Read</a>
                    </button>
				</div>
			</div>
		</div>
		{/each}
	</div>
</div>