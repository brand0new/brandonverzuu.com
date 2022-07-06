<script lang="ts">
    import Metadata from '$lib/components/blog-metadata.svelte';
</script>

<div>
    <Metadata />

    <article class="prose">
        <!-- markdown file is entered here -->
        <slot />
    </article>

    <div class="divider" />
</div>