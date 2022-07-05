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

<div class= "container">
	<h1>Posts</h1>

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
	.container {
        max-width: 800px;
        margin: 50px auto;
    }

    .blogposts {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-gap: 20px;
    }
</style>