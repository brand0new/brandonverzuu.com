<svelte:head>
    <title>Brandon Verzuu</title>
</svelte:head>

<!-- 
    svelte:head can be used to bind values from the .svelte component level 
 -->

<div class="container">
    <div class="flex-start info">
        <div class="flex-start info-container">
            <div class="info-text">
                <h1>
                    <p>Hallo,</p>
                    <p>ik ben Brandon Verzuu</p>
                </h1>
            </div>
            <h2 class="subtitle">
                Software en technologie fanaat met een passie voor architectuur.
            </h2>
            <div>
                <a href="/about">Meer over mij</a>
            </div>
        </div>
    </div>
</div>

<style> 
    .container {
        margin: 190px 0 0 2.5rem;
    }
 
    .info h1 {
        font-size: 4rem;
        margin: 0;
    }
 
    .info h1 p {
        position: relative;
        font: inherit;
        margin: 0;
        text-align: left;
        line-height: 130%;
        font-weight: 800;
        letter-spacing: -0.03em;
    }
 
    .subtitle {
        max-width: 65ch;
        font-weight: 200;
        margin-top: 0.50rem;
    }
   
    .info .info-text {
        position: relative;
    }
</style>