<!-- 
    # Component functionality
    1. get list of tags from metadata
    2. pass array of tags to svelte component
    3. create div with badge class per tag
 -->

 <script lang="ts">
    
    // get tags
    // placeholder for now

    let date : Date = new Date(), day, month, year;
    let tags : String[] = ["tag1", "tag2", "tag3"];

    export { date, tags };

</script>

<div class="text-xs font-extralight italic">
    <p>Published: {date}</p>
</div>

<div class="mt-3 badge-container space-x-1">
    {#each tags as tag }
        <div class="badge badge-outline">{tag}</div>
    {/each}
</div>

<div class="divider"/>