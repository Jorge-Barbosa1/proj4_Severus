<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  
  // Props
  export let geometry = null;
  export let satellite = '';
  export let preStart = '';
  export let preEnd = '';
  export let postStart = '';
  export let postEnd = '';
  export let applySegmentation = false;
  
  // State
  let isLoading = false;
  let severityMaps = [];
  let error = null;
  let debugInfo = null;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Format dates for display
  $: formattedPreFire = preStart && preEnd ? `${formatDate(preStart)} to ${formatDate(preEnd)}` : '';
  $: formattedPostFire = postStart && postEnd ? `${formatDate(postStart)} to ${formatDate(postEnd)}` : '';
  
  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }
  
  // Function to generate severity maps
  async function generateSeverityMaps() {
    if (!geometry || !satellite) {
      error = 'Please select a geometry and satellite before generating maps';
      return;
    }
    
    try {
      isLoading = true;
      error = null;
      debugInfo = null;
      
      // Prepare the request payload
      const payload = {
        geometry,
        satellite,
        preStart,
        preEnd,
        postStart,
        postEnd,
        applySegmentation
      };
      
      // Log the request payload for debugging
      console.log('Request payload:', payload);
      
      const response = await fetch('/api/gee/severity-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      // Get response text for debugging
      const responseText = await response.text();
      
      if (!response.ok) {
        // Try to parse the error response as JSON
        let errorMessage = `API error: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If parsing fails, use the raw response text
          debugInfo = responseText;
        }
        throw new Error(errorMessage);
      }
      
      // Parse the successful response
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Invalid JSON response from server');
      }
      
      if (data.maps && data.maps.length > 0) {
        severityMaps = data.maps;
        
        // Use placeholder images for testing
        severityMaps = severityMaps.map(map => ({
          ...map,
          previewUrl: map.previewUrl || `https://via.placeholder.com/300x200?text=${encodeURIComponent(map.name)}`
        }));
        
        dispatch('mapsGenerated', { maps: severityMaps });
      } else {
        error = 'No severity maps were generated';
        debugInfo = JSON.stringify(data, null, 2);
      }
    } catch (err) {
      console.error('Error generating severity maps:', err);
      error = err.message || 'Failed to generate severity maps';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="severity-mapper">
  {#if !geometry}
    <div class="info-message">
      <p>Select a burned area on the map or draw a polygon to define the area of interest.</p>
    </div>
  {:else if !satellite}
    <div class="info-message">
      <p>Select a satellite/sensor to continue.</p>
    </div>
  {:else}
    <div class="severity-controls">
      <button 
        class="generate-button" 
        on:click={generateSeverityMaps} 
        disabled={isLoading || !geometry || !satellite}
      >
        {isLoading ? 'Generating...' : 'Generate Severity Map'}
      </button>
      
      <div class="date-info">
        <div class="date-group">
          <span class="date-label">Pre-fire:</span>
          <span class="date-value">{formattedPreFire}</span>
        </div>
        <div class="date-group">
          <span class="date-label">Post-fire:</span>
          <span class="date-value">{formattedPostFire}</span>
        </div>
      </div>
    </div>
    
    {#if error}
      <div class="error-message">
        <p>API error: {error}</p>
        {#if debugInfo}
          <details>
            <summary>Debug Information</summary>
            <pre>{debugInfo}</pre>
          </details>
        {/if}
      </div>
    {/if}
    
    {#if isLoading}
      <div class="loading-indicator">
        <div class="spinner"></div>
        <p>Generating severity maps...</p>
        <p class="loading-info">This may take a few minutes depending on the size of the area and selected date range.</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .severity-mapper {
    width: 100%;
    padding: 1rem;
  }
  
  .info-message, .error-message {
    padding: 1rem;
    border-radius: var(--border-radius);
    margin-bottom: 1rem;
  }
  
  .info-message {
    background-color: rgba(0, 0, 0, 0.05);
    border: 1px solid var(--border-color);
  }
  
  .error-message {
    background-color: rgba(250, 82, 82, 0.1);
    border: 1px solid #fa5252;
    color: #fa5252;
    padding: 1rem;
    border-radius: 0.5rem;
    margin: 1rem 0;
  }
  
  .error-message details {
    margin-top: 0.5rem;
  }
  
  .error-message pre {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 0.5rem;
    border-radius: 0.25rem;
    overflow-x: auto;
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }
  
  .severity-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .generate-button {
    background: #4263EB;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 5px rgba(66, 99, 235, 0.2);
    width: fit-content;
  }
  
  .generate-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(66, 99, 235, 0.3);
  }
  
  .generate-button:disabled {
    background: #adb5bd;
    cursor: not-allowed;
    box-shadow: none;
  }
  
  .date-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: 1rem;
  }
  
  .date-group {
    display: flex;
    gap: 0.5rem;
  }
  
  .date-label {
    font-weight: 600;
    min-width: 70px;
  }
  
  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: #4263EB;
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 1rem;
  }
  
  .loading-info {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  @media (min-width: 768px) {
    .severity-controls {
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
    }
    
    .generate-button {
      flex-shrink: 0;
    }
  }
</style>