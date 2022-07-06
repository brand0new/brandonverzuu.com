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
	<h1 class="title">Posts 📚</h1>
	<p>Van tijd tot tijd schrijf ik een blogposts over een onderwerp dat ik interessant vind. Hiervoor heb ik geen vast schema, maar updates worden verstuurd via LinkedIn.</p>
	<p>Lees ze!</p>
	<div class="divider" />
	<div class="blogposts">
		{#each posts as { path, metadata }}
		<div class="card card-compact w-96 bg-base-100 shadow-xl">
			<figure><img src="https://placeimg.com/400/225/arch" alt="Shoes" /></figure>
			<div class="card-body">
				<h2 class="card-title">{metadata.title}</h2>
				<p>{metadata.description}</p>
				<div class="card-actions justify-end">
					<button class="btn btn-ghost">
                        <a href={`/blog/${path.replace(".md", "")}`}>Read</a>
                    </button>
				</div>
			</div>
		</div>
		{/each}
	</div>
</div>

<style>
    .blogposts {
        display: grid;
        grid-template-columns: 0.5fr 1fr;
        grid-gap: 2rem;
		margin-top: 3rem;
    }

	.title {
        font-size: 4.2rem;
        font-weight: bold;
        margin-top: 5rem;
    }
</style>