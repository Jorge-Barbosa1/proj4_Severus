<script lang="ts">
  import { onMount } from 'svelte';
  // usa o pequeno parser «marked» - já vem com SvelteKit; se não:
  // npm i marked --save
  import { marked } from 'marked';

  export let docPath = '';

  let open   = false;
  let html   = '<em>Loading…</em>';

  // carrega e converte para HTML assim que o componente monta
  onMount(async () => {
    const res   = await fetch(docPath);
    const txt   = await res.text();
    marked.setOptions({ breaks:true, mangle:false, headerIds:false });
    html        = marked.parse(txt);
  });
</script>

<!-- Ícone – continua a funcionar como botão -->
<button class="info-btn" title="Abrir tutorial" on:click={() => (open = true)}>
  ℹ️
</button>

{#if open}
  <div class="backdrop"    on:click={() => (open = false)} />
  <article class="dialog">
    <div class="content" on:click|stopPropagation>
      {@html html}
    </div>
    <button class="close-btn" on:click={() => (open = false)}>Fechar</button>
  </article>
{/if}

<style>
  .info-btn       { background:none;border:none;font-size:1.1rem;
                    color:#2196f3;cursor:pointer; }
  .info-btn:hover { transform:scale(1.15); }

  /* ——— Modal ——— */
  .backdrop { position:fixed;inset:0;background:#0007;z-index:1000; }

  .dialog   { position:fixed;top:10%;left:50%;transform:translateX(-50%);
              width: min(640px, 90vw);
              max-height:80vh;
              background:#fff;border-radius:10px;padding:1.5rem 1.25rem;
              box-shadow:0 8px 24px rgba(0,0,0,.25);
              display:flex;flex-direction:column;
              overflow:hidden;z-index:1001; }

  .content  { flex:1;overflow:auto;padding-right:.5rem; }

  .dialog h1,.dialog h2,.dialog h3 { margin:1rem 0 .5rem; }
  .dialog p, .dialog li             { line-height:1.4; }

  .close-btn { align-self:flex-end;margin-top:1rem;
               background:#2196f3;color:#fff;border:none;
               padding:.4rem 1.1rem;border-radius:6px;cursor:pointer; }
  .close-btn:hover { background:#1976d2; }
</style>
