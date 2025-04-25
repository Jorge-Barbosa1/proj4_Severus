<script>
  import { goto } from '$app/navigation';
</script>

<style>
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: 'Georgia', serif;
    padding: 60px 20px;
  }

  .title {
    font-size: 2.2rem;
    font-weight: 500;
    margin-bottom: 50px;
    text-align: center;
  }

  .image-row {
    display: flex;
    justify-content: center;
    gap: 60px;
  }

  .image-button {
    background: none;
    border: none;
    cursor: pointer;
    text-align: center;
  }

  .image-button img {
    width: 300px;
    height: 300px;
    border-radius: 25px;
    object-fit: cover;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.25);
  }

  .label {
    margin-top: 15px;
    font-size: 1.2rem;
    font-weight: bold;
  }
</style>

<div class="container">
  <div class="title">SeverusPT Burn Severity</div>

  <div class="image-row">
    <button class="image-button" on:click={() => goto('/mapper')}>
      <img src="/mapper.png" alt="Mapper" />
      <div class="label">Mapper</div>
    </button>

    <button class="image-button" on:click={() => goto('/analyst')}>
      <img src="/analyst.png" alt="Analyst" />
      <div class="label">Analyst</div>
    </button>
  </div>
</div>
