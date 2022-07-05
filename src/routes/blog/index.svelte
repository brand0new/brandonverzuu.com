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

<h1>Posts</h1>

<div>
	<h2>Most recent posts</h2>
	{#each posts as { path, metadata }}
		<div class="card w-96 bg-base-100 shadow-xl">
			<figure><img src="https://placeimg.com/300/225/arch" alt="Shoes" /></figure>
			<div class="card-body">
				<h2 class="card-title">{metadata.title}</h2>
				<p>{metadata.description}</p>
				<div class="card-actions justify-end">
					<button class="btn btn-primary">
                        <a href={`/blog/${path.replace(".md", "")}`}>Read</a>
                    </button>
				</div>
			</div>
		</div>
	{/each}
</div>