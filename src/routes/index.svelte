<svelte:head>
    <title>Brandon Verzuu</title>
</svelte:head>

<!-- 
    svelte:head can be used to bind values from the .svelte component level 
 -->

<div class="container">
    <div class="info">
        <div class="container info-container">
            <div class="info-text">
                <h1>
                    <p class="animate-text-1">Hallo,</p>
                    <p class="text-2">Ik ben Brandon Verzuu</p>
                </h1>
            </div>
            <h2 class="subtitle">
                Software en technologie enthousiasteling met een passie voor systeemontwerp.
            </h2>
            <div>
                <a href="/about">Meer over mij</a>
            </div>
        </div>
    </div>
</div>

<div class="background-div bg-base-300"></div>

<style>
    .info {
        text-align: center;
        position: relative;
    }       
 
    .info-container {
        max-width: fit-content;
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: left;
        align-items: start;
    }
 
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
 
    .info h2 {
        max-width: 65ch;
        font-weight: 200;
        margin-top: 0.50rem;
    }
 
    .background-div {
        width: 35vw;
        height: 35vh;
        margin: -155px auto;
    }
   
    .info .info-text {
        position: relative;
    }
</style>