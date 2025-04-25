import { fetchBurnedAreaLayer } from '$lib/services/gee-service';
import { addBurnedAreaLayer } from '$lib/components/map/Map.svelte';

let selectedDataset = 'ICNF';
let selectedYear = 2020;

async function handleAddLayer() {
  try {
    const geojson = await fetchBurnedAreaLayer(selectedDataset, selectedYear);
    addBurnedAreaLayer(geojson, selectedDataset === 'ICNF' ? 'red' : 'black');
  } catch (err) {
    console.error('Erro ao adicionar camada:', err);
    alert('Erro ao adicionar camada de área queimada');
  }
}
