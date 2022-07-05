<script lang="ts">

    const experience : Number = new Date(Date.now()).getTime() - new Date('01-01-2016').getTime(); 

    export { experience };

</script>

<svelte:head>
    Over mij
</svelte:head>

<div class="main-container">
    <section>
        <div class="inner-container">
            <h1 class="about-title">Hoi! 👋</h1>
            <div class="about-subtitle">
                <p>
                    Ik ben afgestudeerd bedrijfskundig informaticus met {experience} jaar praktijkervaring in software ontwikkeling voor MKB en enterprise partijen. Ik richt me op nieuwe ontwikkelingen binnen de sector en pragmatische manieren om deze toe te passen en hiervan te leren.
                </p>
                <p>
                    Hiervoor ligt een hoofdrol weggelegd voor het onderzoeken naar en adviseren over de toepassing van nieuwe ontwikkelingen. De afgelopen vijf jaar heb ik een voorliefde ontwikkeld voor blockchain en (systeem)architectuur.
                </p>
                <p>
                    Contact opnemen kan via <span class="info-text"><a href="mailto:brandonverzuu@gmail.com">brandonverzuu@gmail.com</a> of <a href="https://www.linkedin.com/in/brandonverzuu/">LinkedIn</a></span>
                </p>
            </div>
        </div>
    </section>
</div>

<style>
    .main-container {
        margin: 0 80px 0 65px;
    }
    .about-title {
        font-size: 4.2rem;
        font-weight: bold;
        margin-top: 11rem;
    }
    .about-subtitle {
        margin-top: -2rem;
    }
    .about-subtitle >p {
        width: 60%;
        font-weight: normal;
        font-size: 1rem;
        line-height: 2rem;
    }
    .info-text {
        font-weight: bold;
    }
 </style>