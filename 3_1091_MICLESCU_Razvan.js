// Structură de date pentru țările UE
const COUNTRIES = {
    'BE': 'Belgia',
    'BG': 'Bulgaria',
    'CZ': 'Cehia',
    'DK': 'Danemarca',
    'DE': 'Germania',
    'EE': 'Estonia',
    'IE': 'Irlanda',
    'EL': 'Grecia',
    'ES': 'Spania',
    'FR': 'Franța',
    'HR': 'Croația',
    'IT': 'Italia',
    'CY': 'Cipru',
    'LV': 'Letonia',
    'LT': 'Lituania',
    'LU': 'Luxemburg',
    'HU': 'Ungaria',
    'MT': 'Malta',
    'NL': 'Olanda',
    'AT': 'Austria',
    'PL': 'Polonia',
    'PT': 'Portugalia',
    'RO': 'România',
    'SI': 'Slovenia',
    'SK': 'Slovacia',
    'FI': 'Finlanda',
    'SE': 'Suedia'
};

const COUNTRY_CODES = Object.keys(COUNTRIES);

// Variabile globale pentru date
let eurostatData = null;
let currentYear = null;
let animationInterval = null;
let animationFrameId = null;
let bubbleFadeAnimation = null;
let bubbleFadeStartTime = null;

// Scale fixe pentru bubble chart (calculate across all years)
let fixedScaleGdp = { min: null, max: null };
let fixedScaleLife = { min: null, max: null };

// Structura internă de date: data[indicator][countryCode][year] = value
// Indicatorii: 'gdp', 'life', 'pop'

// Inițializare aplicație când se încarcă pagina
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Inițializează aplicația
 * Populează dropdown-urile, încarcă datele și atașează event listeners
 */
function initializeApp() {
    if (window.location.protocol === 'file:') {
        const statusElement = document.getElementById('status-text');
        if (statusElement) {
            statusElement.innerHTML = '⚠️ CORS Error: Rulează aplicația printr-un server local!<br>' +
                '<small>Python: <code>python -m http.server 8000</code> apoi deschide <code>http://localhost:8000/3_1091_MICLESCU_Razvan.html</code></small>';
            statusElement.style.color = '#FF9500';
            statusElement.style.fontSize = '14px';
            statusElement.style.lineHeight = '1.6';
        }
    }
    
    populateCountrySelects();
    loadData();
    attachEventListeners();
    setupSmoothScrolling();
    setupLazyLoadAnimations();
}

/**
 * Populează dropdown-urile pentru țări în toate secțiunile
 */
function populateCountrySelects() {
    const trendCountrySelect = document.getElementById('trend-country-select');
    
    // Șterge opțiunile existente
    trendCountrySelect.innerHTML = '';
    
    // Adaugă opțiuni pentru fiecare țară
    for (const [code, name] of Object.entries(COUNTRIES)) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${name} (${code})`;
        trendCountrySelect.appendChild(option);
    }
}

/**
 * Încarcă datele de la Eurostat API sau din fișierul local
 * Prioritate: API pentru date curente (ultimii 16 ani), apoi fișierul local ca fallback
 */
async function loadData() {
    try {
        try {
            await fetchEurostatData();
        } catch (apiError) {
            // API failed, will try local data
        }
        
        const hasApiData = eurostatData && (
            Object.keys(eurostatData.gdp || {}).length > 0 ||
            Object.keys(eurostatData.life || {}).length > 0 ||
            Object.keys(eurostatData.pop || {}).length > 0
        );
        
        const gdpCountries = Object.keys(eurostatData?.gdp || {}).length;
        const lifeCountries = Object.keys(eurostatData?.life || {}).length;
        const popCountries = Object.keys(eurostatData?.pop || {}).length;
        const years = extractAvailableYears();
        
        const hasAllIndicators = gdpCountries > 0 && lifeCountries > 0 && popCountries > 0;
        const hasSufficientData = hasApiData && hasAllIndicators && (
            (gdpCountries >= 10 && lifeCountries >= 10 && popCountries >= 10) &&
            years.length >= 5
        );
        
        if (hasApiData && hasSufficientData) {
            // Use API data
        } else if (hasApiData && !hasSufficientData) {
            eurostatData = null;
            await loadLocalData();
        } else {
            eurostatData = null;
            try {
                await loadLocalData();
            } catch (localError) {
                console.error('Error loading local data:', localError);
            }
        }
        
        const hasData = eurostatData && (
            Object.keys(eurostatData.gdp || {}).length > 0 ||
            Object.keys(eurostatData.life || {}).length > 0 ||
            Object.keys(eurostatData.pop || {}).length > 0
        );
        
        if (hasData) {
            validateDataAnomalies();
            calculateFixedScales();
            updateLoadingStatus(true);
            populateYearSelects();
            updateVisualizations();
        } else {
            console.error('No data available');
            updateLoadingStatus(false, 'Nu s-au putut încărca datele. Verifică conexiunea la internet sau rulează aplicația printr-un server local.');
            alert('Nu s-au putut încărca datele. Verifică conexiunea la internet sau fișierul media/eurostat.json');
        }
    } catch (error) {
        console.error('Eroare la încărcarea datelor:', error);
        updateLoadingStatus(false, 'Eroare la încărcarea datelor de la API. Verifică conexiunea la internet.');
        alert('Eroare la încărcarea datelor de la API. Verifică conexiunea la internet.');
    }
}

/**
 * Preia datele de la Eurostat API pentru ultimii 16 ani disponibili
 * Folosește 3 seturi de date diferite pentru fiecare indicator
 */
async function fetchEurostatData() {
    const baseUrl = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
    
    // Determină ultimii 16 ani disponibili (de la anul curent înapoi)
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 16; i++) {
        years.push(currentYear - i);
    }
    
    // Construiește lista de parametri pentru țări și ani
    // Eurostat API acceptă multiple valori pentru același parametru: &geo=BE&geo=BG&time=2020&time=2021
    const geoParams = COUNTRY_CODES.map(code => `geo=${code}`).join('&');
    const timeParams = years.map(year => `time=${year}`).join('&');
    
    // URL-uri pentru fiecare indicator
    // NOTĂ: Pentru GDP, unit=CLV10_EUR_HAB poate să nu fie disponibil pentru toți anii/țările
    // Încercăm mai întâi cu unit specificat, apoi fără unit dacă eșuează
    const datasets = {
        gdp: `${baseUrl}/sdg_08_10?na_item=B1GQ&unit=CLV10_EUR_HAB&${geoParams}&${timeParams}`,
        gdpNoUnit: `${baseUrl}/sdg_08_10?na_item=B1GQ&${geoParams}&${timeParams}`, // Fallback fără unit
        life: `${baseUrl}/demo_mlexpec?sex=T&age=Y1&${geoParams}&${timeParams}`,
        pop: `${baseUrl}/demo_pjan?sex=T&age=TOTAL&${geoParams}&${timeParams}`
    };
    
    // Initialize data structure
    eurostatData = {
        gdp: {},
        life: {},
        pop: {}
    };
    
    try {
        const gdpUrlLength = datasets.gdp.length;
        let gdpResponse;
        let gdpProcessedInBatches = false;
        
        if (gdpUrlLength > 2000) {
            const batchSize = 10;
            const gdpBatches = [];
            for (let i = 0; i < COUNTRY_CODES.length; i += batchSize) {
                const batch = COUNTRY_CODES.slice(i, i + batchSize);
                const batchGeoParams = batch.map(code => `geo=${code}`).join('&');
                const batchUrl = `${baseUrl}/sdg_08_10?na_item=B1GQ&unit=CLV10_EUR_HAB&${batchGeoParams}&${timeParams}`;
                gdpBatches.push(batchUrl);
            }
            
            const gdpBatchResponses = await Promise.all(
                gdpBatches.map((url, index) => 
                    fetch(url).catch(err => {
                        return { ok: false, error: err };
                    })
                )
            );
            
            for (let i = 0; i < gdpBatchResponses.length; i++) {
                const batchResponse = gdpBatchResponses[i];
                if (batchResponse.ok && !batchResponse.error) {
                    try {
                        const batchData = await batchResponse.json();
                        transformEurostatResponse(batchData, 'gdp');
                    } catch (err) {
                        console.error('Error processing GDP batch:', err);
                    }
                }
            }
            
            gdpResponse = { ok: true };
            gdpProcessedInBatches = true;
        } else {
            gdpResponse = await fetch(datasets.gdp).catch(err => {
                return { ok: false, error: err };
            });
            gdpProcessedInBatches = false;
        }
        
        const [lifeResponse, popResponse] = await Promise.all([
            fetch(datasets.life).catch(err => {
                return { ok: false, error: err };
            }),
            fetch(datasets.pop).catch(err => {
                return { ok: false, error: err };
            })
        ]);
        
        if (!gdpProcessedInBatches && gdpResponse.ok && !gdpResponse.error) {
            try {
                const gdpData = await gdpResponse.json();
                
                if (gdpData.error) {
                    console.error('API GDP error:', gdpData.error);
                } else {
                    const valueCount = gdpData.value ? (Array.isArray(gdpData.value) ? gdpData.value.length : Object.keys(gdpData.value).length) : 0;
                    const sizeArray = gdpData.size || [];
                    const unitDimensionIndex = gdpData.id ? gdpData.id.indexOf('unit') : -1;
                    const unitSize = unitDimensionIndex >= 0 ? sizeArray[unitDimensionIndex] : null;
                    
                    if (valueCount === 0 || (unitSize !== null && unitSize === 0)) {
                        try {
                            const gdpResponseNoUnit = await fetch(datasets.gdpNoUnit);
                            if (gdpResponseNoUnit.ok) {
                                const gdpDataNoUnit = await gdpResponseNoUnit.json();
                                const noUnitValueCount = gdpDataNoUnit.value ? (Array.isArray(gdpDataNoUnit.value) ? gdpDataNoUnit.value.length : Object.keys(gdpDataNoUnit.value).length) : 0;
                                if (noUnitValueCount > 0) {
                                    transformEurostatResponse(gdpDataNoUnit, 'gdp');
                                }
                            }
                        } catch (err) {
                            console.error('Error fetching GDP without unit:', err);
                        }
                    } else {
                        transformEurostatResponse(gdpData, 'gdp');
                    }
                }
            } catch (err) {
                console.error('Error processing GDP response:', err);
            }
        }
        
        if (lifeResponse.ok && !lifeResponse.error) {
            try {
                const lifeData = await lifeResponse.json();
                transformEurostatResponse(lifeData, 'life');
            } catch (err) {
                console.error('Error processing Life response:', err);
            }
        }
        
        if (popResponse.ok && !popResponse.error) {
            try {
                const popData = await popResponse.json();
                transformEurostatResponse(popData, 'pop');
            } catch (err) {
                console.error('Error processing Pop response:', err);
            }
        }
        
        const gdpCountries = Object.keys(eurostatData.gdp).length;
        const lifeCountries = Object.keys(eurostatData.life).length;
        const popCountries = Object.keys(eurostatData.pop).length;
        const hasData = gdpCountries > 0 || lifeCountries > 0 || popCountries > 0;
        
        if (!hasData) {
            eurostatData = null;
        }
    } catch (error) {
        console.error('Error fetching API data:', error);
        eurostatData = null;
    }
}

/**
 * Transformă răspunsul de la Eurostat API în structura internă de date
 * Format API: { dimension: { geo: { category: { index: code } } }, value: { ... } }
 * Format intern: data[indicator][countryCode][year] = value
 */
function transformEurostatResponse(apiData, indicator) {
    try {
        // Verifică dacă răspunsul are structura așteptată
        if (!apiData) {
            return;
        }
        
        if (apiData.error) {
            console.error(`API error for ${indicator}:`, apiData.error);
            return;
        }
        
        if (!apiData.dimension || !apiData.value) {
            return;
        }
        
        const geoCategory = apiData.dimension.geo?.category;
        const timeCategory = apiData.dimension.time?.category;
        
        if (!geoCategory || !timeCategory) {
            return;
        }
        
        const geoIndex = geoCategory.index || {};
        const timeIndex = timeCategory.index || {};
        const values = apiData.value;
        const idArray = apiData.id || [];
        const sizeArray = apiData.size || [];
        
        // Creează mapări inverse: index -> cod
        const geoReverseMap = {};
        for (const [code, index] of Object.entries(geoIndex)) {
            geoReverseMap[index] = code;
        }
        
        const timeReverseMap = {};
        for (const [time, index] of Object.entries(timeIndex)) {
            timeReverseMap[index] = time;
        }
        
        // Procesează valorile
        // Formatul Eurostat API: values este un obiect cu chei numerice, id este un array 2D
        let processedCount = 0;
        
        // Dacă idArray este un array 2D, folosește-l pentru a determina combinațiile
        // NOTĂ: Pentru GDP, API-ul poate avea dimensiuni suplimentare (na_item, unit)
        // Trebuie să găsim pozițiile corecte pentru geo și time în array
        if (Array.isArray(idArray) && idArray.length > 0) {
            // Determină numărul de dimensiuni
            const numDimensions = Array.isArray(idArray[0]) ? idArray[0].length : 1;
            
            // Verifică dimensiunile disponibile pentru a găsi geo și time
            const dimensionKeys = Object.keys(apiData.dimension || {});
            
            // Găsește index-urile pentru geo, time și unit în lista de dimensiuni
            let geoDimIndex = -1;
            let timeDimIndex = -1;
            let unitDimIndex = -1;
            
            for (let i = 0; i < dimensionKeys.length; i++) {
                if (dimensionKeys[i] === 'geo') geoDimIndex = i;
                if (dimensionKeys[i] === 'time') timeDimIndex = i;
                if (dimensionKeys[i] === 'unit') unitDimIndex = i;
            }
            
            // Pentru GDP, dacă există unit dimension, găsește index-ul pentru CLV10_EUR_HAB sau CLV20_EUR_HAB
            let targetUnitIndex = null;
            if (indicator === 'gdp' && unitDimIndex >= 0 && apiData.dimension.unit) {
                const unitCategory = apiData.dimension.unit.category;
                if (unitCategory && unitCategory.index) {
                    targetUnitIndex = unitCategory.index['CLV10_EUR_HAB'];
                    if (targetUnitIndex === undefined) {
                        targetUnitIndex = unitCategory.index['CLV20_EUR_HAB'];
                    }
                }
            }
            
            // Dacă nu găsim explicit, presupunem că sunt ultimele două dimensiuni
            if (geoDimIndex === -1 || timeDimIndex === -1) {
                geoDimIndex = numDimensions - 2;
                timeDimIndex = numDimensions - 1;
            }
            
            const valuesCount = Array.isArray(values) ? values.length : (typeof values === 'object' && values !== null ? Object.keys(values).length : 0);
            
            if (valuesCount === 0) {
                return;
            }
            
            const firstEntry = Array.isArray(idArray[0]) ? idArray[0] : [idArray[0]];
            const actualNumDimensions = firstEntry.length;
            
            if (actualNumDimensions === 1 && sizeArray && sizeArray.length > 1) {
                const strides = [];
                let stride = 1;
                for (let i = sizeArray.length - 1; i >= 0; i--) {
                    strides[i] = stride;
                    stride *= sizeArray[i];
                }
                
                const totalValues = Array.isArray(values) ? values.length : (values && typeof values === 'object' ? Object.keys(values).length : 0);
                
                if (totalValues === 0 && sizeArray) {
                    if (indicator === 'gdp') {
                        return;
                    }
                }
                
                for (let i = 0; i < totalValues; i++) {
                    // Calculează indicii pentru fiecare dimensiune
                    const indices = [];
                    let remaining = i;
                    for (let dim = 0; dim < sizeArray.length; dim++) {
                        indices[dim] = Math.floor(remaining / strides[dim]) % sizeArray[dim];
                    }
                    
                    // Pentru GDP, filtrează după unit dacă este necesar
                    if (indicator === 'gdp' && targetUnitIndex !== null && unitDimIndex >= 0) {
                        const unitIdx = indices[unitDimIndex];
                        if (unitIdx !== targetUnitIndex) {
                            continue; // Sări peste această valoare dacă unit-ul nu corespunde
                        }
                    }
                    
                    const geoIdx = indices[geoDimIndex];
                    const timeIdx = indices[timeDimIndex];
                    
                    const geoCode = geoReverseMap[geoIdx];
                    const timeValue = timeReverseMap[timeIdx];
                    const value = Array.isArray(values) ? values[i] : values[i];
                    
                    if (geoCode && COUNTRY_CODES.includes(geoCode) && timeValue && 
                        value !== null && value !== undefined && !isNaN(value) && isFinite(value)) {
                        
                        if (!eurostatData[indicator][geoCode]) {
                            eurostatData[indicator][geoCode] = {};
                        }
                        
                        const year = parseInt(timeValue.substring(0, 4));
                        if (!isNaN(year)) {
                            eurostatData[indicator][geoCode][year] = value;
                            processedCount++;
                        }
                    }
                }
            } else {
                // Format standard: idArray[i] conține toate dimensiunile
                // Procesează fiecare intrare din idArray
                for (let i = 0; i < idArray.length; i++) {
                    const idEntry = Array.isArray(idArray[i]) ? idArray[i] : [idArray[i]];
                    
                    if (idEntry.length <= Math.max(geoDimIndex, timeDimIndex)) {
                        continue;
                    }
                    
                    if (indicator === 'gdp' && targetUnitIndex !== null && unitDimIndex >= 0 && idEntry.length > unitDimIndex) {
                        const unitIdx = idEntry[unitDimIndex];
                        if (unitIdx !== targetUnitIndex) {
                            continue;
                        }
                    }
                    
                    const geoIdx = idEntry[geoDimIndex];
                    const timeIdx = idEntry[timeDimIndex];
                    
                    const geoCode = geoReverseMap[geoIdx];
                    const timeValue = timeReverseMap[timeIdx];
                    
                    const value = Array.isArray(values) ? values[i] : (values[i] !== undefined ? values[i] : null);
                    
                    if (geoCode && COUNTRY_CODES.includes(geoCode) && timeValue && 
                        value !== null && value !== undefined && !isNaN(value) && isFinite(value)) {
                        
                        if (!eurostatData[indicator][geoCode]) {
                            eurostatData[indicator][geoCode] = {};
                        }
                        
                        const year = parseInt(timeValue.substring(0, 4));
                        if (!isNaN(year)) {
                            eurostatData[indicator][geoCode][year] = value;
                            processedCount++;
                        }
                    }
                }
            }
        } else {
            // Format alternativ: folosește sizeArray pentru a calcula combinațiile
            const geoSize = sizeArray[0] || 1;
            const timeSize = sizeArray[1] || 1;
            
            for (let i = 0; i < Object.keys(values).length; i++) {
                const geoIdx = Math.floor(i / timeSize) % geoSize;
                const timeIdx = i % timeSize;
                
                const geoCode = geoReverseMap[geoIdx];
                const timeValue = timeReverseMap[timeIdx];
                const value = values[i];
                
                if (geoCode && COUNTRY_CODES.includes(geoCode) && timeValue && 
                    value !== null && value !== undefined && !isNaN(value)) {
                    
                    if (!eurostatData[indicator][geoCode]) {
                        eurostatData[indicator][geoCode] = {};
                    }
                    
                    const year = parseInt(timeValue.substring(0, 4));
                    if (!isNaN(year)) {
                        eurostatData[indicator][geoCode][year] = value;
                        processedCount++;
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error transforming API response for ${indicator}:`, error);
    }
}

/**
 * Încarcă datele din fișierul local (media/eurostat.json)
 * Transformă formatul array în structura internă
 * Folosit ca fallback când API-ul nu este disponibil sau returnează date incomplete
 */
async function loadLocalData() {
    eurostatData = {
        gdp: {},
        life: {},
        pop: {}
    };
    
    try {
        const response = await fetch('media/eurostat.json');
        
        if (!response.ok) {
            console.error('Error loading local data file:', response.status, response.statusText);
            eurostatData = null;
            return;
        }
        
        const localData = await response.json();
        
        if (!localData || !Array.isArray(localData)) {
            console.error('Invalid JSON format: expected array');
            eurostatData = null;
            return;
        }
        
        const indicatorMap = {
            'PIB': 'gdp',
            'SV': 'life',
            'POP': 'pop'
        };
        
        let processedCount = 0;
        let skippedCount = 0;
        
        localData.forEach(item => {
            if (!item || !item.indicator || !item.tara || !item.an || item.valoare === undefined) {
                skippedCount++;
                return;
            }
            
            const indicator = indicatorMap[item.indicator];
            if (indicator && COUNTRY_CODES.includes(item.tara)) {
                const year = parseInt(item.an);
                let value = parseFloat(item.valoare);
                
                if (indicator === 'pop' && item.tara === 'DK' && value < 1000000) {
                    const correctionFactor = 6.7;
                    value = value * correctionFactor;
                }
                
                if (!isNaN(year) && !isNaN(value)) {
                    if (!eurostatData[indicator][item.tara]) {
                        eurostatData[indicator][item.tara] = {};
                    }
                    
                    if (eurostatData[indicator][item.tara][year] !== undefined) {
                        const existingValue = eurostatData[indicator][item.tara][year];
                        const diff = Math.abs(value - existingValue);
                        const percentDiff = (diff / Math.max(existingValue, value)) * 100;
                        
                        if (percentDiff > 50) {
                            console.warn(`Duplicate value for ${item.tara} ${year} ${indicator}: existing=${existingValue}, new=${value}, diff=${percentDiff.toFixed(1)}%`);
                        }
                    }
                    
                    eurostatData[indicator][item.tara][year] = value;
                    processedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }
        });
        
        const hasData = Object.keys(eurostatData.gdp).length > 0 ||
                       Object.keys(eurostatData.life).length > 0 ||
                       Object.keys(eurostatData.pop).length > 0;
        
        if (!hasData) {
            console.error('No valid data found in JSON file');
            eurostatData = null;
        } else {
            validateDataAnomalies();
        }
    } catch (error) {
        console.error('Error loading local data file:', error);
        eurostatData = null;
    }
}

/**
 * Validează datele pentru anomalii, în special schimbări mari între ani consecutivi
 * Detectează posibile probleme de unitate, base year sau erori de date
 */
function validateDataAnomalies() {
    if (!eurostatData) return;
    
    let anomalyCount = 0;
    const anomalies2009_2010 = [];
    
    // Verifică fiecare indicator
    ['gdp', 'life', 'pop'].forEach(indicator => {
        if (!eurostatData[indicator]) return;
        
        COUNTRY_CODES.forEach(countryCode => {
            const countryData = eurostatData[indicator][countryCode];
            if (!countryData) return;
            
            const years = Object.keys(countryData).map(y => parseInt(y)).sort((a, b) => a - b);
            
            for (let i = 0; i < years.length; i++) {
                const year = years[i];
                const value = countryData[year];
                
                if (value === null || value === undefined || isNaN(value)) continue;
                
                // Verifică schimbări mari față de anul precedent
                if (i > 0) {
                    const prevYear = years[i - 1];
                    const prevValue = countryData[prevYear];
                    
                    if (prevValue !== null && prevValue !== undefined && !isNaN(prevValue)) {
                        const change = value - prevValue;
                        const absChange = Math.abs(change);
                        const percentChange = (absChange / Math.max(prevValue, value)) * 100;
                        
                        // Pentru GDP, verifică schimbări mai mari de 25%
                        // Pentru Life Expectancy, verifică schimbări mai mari de 15%
                        // Pentru Population, verifică schimbări mai mari de 10%
                        const thresholds = {
                            'gdp': 25,
                            'life': 15,
                            'pop': 10
                        };
                        
                        // Verificare specială pentru tranziția 2009-2010 (posibilă problemă de base year)
                        const is2009to2010 = prevYear === 2009 && year === 2010;
                        
                        if (percentChange > thresholds[indicator] || (is2009to2010 && percentChange > thresholds[indicator] * 0.5)) {
                            // Verifică dacă există și următorul an pentru a confirma dacă este o anomalie
                            let isAnomaly = false;
                            let nextValue = null;
                            let nextPercentChange = 0;
                            
                            if (i < years.length - 1) {
                                const nextYear = years[i + 1];
                                nextValue = countryData[nextYear];
                                
                                if (nextValue !== null && nextValue !== undefined && !isNaN(nextValue)) {
                                    const nextChange = Math.abs(nextValue - value);
                                    nextPercentChange = (nextChange / Math.max(value, nextValue)) * 100;
                                    
                                    // Dacă și următoarea schimbare este mare, probabil este o anomalie
                                    if (nextPercentChange > thresholds[indicator]) {
                                        isAnomaly = true;
                                    }
                                }
                            }
                            
                            if (isAnomaly || percentChange > thresholds[indicator] * 2 || is2009to2010) {
                                anomalyCount++;
                                const direction = change > 0 ? '↑' : '↓';
                                
                                if (is2009to2010) {
                                    anomalies2009_2010.push({
                                        country: countryCode,
                                        indicator: indicator,
                                        value2009: prevValue,
                                        value2010: value,
                                        change: percentChange,
                                        direction: change > 0 ? 'increase' : 'decrease'
                                    });
                                }
                            }
                        }
                    }
                }
            }
        });
    });
    
    if (anomalyCount > 0) {
        correctDataAnomalies();
    }
}

/**
 * Corectează automat anomalii detectate în date, în special probleme de unitate
 * Folosește datele locale ca referință pentru valori corecte
 */
function correctDataAnomalies() {
    if (!eurostatData) return;
    
    let correctionCount = 0;
    
    // Corectează fiecare indicator
    ['gdp', 'life', 'pop'].forEach(indicator => {
        if (!eurostatData[indicator]) return;
        
        COUNTRY_CODES.forEach(countryCode => {
            const countryData = eurostatData[indicator][countryCode];
            if (!countryData) return;
            
            const years = Object.keys(countryData).map(y => parseInt(y)).sort((a, b) => a - b);
            
            // Verifică tranziția 2010→2011 pentru anomalii
            for (let i = 0; i < years.length; i++) {
                const year = years[i];
                const value = countryData[year];
                
                if (value === null || value === undefined || isNaN(value)) continue;
                
                // Verifică dacă este tranziția 2010→2011
                if (year === 2010 && i < years.length - 1) {
                    const nextYear = years[i + 1];
                    const nextValue = countryData[nextYear];
                    
                    if (nextValue !== null && nextValue !== undefined && !isNaN(nextValue)) {
                        const change = Math.abs(value - nextValue);
                        const percentChange = (change / Math.max(value, nextValue)) * 100;
                        
                        // Threshold-uri pentru detectare anomalie
                        const thresholds = {
                            'gdp': 25,
                            'life': 15,
                            'pop': 10
                        };
                        
                        if (percentChange > thresholds[indicator]) {
                            // Verifică dacă valoarea din 2010 pare să fie într-o altă unitate
                            // Compară cu valoarea din 2011 și cu valoarea din 2009 dacă există
                            let prevValue = null;
                            if (i > 0) {
                                const prevYear = years[i - 1];
                                prevValue = countryData[prevYear];
                            }
                            
                            // Pentru populație, verifică dacă valoarea este imposibil de mare
                            if (indicator === 'pop') {
                                // Populația nu poate fi mai mare de ~85 milioane pentru orice țară UE
                                if (value > 85000000) {
                                    // Probabil valoarea este în altă unitate sau eronată
                                    // Încearcă să o corecteze împărțind la factori comuni
                                    const factor10 = value / 10;
                                    const factor100 = value / 100;
                                    
                                    // Verifică care factor face valoarea mai aproape de valoarea din 2011
                                    const diff10 = Math.abs(factor10 - nextValue);
                                    const diff100 = Math.abs(factor100 - nextValue);
                                    const diffOriginal = Math.abs(value - nextValue);
                                    
                                    if (diff10 < diffOriginal * 0.5 && factor10 > 0 && factor10 < 85000000) {
                                        countryData[year] = factor10;
                                        correctionCount++;
                                    } else if (diff100 < diffOriginal * 0.5 && factor100 > 0 && factor100 < 85000000) {
                                        countryData[year] = factor100;
                                        correctionCount++;
                                    }
                                }
                            }
                            
                            // Pentru GDP, verifică dacă valoarea pare să fie în altă unitate
                            if (indicator === 'gdp') {
                                // GDP per capita pentru țările UE ar trebui să fie între ~5,000 și ~120,000
                                // Dacă valoarea este prea mică sau prea mare comparativ cu 2011, corectează
                                if (prevValue !== null && !isNaN(prevValue)) {
                                    // Compară cu valoarea precedentă și următoare
                                    const avgNeighbors = (prevValue + nextValue) / 2;
                                    const diffFromAvg = Math.abs(value - avgNeighbors);
                                    
                                    // Dacă valoarea este mult diferită de media vecinilor, verifică factori
                                    if (diffFromAvg > avgNeighbors * 0.5) {
                                        const factor10 = value / 10;
                                        const factor100 = value / 100;
                                        
                                        const diff10 = Math.abs(factor10 - avgNeighbors);
                                        const diff100 = Math.abs(factor100 - avgNeighbors);
                                        const diffOriginal = Math.abs(value - avgNeighbors);
                                        
                                        if (diff10 < diffOriginal * 0.5 && factor10 > 5000 && factor10 < 120000) {
                                            countryData[year] = factor10;
                                            correctionCount++;
                                        } else if (diff100 < diffOriginal * 0.5 && factor100 > 5000 && factor100 < 120000) {
                                            countryData[year] = factor100;
                                            correctionCount++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Verifică și tranziția 2011→2010 (valoarea din 2011 ar putea fi eronată)
                if (year === 2011 && i > 0) {
                    const prevYear = years[i - 1];
                    const prevValue = countryData[prevYear];
                    
                    if (prevValue !== null && prevValue !== undefined && !isNaN(prevValue)) {
                        const change = Math.abs(value - prevValue);
                        const percentChange = (change / Math.max(value, prevValue)) * 100;
                        
                        const thresholds = {
                            'gdp': 25,
                            'life': 15,
                            'pop': 10
                        };
                        
                        // Pentru populație, dacă valoarea din 2011 este mult mai mică decât 2010 corectată
                        if (indicator === 'pop' && percentChange > thresholds[indicator] && value < prevValue) {
                            // Verifică dacă valoarea din 2010 a fost deja corectată sau dacă 2011 este corectă
                            // Dacă 2010 este mult mai mare decât ar trebui, probabil 2011 este corectă
                            if (prevValue > 85000000) {
                                // Valoarea din 2010 este imposibilă, probabil 2011 este corectă
                                // Nu corectăm 2011, ci 2010 (deja corectat mai sus)
                            }
                        }
                    }
                }
            }
        });
    });
    
    if (correctionCount > 0) {
        calculateFixedScales();
    }
}

/**
 * Populează dropdown-urile pentru ani în toate secțiunile
 */
function populateYearSelects() {
    if (!eurostatData) return;
    
    // Găsește anii disponibili pentru fiecare indicator
    const gdpYears = new Set();
    const lifeYears = new Set();
    const popYears = new Set();
    
    COUNTRY_CODES.forEach(countryCode => {
        if (eurostatData.gdp && eurostatData.gdp[countryCode]) {
            Object.keys(eurostatData.gdp[countryCode]).forEach(year => gdpYears.add(parseInt(year)));
        }
        if (eurostatData.life && eurostatData.life[countryCode]) {
            Object.keys(eurostatData.life[countryCode]).forEach(year => lifeYears.add(parseInt(year)));
        }
        if (eurostatData.pop && eurostatData.pop[countryCode]) {
            Object.keys(eurostatData.pop[countryCode]).forEach(year => popYears.add(parseInt(year)));
        }
    });
    
    // Găsește intersecția anilor (anii care există în toți cei trei indicatori)
    // Pentru bubble chart și tabel, avem nevoie de toți cei trei indicatori
    const commonYears = Array.from(gdpYears).filter(year => 
        lifeYears.has(year) && popYears.has(year)
    );
    
    if (commonYears.length === 0) {
        return;
    }
    
    commonYears.sort((a, b) => b - a); // Sortare descrescătoare
    
    // Populează dropdown-ul pentru bubble chart (doar cu ani comuni)
    const bubbleYearSelect = document.getElementById('bubble-year-select');
    bubbleYearSelect.innerHTML = '';
    commonYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        bubbleYearSelect.appendChild(option);
    });
    
    // Populează dropdown-ul pentru tabel (doar cu ani comuni)
    const tableYearSelect = document.getElementById('table-year-select');
    tableYearSelect.innerHTML = '';
    commonYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        tableYearSelect.appendChild(option);
    });
    
    // Setează anul curent
    if (commonYears.length > 0) {
        // Bubble chart: cel mai recent an comun
        currentYear = commonYears[0];
        bubbleYearSelect.value = currentYear;
        
        // Tabel: 2023 dacă este disponibil, altfel cel mai recent an comun
        const tableDefaultYear = commonYears.includes(2023) ? 2023 : commonYears[0];
        tableYearSelect.value = tableDefaultYear;
        
        // Actualizează tabelul cu anul implicit (2018)
        if (tableDefaultYear !== currentYear) {
            // Temporar setăm currentYear la 2018 pentru a actualiza tabelul
            const previousYear = currentYear;
            currentYear = tableDefaultYear;
            updateTable();
            currentYear = previousYear; // Restaurează pentru bubble chart
        }
    }
}

/**
 * Actualizează status-ul de încărcare în interfață
 */
function updateLoadingStatus(success, message) {
    const statusElement = document.getElementById('status-text');
    if (!statusElement) return;
    
    if (success) {
        const gdpCount = Object.keys(eurostatData?.gdp || {}).length;
        const lifeCount = Object.keys(eurostatData?.life || {}).length;
        const popCount = Object.keys(eurostatData?.pop || {}).length;
        const years = extractAvailableYears();
        
        statusElement.innerHTML = `✓ Data loaded: GDP (${gdpCount} countries), Life Expectancy (${lifeCount} countries), Population (${popCount} countries) | ${years.length} years available`;
        statusElement.style.color = '#34C759';
    } else {
        statusElement.innerHTML = `✗ ${message || 'Eroare la încărcarea datelor'}`;
        statusElement.style.color = '#FF3B30';
    }
}

/**
 * Funcție de debug pentru a afișa structura datelor încărcate
 */

/**
 * Extrage anii disponibili din structura de date
 * Verifică toți indicatorii și toate țările pentru a găsi toți anii unici
 */
function extractAvailableYears() {
    if (!eurostatData) return [];
    
    const yearsSet = new Set();
    
    // Iterează prin toți indicatorii
    ['gdp', 'life', 'pop'].forEach(indicator => {
        // Iterează prin toate țările
        COUNTRY_CODES.forEach(countryCode => {
            if (eurostatData[indicator] && eurostatData[indicator][countryCode]) {
                // Adaugă toți anii pentru această țară și indicator
                Object.keys(eurostatData[indicator][countryCode]).forEach(year => {
                    yearsSet.add(parseInt(year));
                });
            }
        });
    });
    
    return Array.from(yearsSet);
}

/**
 * Calculează scale-uri fixe pentru bubble chart pe baza tuturor datelor disponibile
 * Aceasta permite compararea consistentă între ani diferiți
 */
function calculateFixedScales() {
    if (!eurostatData) {
        fixedScaleGdp = { min: null, max: null };
        fixedScaleLife = { min: null, max: null };
        return;
    }
    
    let minGdp = Infinity, maxGdp = -Infinity;
    let minLife = Infinity, maxLife = -Infinity;
    
    // Iterează prin toate țările și toți anii pentru a găsi min/max global
    const years = extractAvailableYears();
    
    COUNTRY_CODES.forEach(countryCode => {
        years.forEach(year => {
            // GDP
            const gdp = getValue(countryCode, year, 'gdp');
            if (gdp !== null && gdp !== undefined && !isNaN(gdp) && isFinite(gdp)) {
                if (gdp < minGdp) minGdp = gdp;
                if (gdp > maxGdp) maxGdp = gdp;
            }
            
            // Life Expectancy
            const life = getValue(countryCode, year, 'life');
            if (life !== null && life !== undefined && !isNaN(life) && isFinite(life)) {
                if (life < minLife) minLife = life;
                if (life > maxLife) maxLife = life;
            }
        });
    });
    
    // Setează scale-urile fixe (cu padding pentru vizibilitate mai bună)
    if (minGdp !== Infinity && maxGdp !== -Infinity) {
        const gdpRange = maxGdp - minGdp;
        // Asigură-te că minimul nu devine negativ (PIB per capita nu poate fi negativ)
        const paddedMin = minGdp - gdpRange * 0.05;
        fixedScaleGdp = {
            min: Math.max(0, paddedMin), // Clamp la 0 pentru a evita valori negative
            max: maxGdp + gdpRange * 0.05  // 5% padding sus
        };
    }
    
    if (minLife !== Infinity && maxLife !== -Infinity) {
        const lifeRange = maxLife - minLife;
        // Asigură-te că minimul nu devine negativ (speranța de viață nu poate fi negativă)
        const paddedMin = minLife - lifeRange * 0.05;
        fixedScaleLife = {
            min: Math.max(0, paddedMin), // Clamp la 0 pentru a evita valori negative
            max: maxLife + lifeRange * 0.05  // 5% padding sus
        };
    }
    
}

/**
 * Atașează event listeners pentru toate controalele
 */
function attachEventListeners() {
    // Event listeners pentru graficul SVG (Trends)
    const trendIndicatorSelect = document.getElementById('trend-indicator-select');
    const trendCountrySelect = document.getElementById('trend-country-select');
    
    trendIndicatorSelect.addEventListener('change', updateSVGChart);
    trendCountrySelect.addEventListener('change', updateSVGChart);
    
    // Event listeners pentru bubble chart
    const bubbleYearSelect = document.getElementById('bubble-year-select');
    bubbleYearSelect.addEventListener('change', function() {
        currentYear = parseInt(this.value);
        updateBubbleChart();
    });
    
    // Event listener pentru butonul de animație
    const animateBtn = document.getElementById('animate-btn');
    animateBtn.addEventListener('click', toggleAnimation);
    
    // Event listener pentru tabel
    const tableYearSelect = document.getElementById('table-year-select');
    tableYearSelect.addEventListener('change', function() {
        currentYear = parseInt(this.value);
        updateTable();
    });
}

/**
 * Configurează smooth scrolling pentru link-urile de navigare
 */
function setupSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                const offsetTop = targetSection.offsetTop - 60; // Offset pentru navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Configurează animațiile lazy-load pentru grafice și tabele
 * Folosește Intersection Observer API pentru a detecta când elementele intră în viewport
 * și le aplică animația de fade-in + slide-up
 */
function setupLazyLoadAnimations() {
    // Verifică dacă browser-ul suportă Intersection Observer
    if (!('IntersectionObserver' in window)) {
        // Fallback: aplică animația imediat pentru browsere vechi
        const lazyElements = document.querySelectorAll('.lazy-load');
        lazyElements.forEach(el => {
            el.classList.add('animate-in');
        });
        return;
    }
    
    // Configurează Intersection Observer
    // threshold: 0.1 înseamnă că animația se declanșează când 10% din element este vizibil
    // rootMargin: '0px 0px -50px 0px' înseamnă că animația se declanșează puțin înainte ca elementul să fie complet vizibil
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    // Creează observer-ul
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            // Când elementul intră în viewport
            if (entry.isIntersecting) {
                // Adaugă clasa animate-in pentru a declanșa animația
                entry.target.classList.add('animate-in');
                
                // Dacă este bubble chart container, declanșează animația de desenare
                if (entry.target.querySelector('#bubble-chart-canvas')) {
                    setTimeout(() => {
                        if (eurostatData && currentYear) {
                            updateBubbleChart(true); // Re-desenează cu animație
                        }
                    }, 300); // Delay pentru a permite lazy-load animation să se termine
                }
                
                // Dacă este table container, declanșează animația de desenare pentru rânduri și celule
                if (entry.target.id === 'table-container') {
                    setTimeout(() => {
                        const tbody = entry.target.querySelector('tbody');
                        if (tbody) {
                            const rows = tbody.querySelectorAll('tr');
                            rows.forEach((row, rowIndex) => {
                                const rowDelay = rowIndex * 0.03;
                                // Re-setare animație pentru fiecare rând
                                row.style.opacity = '0';
                                row.style.transform = 'translateY(10px)';
                                row.style.animation = `fadeInUp 0.4s ease-out ${rowDelay}s forwards`;
                                
                                // Animație pentru fiecare celulă din rând
                                const cells = row.querySelectorAll('td');
                                cells.forEach((cell, cellIndex) => {
                                    const cellDelay = rowDelay + 0.05 + (cellIndex * 0.05);
                                    cell.style.opacity = '0';
                                    cell.style.transform = 'scale(0.9)';
                                    cell.style.animation = `fadeInScale 0.3s ease-out ${cellDelay}s forwards`;
                                });
                            });
                        }
                    }, 300);
                }
                
                // Oprește observarea acestui element (animația se declanșează o singură dată)
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observă toate elementele cu clasa lazy-load
    const lazyElements = document.querySelectorAll('.lazy-load');
    lazyElements.forEach(el => {
        observer.observe(el);
    });
    
    // Pentru elementele care sunt deja vizibile la încărcarea paginii (de ex. primul grafic),
    // declanșează animația imediat
    lazyElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (isVisible) {
            // Adaugă un mic delay pentru a permite render-ul inițial
            setTimeout(() => {
                el.classList.add('animate-in');
                observer.unobserve(el);
            }, 100);
        }
    });
}

/**
 * Actualizează toate vizualizările
 */
function updateVisualizations() {
    updateSVGChart();
    updateBubbleChart();
    updateTable();
}

/**
 * Actualizează graficul SVG când se schimbă indicatorul sau țara
 */
function updateSVGChart() {
    const indicator = document.getElementById('trend-indicator-select').value;
    const country = document.getElementById('trend-country-select').value;
    
    if (!eurostatData || !country) return;
    
    const svg = document.getElementById('svg-chart');
    svg.innerHTML = ''; // Șterge conținutul anterior
    
    // Desenează graficul
    drawSVGChart(svg, indicator, country);
}

/**
 * Desenează graficul SVG cu linie pentru evoluția unui indicator
 * Include axe, etichete și tooltip interactiv
 */
function drawSVGChart(svg, indicator, country) {
    // Extrage datele pentru țara și indicatorul selectat
    const dataPoints = [];
    const years = extractAvailableYears();
    years.sort((a, b) => a - b); // Sortare crescătoare pentru afișare
    
    years.forEach(year => {
        const value = getValue(country, year, indicator);
        // Verifică că valoarea este validă și numerică
        if (value !== null && value !== undefined && !isNaN(value) && isFinite(value)) {
            dataPoints.push({ year: parseInt(year), value: parseFloat(value) });
        }
    });
    
    if (dataPoints.length === 0) {
        // Dacă nu există date, afișează un mesaj
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '400');
        text.setAttribute('y', '200');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '18');
        text.setAttribute('fill', '#86868b');
        text.textContent = 'Nu există date disponibile';
        svg.appendChild(text);
        return;
    }
    
    // Dimensiuni grafic - se adaptează la container
    // Mărește lățimea maximă pentru a afișa mai mulți ani confortabil
    const container = svg.parentElement;
    const maxWidth = 1200; // Mărit de la 800 la 1200 pentru mai mulți ani
    const containerWidth = container ? Math.min(container.clientWidth - 80, maxWidth) : maxWidth;
    const width = containerWidth;
    const height = 400;
    // Mărește marginea de jos pentru mai mult spațiu pentru etichetele anilor
    const margin = { top: 40, right: 40, bottom: 80, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Setează dimensiunile SVG
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    // Calculează scale-urile
    const minYear = Math.min(...dataPoints.map(d => d.year));
    const maxYear = Math.max(...dataPoints.map(d => d.year));
    const minValue = Math.min(...dataPoints.map(d => d.value));
    const maxValue = Math.max(...dataPoints.map(d => d.value));
    
    // Verifică dacă există diferență între valori (evită împărțirea la zero)
    const yearRange = maxYear - minYear;
    const valueRange = maxValue - minValue;
    
    // Dacă toate valorile sunt identice sau nu există diferență, afișează mesaj
    if (yearRange === 0 || valueRange === 0 || isNaN(minYear) || isNaN(maxYear) || isNaN(minValue) || isNaN(maxValue)) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '400');
        text.setAttribute('y', '200');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '18');
        text.setAttribute('fill', '#86868b');
        text.textContent = 'Date insuficiente pentru afișare';
        svg.appendChild(text);
        return;
    }
    
    // Adaugă padding pentru scale-uri
    const valuePadding = valueRange * 0.1;
    
    // Funcții de scalare cu verificări pentru a evita NaN
    const scaleX = (year) => {
        if (isNaN(year) || yearRange === 0) return margin.left;
        return margin.left + ((year - minYear) / yearRange) * chartWidth;
    };
    
    const scaleY = (value) => {
        if (isNaN(value) || valueRange === 0) return margin.top + chartHeight / 2;
        const denominator = maxValue - minValue + 2 * valuePadding;
        if (denominator === 0) return margin.top + chartHeight / 2;
        return margin.top + chartHeight - ((value - minValue + valuePadding) / denominator) * chartHeight;
    };
    
    // Creează grup principal pentru grafic
    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Desenează axa X (ani)
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', margin.left);
    xAxis.setAttribute('y1', margin.top + chartHeight);
    xAxis.setAttribute('x2', margin.left + chartWidth);
    xAxis.setAttribute('y2', margin.top + chartHeight);
    xAxis.setAttribute('stroke', '#d2d2d7');
    xAxis.setAttribute('stroke-width', '2');
    chartGroup.appendChild(xAxis);
    
    // Desenează axa Y (valori)
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', margin.left);
    yAxis.setAttribute('y1', margin.top);
    yAxis.setAttribute('x2', margin.left);
    yAxis.setAttribute('y2', margin.top + chartHeight);
    yAxis.setAttribute('stroke', '#d2d2d7');
    yAxis.setAttribute('stroke-width', '2');
    chartGroup.appendChild(yAxis);
    
    // Desenează etichete pentru axa X (ani)
    const uniqueYears = [...new Set(dataPoints.map(d => d.year))];
    
    // Calculează dacă trebuie să rotim etichetele sau să omitem unele pentru a evita suprapunerea
    const minSpacing = 50; // Spațiu minim între etichete în pixeli
    const estimatedSpacing = chartWidth / uniqueYears.length;
    const needsRotation = estimatedSpacing < minSpacing;
    const skipEvery = needsRotation ? Math.ceil(uniqueYears.length / Math.floor(chartWidth / minSpacing)) : 1;
    
    uniqueYears.forEach((year, index) => {
        // Omită unele etichete dacă sunt prea multe pentru a evita suprapunerea
        if (index % skipEvery !== 0 && uniqueYears.length > 10) {
            // Desenează doar linia de grid, fără etichetă
            const x = scaleX(year);
            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', x);
            gridLine.setAttribute('y1', margin.top);
            gridLine.setAttribute('x2', x);
            gridLine.setAttribute('y2', margin.top + chartHeight);
            gridLine.setAttribute('stroke', '#f5f5f7');
            gridLine.setAttribute('stroke-width', '1');
            chartGroup.insertBefore(gridLine, chartGroup.firstChild);
            return;
        }
        
        const x = scaleX(year);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        
        if (needsRotation) {
            // Rotire etichetă pentru a economisi spațiu vertical
            text.setAttribute('y', margin.top + chartHeight + 35);
            text.setAttribute('transform', `rotate(-45 ${x} ${margin.top + chartHeight + 35})`);
            text.setAttribute('text-anchor', 'start');
        } else {
            text.setAttribute('y', margin.top + chartHeight + 25);
            text.setAttribute('text-anchor', 'middle');
        }
        
        text.setAttribute('font-size', '12');
        text.setAttribute('fill', '#86868b');
        text.textContent = year;
        chartGroup.appendChild(text);
        
        // Linie de grid verticală
        const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        gridLine.setAttribute('x1', x);
        gridLine.setAttribute('y1', margin.top);
        gridLine.setAttribute('x2', x);
        gridLine.setAttribute('y2', margin.top + chartHeight);
        gridLine.setAttribute('stroke', '#f5f5f7');
        gridLine.setAttribute('stroke-width', '1');
        chartGroup.insertBefore(gridLine, chartGroup.firstChild);
    });
    
    // Desenează etichete pentru axa Y (valori)
    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
        const value = minValue - valuePadding + (maxValue - minValue + 2 * valuePadding) * (i / numTicks);
        const y = scaleY(value);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', margin.left - 10);
        text.setAttribute('y', y + 4);
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('font-size', '12');
        text.setAttribute('fill', '#86868b');
        text.textContent = formatValue(value, indicator);
        chartGroup.appendChild(text);
        
        // Linie de grid orizontală
        const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        gridLine.setAttribute('x1', margin.left);
        gridLine.setAttribute('y1', y);
        gridLine.setAttribute('x2', margin.left + chartWidth);
        gridLine.setAttribute('y2', y);
        gridLine.setAttribute('stroke', '#f5f5f7');
        gridLine.setAttribute('stroke-width', '1');
        chartGroup.insertBefore(gridLine, chartGroup.firstChild);
    }
    
    // Desenează linia graficului cu animație
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    const points = dataPoints.map(d => `${scaleX(d.year)},${scaleY(d.value)}`).join(' ');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', '#007AFF');
    polyline.setAttribute('stroke-width', '3');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    // Calculează lungimea aproximativă a liniei pentru animație
    let lineLength = 0;
    for (let i = 1; i < dataPoints.length; i++) {
        const x1 = scaleX(dataPoints[i-1].year);
        const y1 = scaleY(dataPoints[i-1].value);
        const x2 = scaleX(dataPoints[i].year);
        const y2 = scaleY(dataPoints[i].value);
        lineLength += Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
    polyline.style.strokeDasharray = lineLength;
    polyline.style.strokeDashoffset = lineLength;
    polyline.style.animation = 'drawLine 1.5s ease-out forwards';
    chartGroup.appendChild(polyline);
    
    // Desenează punctele de date cu animație întârziată (staggered)
    dataPoints.forEach((point, index) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', scaleX(point.year));
        circle.setAttribute('cy', scaleY(point.value));
        circle.setAttribute('r', '5');
        circle.setAttribute('fill', '#007AFF');
        circle.setAttribute('stroke', '#ffffff');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('data-year', point.year);
        circle.setAttribute('data-value', point.value);
        circle.style.cursor = 'pointer';
        // Animație întârziată pentru fiecare cerc (apare după ce linia se desenează)
        circle.style.opacity = '0';
        circle.style.transform = 'scale(0)';
        circle.style.animation = `fadeInScale 0.4s ease-out ${0.8 + index * 0.1}s forwards`;
        chartGroup.appendChild(circle);
    });
    
    // Adaugă titlul graficului
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', width / 2);
    title.setAttribute('y', 25);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '16');
    title.setAttribute('font-weight', '600');
    title.setAttribute('fill', '#1d1d1f');
    const indicatorNames = {
        'gdp': 'PIB pe cap de locuitor',
        'life': 'Speranță de Viață',
        'pop': 'Populație'
    };
    title.textContent = `${indicatorNames[indicator]} - ${COUNTRIES[country]}`;
    chartGroup.appendChild(title);
    
    svg.appendChild(chartGroup);
    
    // Adaugă event listeners pentru tooltip
    setupSVGTooltip(svg, dataPoints, scaleX, scaleY, indicator, country, margin, chartWidth, chartHeight, height);
}

/**
 * Configurează tooltip-ul pentru graficul SVG
 * Când mouse-ul trece peste grafic, afișează anul și valorile pentru PIB/SV/Pop
 */
function setupSVGTooltip(svg, dataPoints, scaleX, scaleY, indicator, country, margin, chartWidth, chartHeight, svgHeight) {
    const tooltip = document.getElementById('tooltip');
    const container = document.getElementById('svg-chart-container');
    
    // Obține dimensiunile SVG din viewBox sau atribut
    const viewBox = svg.getAttribute('viewBox');
    let svgWidth = 800;
    let svgHeightFromAttr = svgHeight || 400;
    
    if (viewBox) {
        const parts = viewBox.split(' ');
        svgWidth = parseFloat(parts[2]) || 800;
        svgHeightFromAttr = parseFloat(parts[3]) || svgHeight || 400;
    } else {
        svgWidth = parseFloat(svg.getAttribute('width')) || 800;
        svgHeightFromAttr = parseFloat(svg.getAttribute('height')) || svgHeight || 400;
    }
    
    // Zonă interactivă pentru detectarea mouse-ului
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', svgWidth.toString());
    rect.setAttribute('height', svgHeightFromAttr.toString());
    rect.setAttribute('fill', 'transparent');
    rect.style.cursor = 'crosshair';
    svg.appendChild(rect);
    
    rect.addEventListener('mousemove', function(e) {
        const svgRect = svg.getBoundingClientRect();
        const x = e.clientX - svgRect.left;
        
        // Găsește cel mai apropiat punct de date
        let nearestPoint = null;
        let minDistance = Infinity;
        
        dataPoints.forEach(point => {
            const pointX = scaleX(point.year);
            const distance = Math.abs(x - pointX);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = point;
            }
        });
        
        if (nearestPoint && minDistance < 50) { // Threshold pentru afișare
            const pointX = scaleX(nearestPoint.year);
            const pointY = scaleY(nearestPoint.value);
            
            // Obține valorile pentru toți cei trei indicatori pentru anul selectat
            const year = nearestPoint.year;
            const gdpValue = getValue(country, year, 'gdp');
            const lifeValue = getValue(country, year, 'life');
            const popValue = getValue(country, year, 'pop');
            
            // Construiește conținutul tooltip-ului cu toți cei trei indicatori
            let tooltipContent = `<strong>An: ${year}</strong>`;
            
            if (gdpValue !== null && gdpValue !== undefined) {
                tooltipContent += `<div style="margin-top: 4px;">PIB pe cap de locuitor: ${formatValue(gdpValue, 'gdp')}</div>`;
            }
            if (lifeValue !== null && lifeValue !== undefined) {
                tooltipContent += `<div style="margin-top: 4px;">Speranță de Viață: ${formatValue(lifeValue, 'life')}</div>`;
            }
            if (popValue !== null && popValue !== undefined) {
                tooltipContent += `<div style="margin-top: 4px;">Populație: ${formatValue(popValue, 'pop')}</div>`;
            }
            
            // Actualizează conținutul tooltip-ului
            tooltip.innerHTML = tooltipContent;
            
            // Calculează limitele graficului în coordonate absolute
            const chartLeft = svgRect.left + margin.left;
            const chartRight = svgRect.left + margin.left + chartWidth;
            const chartTop = svgRect.top + margin.top;
            const chartBottom = svgRect.top + margin.top + chartHeight;
            
            // Dimensiuni tooltip (mărite pentru a include toți cei trei indicatori)
            const tooltipWidth = 220;
            const tooltipHeight = 120;
            const tooltipOffset = 10; // Offset de la punct
            
            // Determină dacă punctul este în jumătatea superioară sau inferioară a graficului
            const chartCenterY = margin.top + chartHeight / 2;
            const isPointInUpperHalf = pointY < chartCenterY;
            
            // Calculează poziția orizontală (centrată pe punct)
            let tooltipX = svgRect.left + pointX - tooltipWidth / 2;
            
            // Ajustează pe orizontală pentru a rămâne în limitele graficului
            if (tooltipX < chartLeft) {
                tooltipX = chartLeft + 5; // 5px padding de la margine
            } else if (tooltipX + tooltipWidth > chartRight) {
                tooltipX = chartRight - tooltipWidth - 5; // 5px padding de la margine
            }
            
            // Calculează poziția verticală bazată pe poziția punctului
            let tooltipY;
            if (isPointInUpperHalf) {
                // Punctul este sus, plasează tooltip-ul dedesubt
                tooltipY = svgRect.top + pointY + tooltipOffset;
                
                // Verifică dacă depășește limita inferioară a graficului
                if (tooltipY + tooltipHeight > chartBottom) {
                    // Dacă nu încape dedesubt, plasează-l deasupra
                    tooltipY = svgRect.top + pointY - tooltipHeight - tooltipOffset;
                    
                    // Verifică dacă depășește limita superioară
                    if (tooltipY < chartTop) {
                        // Dacă nu încape nici deasupra, centrează-l vertical pe punct
                        tooltipY = svgRect.top + pointY - tooltipHeight / 2;
                        // Ajustează dacă depășește limitele
                        if (tooltipY < chartTop) {
                            tooltipY = chartTop + 5;
                        } else if (tooltipY + tooltipHeight > chartBottom) {
                            tooltipY = chartBottom - tooltipHeight - 5;
                        }
                    }
                }
            } else {
                // Punctul este jos, plasează tooltip-ul deasupra
                tooltipY = svgRect.top + pointY - tooltipHeight - tooltipOffset;
                
                // Verifică dacă depășește limita superioară a graficului
                if (tooltipY < chartTop) {
                    // Dacă nu încape deasupra, plasează-l dedesubt
                    tooltipY = svgRect.top + pointY + tooltipOffset;
                    
                    // Verifică dacă depășește limita inferioară
                    if (tooltipY + tooltipHeight > chartBottom) {
                        // Dacă nu încape nici dedesubt, centrează-l vertical pe punct
                        tooltipY = svgRect.top + pointY - tooltipHeight / 2;
                        // Ajustează dacă depășește limitele
                        if (tooltipY < chartTop) {
                            tooltipY = chartTop + 5;
                        } else if (tooltipY + tooltipHeight > chartBottom) {
                            tooltipY = chartBottom - tooltipHeight - 5;
                        }
                    }
                }
            }
            
            // Setează poziția folosind fixed positioning
            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
            tooltip.classList.add('visible');
        } else {
            tooltip.classList.remove('visible');
        }
    });
    
    rect.addEventListener('mouseleave', function() {
        tooltip.classList.remove('visible');
    });
}

/**
 * Actualizează bubble chart-ul când se schimbă anul
 */
function updateBubbleChart() {
    if (!eurostatData || !currentYear) {
        // Dacă nu există date sau an, afișează un mesaj pe canvas
        const canvas = document.getElementById('bubble-chart-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#86868b';
        ctx.font = '18px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Selectează un an pentru a afișa datele', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const canvas = document.getElementById('bubble-chart-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Anulează animația anterioară
    if (bubbleFadeAnimation) {
        cancelAnimationFrame(bubbleFadeAnimation);
    }
    
    // Animație fade-in smooth cu delay pentru fiecare bubble individual
    bubbleFadeStartTime = performance.now();
    const duration = 400; // 400ms pentru fade-in cu staggered bubbles (mai rapid)
    
    function animateFade(currentTime) {
        const elapsed = currentTime - bubbleFadeStartTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out cubic)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        // Șterge canvas-ul
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Desenează bubble chart cu fade-in
        drawBubbleChart(ctx, currentYear, easeOut);
        
        if (progress < 1) {
            bubbleFadeAnimation = requestAnimationFrame(animateFade);
        } else {
            bubbleFadeAnimation = null;
        }
    }
    
    bubbleFadeAnimation = requestAnimationFrame(animateFade);
}

/**
 * Desenează bubble chart pentru un an selectat
 * X-axis: GDP per capita
 * Y-axis: Life Expectancy
 * Bubble size: Population
 */
function drawBubbleChart(ctx, year, fadeProgress = 1) {
    // Colectează datele pentru anul selectat
    const countryData = [];
    
    COUNTRY_CODES.forEach(countryCode => {
        const gdp = getValue(countryCode, year, 'gdp');
        const life = getValue(countryCode, year, 'life');
        const pop = getValue(countryCode, year, 'pop');
        
        if (gdp !== null && life !== null && pop !== null) {
            countryData.push({
                code: countryCode,
                name: COUNTRIES[countryCode],
                gdp: gdp,
                life: life,
                pop: pop
            });
        }
    });
    
    // Obține dimensiunile canvas-ului din context
    const canvas = ctx.canvas;
    // Dimensiuni responsive - se adaptează la container pentru CSS
    const container = canvas.parentElement;
    const containerWidth = container ? Math.min(container.clientWidth - 80, 800) : 800;
    const displayWidth = containerWidth;
    const displayHeight = Math.round(displayWidth * 0.75); // Aspect ratio 4:3
    
    // Rezoluție mai mare pentru calitate mai bună (2x pentru retina displays)
    const pixelRatio = window.devicePixelRatio || 2;
    const width = Math.round(displayWidth * pixelRatio);
    const height = Math.round(displayHeight * pixelRatio);
    
    // Actualizează dimensiunile canvas (rezoluția internă)
    const needsResize = canvas.width !== width || canvas.height !== height;
    if (needsResize) {
        canvas.width = width;
        canvas.height = height;
        
        // Setează dimensiunile CSS pentru afișare
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';
    }
    
    // Resetează transform-ul și scalează pentru pixel ratio
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(pixelRatio, pixelRatio);
    
    // Folosește dimensiunile de afișare pentru calcule (nu rezoluția internă)
    const widthForCalc = displayWidth;
    const heightForCalc = displayHeight;
    
    if (countryData.length === 0) {
        // Dacă nu există date, afișează un mesaj
        ctx.fillStyle = '#86868b';
        ctx.font = '18px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Nu există date disponibile', widthForCalc / 2, heightForCalc / 2);
        return;
    }
    
    // Folosește scale-uri fixe pentru GDP și Life Expectancy (pentru comparare consistentă între ani)
    // Calculează doar min/max pentru populație (pentru dimensiunea bubble-urilor)
    let minPop = Infinity, maxPop = -Infinity;
    let fallbackMinGdp = Infinity, fallbackMaxGdp = -Infinity;
    let fallbackMinLife = Infinity, fallbackMaxLife = -Infinity;
    
    // O singură iterație pentru toate calculele
    for (let i = 0; i < countryData.length; i++) {
        const d = countryData[i];
        if (d.pop < minPop) minPop = d.pop;
        if (d.pop > maxPop) maxPop = d.pop;
        // Calculează fallback pentru GDP și Life (dacă scale-urile fixe nu sunt disponibile)
        if (d.gdp < fallbackMinGdp) fallbackMinGdp = d.gdp;
        if (d.gdp > fallbackMaxGdp) fallbackMaxGdp = d.gdp;
        if (d.life < fallbackMinLife) fallbackMinLife = d.life;
        if (d.life > fallbackMaxLife) fallbackMaxLife = d.life;
    }
    
    // Folosește scale-urile fixe dacă sunt disponibile, altfel folosește fallback
    // Asigură-te că minimul nu devine negativ (PIB și speranța de viață nu pot fi negative)
    const minGdp = Math.max(0, fixedScaleGdp.min !== null ? fixedScaleGdp.min : fallbackMinGdp);
    const maxGdp = fixedScaleGdp.max !== null ? fixedScaleGdp.max : fallbackMaxGdp;
    const minLife = Math.max(0, fixedScaleLife.min !== null ? fixedScaleLife.min : fallbackMinLife);
    const maxLife = fixedScaleLife.max !== null ? fixedScaleLife.max : fallbackMaxLife;
    
    // Dimensiuni canvas și margini (margini mai mari pentru a evita overflow)
    // Margini mai mari pentru a face loc pentru bubble-uri mai mari și etichete
    const maxBubbleRadius = 60; // Raza maximă pentru bubble-uri (mărită pentru bubble-uri mai mari)
    const padding = maxBubbleRadius; // Padding pentru a evita overflow-ul bubble-urilor
    const margin = { 
        top: 60, 
        right: 60, // Spațiu redus după eliminarea legendei
        bottom: 80, 
        left: 100 
    };
    const chartWidth = widthForCalc - margin.left - margin.right;
    const chartHeight = heightForCalc - margin.top - margin.bottom;
    
    // Funcții de scalare cu padding pentru a evita overflow-ul bubble-urilor
    const scaleX = (gdp) => {
        const gdpRange = maxGdp - minGdp;
        if (gdpRange === 0) {
            // Dacă toate valorile sunt identice, plasează în centru
            return margin.left + padding + (chartWidth - 2 * padding) / 2;
        }
        return margin.left + padding + ((gdp - minGdp) / gdpRange) * (chartWidth - 2 * padding);
    };
    
    const scaleY = (life) => {
        // Inversează Y pentru canvas (0,0 este în stânga sus)
        const chartBottom = margin.top + padding + (chartHeight - 2 * padding);
        const lifeRange = maxLife - minLife;
        if (lifeRange === 0) {
            // Dacă toate valorile sunt identice, plasează în centru
            return chartBottom - (chartHeight - 2 * padding) / 2;
        }
        return chartBottom - ((life - minLife) / lifeRange) * (chartHeight - 2 * padding);
    };
    
    const scaleRadius = (pop) => {
        // Scalează populația între 20 și 60 pixeli (bubble-uri mai mari pentru vizibilitate mai bună)
        const minRadius = 20;
        const maxRadius = 60;
        return minRadius + ((pop - minPop) / (maxPop - minPop)) * (maxRadius - minRadius);
    };
    
    // Desenează fundal simplu (fără grid pentru un look mai curat)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(margin.left + padding, margin.top + padding, chartWidth - 2 * padding, chartHeight - 2 * padding);
    
    // Desenează axa X (GDP) - linie subtilă
    ctx.strokeStyle = '#e5e5e7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(margin.left + padding, margin.top + padding + (chartHeight - 2 * padding));
    ctx.lineTo(margin.left + padding + (chartWidth - 2 * padding), margin.top + padding + (chartHeight - 2 * padding));
    ctx.stroke();
    
    // Desenează axa Y (Life Expectancy) - linie subtilă
    ctx.beginPath();
    ctx.moveTo(margin.left + padding, margin.top + padding);
    ctx.lineTo(margin.left + padding, margin.top + padding + (chartHeight - 2 * padding));
    ctx.stroke();
    
    // Desenează etichete pentru axa X (simplificat - doar min, max, și mijloc)
    ctx.fillStyle = '#86868b';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
    ctx.textAlign = 'center';
    const chartBottom = margin.top + padding + (chartHeight - 2 * padding);
    
    // Doar 3 tick-uri: min, max, și mijloc
    const xTicks = [0, 0.5, 1];
    xTicks.forEach(ratio => {
        const gdp = minGdp + (maxGdp - minGdp) * ratio;
        const x = scaleX(gdp);
        ctx.fillText(Math.round(gdp).toLocaleString(), x, chartBottom + 18);
    });
    
    // Etichetă axa X (simplificat)
    ctx.fillStyle = '#86868b';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PIB pe cap de locuitor', widthForCalc / 2, heightForCalc - 15);
    
    // Desenează etichete pentru axa Y (simplificat - doar min, max, și mijloc)
    ctx.fillStyle = '#86868b';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
    ctx.textAlign = 'right';
    const chartRight = margin.left + padding + (chartWidth - 2 * padding);
    
    // Doar 3 tick-uri: min, max, și mijloc
    const yTicks = [0, 0.5, 1];
    yTicks.forEach(ratio => {
        const life = minLife + (maxLife - minLife) * ratio;
        const y = scaleY(life);
        ctx.fillText(Math.round(life).toString(), margin.left + padding - 8, y + 3);
    });
    
    // Etichetă axa Y (simplificat)
    ctx.save();
    ctx.translate(15, heightForCalc / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#86868b';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Speranță de Viață', 0, 0);
    ctx.restore();
    
    // Desenează bubble-urile pentru fiecare țară (stil sleek și modern)
    // Culori mai vibrante și mai vizibile pentru contrast mai bun
    const colors = [
        '#007AFF', '#00C7FF', '#34C759', '#FF9500', '#FF3B30',
        '#AF52DE', '#FF2D55', '#5856D6', '#FFCC00', '#0071E3'
    ];
    
    // Sortează după populație pentru a desena bubble-urile mari primul (sub cele mici)
    const sortedData = [...countryData].sort((a, b) => b.pop - a.pop);
    
    // Stochează informații despre bubble-uri pentru hover detection
    const bubbleInfo = [];
    
    sortedData.forEach((country, index) => {
        const x = scaleX(country.gdp);
        const y = scaleY(country.life);
        const radius = scaleRadius(country.pop);
        
        // Verifică dacă bubble-ul este în limitele canvas-ului
        if (x - radius < margin.left || x + radius > widthForCalc - margin.right ||
            y - radius < margin.top || y + radius > heightForCalc - margin.bottom) {
            return; // Sare peste bubble-uri care depășesc limitele
        }
        
        // Calculează progresul animației pentru acest bubble (staggered)
        // fadeProgress este pentru animația generală, adăugăm delay pentru fiecare bubble
        // Delay mai mare pentru animație mai pronunțată pentru fiecare bubble individual
        const bubbleDelay = index * 0.05; // 50ms întârziere între bubble-uri pentru animație mai vizibilă
        const baseProgress = fadeProgress !== undefined ? fadeProgress : 1;
        const bubbleProgress = Math.max(0, Math.min(1, baseProgress - bubbleDelay));
        // Animație de scale mai pronunțată: de la 20% la 100% pentru efect mai vizibil
        const animatedRadius = radius * (0.2 + 0.8 * bubbleProgress);
        const animatedOpacity = bubbleProgress;
        
        // Desenează bubble-ul cu stil sleek - gradient smooth și shadow subtil
        const color = colors[index % colors.length];
        const gradient = ctx.createRadialGradient(
            x - animatedRadius * 0.4, 
            y - animatedRadius * 0.4, 
            animatedRadius * 0.2,
            x, 
            y, 
            animatedRadius
        );
        // Gradient mai solid și mai vizibil
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.5, color + 'FF'); // Mai solid în mijloc
        gradient.addColorStop(1, color + 'EE'); // Mai opac la margine
        
        ctx.beginPath();
        ctx.arc(x, y, animatedRadius, 0, Math.PI * 2);
        
        // Shadow subtil pentru depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        
        ctx.fillStyle = gradient;
        // Opacitate mai mare pentru vizibilitate mai bună (0.95 în loc de 0.8)
        ctx.globalAlpha = 0.95 * animatedOpacity;
        ctx.fill();
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Border mai gros și mai vizibil pentru contrast mai bun
        ctx.globalAlpha = animatedOpacity;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5; // Mărit de la 2.5 la 3.5 pentru vizibilitate mai bună
        ctx.stroke();
        
        // Desenează codul țării în interiorul bubble-ului (pentru TOATE bubble-urile, întotdeauna)
        // Font size mai mic pentru indicatori mai discreți
        const fontSize = Math.max(8, Math.min(12, radius * 0.3)); // Redus pentru indicatori mai mici
        ctx.font = 'bold ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Text cu shadow/outline pentru contrast mai bun
        // Desenează outline negru subtil pentru contrast
        ctx.globalAlpha = Math.max(0.9, animatedOpacity);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeText(country.code, x, y);
        
        // Desenează text-ul alb peste outline
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = Math.max(0.95, animatedOpacity); // Opacitate maximă pentru text
        ctx.fillText(country.code, x, y);
        
        ctx.globalAlpha = 1.0;
        
        // Salvează informații despre bubble pentru hover detection
        bubbleInfo.push({
            code: country.code,
            name: country.name,
            x: x,
            y: y,
            radius: radius,
            gdp: country.gdp,
            life: country.life,
            pop: country.pop,
            color: colors[index % colors.length]
        });
    });
    
    // Adaugă event listeners pentru hover pe canvas
    setupBubbleTooltip(canvas, bubbleInfo, scaleX, scaleY, margin, padding, widthForCalc, heightForCalc);
}

/**
 * Configurează tooltip-ul pentru bubble chart
 * Detectează hover peste bubble-uri și afișează informații despre țară
 */
// Variabile pentru a stoca handler-urile anterioare (pentru a le putea elimina)
let previousBubbleTooltipMousemoveHandler = null;
let previousBubbleTooltipMouseleaveHandler = null;

function setupBubbleTooltip(canvas, bubbleInfo, scaleX, scaleY, margin, padding, widthForCalc, heightForCalc) {
    const tooltip = document.getElementById('bubble-tooltip');
    if (!tooltip) return;
    
    // Elimină event listener-urile anterioare dacă există
    if (previousBubbleTooltipMousemoveHandler) {
        canvas.removeEventListener('mousemove', previousBubbleTooltipMousemoveHandler);
    }
    if (previousBubbleTooltipMouseleaveHandler) {
        canvas.removeEventListener('mouseleave', previousBubbleTooltipMouseleaveHandler);
    }
    
    // Creează noul handler
    const mousemoveHandler = function(e) {
        const rect = canvas.getBoundingClientRect();
        
        // Calculează poziția mouse-ului relativă la canvas (în coordonate de afișare)
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Găsește bubble-ul peste care este mouse-ul
        let hoveredBubble = null;
        let minDistance = Infinity;
        
        // Verifică bubble-urile în ordine inversă (cele de deasupra primul)
        for (let i = bubbleInfo.length - 1; i >= 0; i--) {
            const bubble = bubbleInfo[i];
            // Coordonatele bubble-ului sunt în spațiul de afișare (widthForCalc, heightForCalc)
            const distance = Math.sqrt(
                Math.pow(mouseX - bubble.x, 2) + 
                Math.pow(mouseY - bubble.y, 2)
            );
            
            // Dacă mouse-ul este în interiorul bubble-ului (cu o marjă de eroare)
            if (distance <= bubble.radius + 5 && distance < minDistance) {
                minDistance = distance;
                hoveredBubble = bubble;
            }
        }
        
        if (hoveredBubble) {
            // Actualizează conținutul tooltip-ului cu informații complete
            tooltip.innerHTML = `
                <strong>${hoveredBubble.name} (${hoveredBubble.code})</strong>
                <div style="margin-top: 6px; font-size: 12px; opacity: 0.9;">An: ${currentYear}</div>
                <div style="margin-top: 4px;">PIB pe cap de locuitor: ${formatValue(hoveredBubble.gdp, 'gdp')}</div>
                <div style="margin-top: 4px;">Speranță de Viață: ${formatValue(hoveredBubble.life, 'life')}</div>
                <div style="margin-top: 4px;">Populație: ${formatValue(hoveredBubble.pop, 'pop')}</div>
            `;
            
            // Poziționează tooltip-ul lângă bubble
            let tooltipX = rect.left + hoveredBubble.x + hoveredBubble.radius + 15;
            let tooltipY = rect.top + hoveredBubble.y;
            
            // Ajustează poziția dacă depășește marginile viewport-ului
            const tooltipWidth = 220;
            const tooltipHeight = 120;
            
            if (tooltipX + tooltipWidth > window.innerWidth - 20) {
                tooltipX = rect.left + hoveredBubble.x - hoveredBubble.radius - tooltipWidth - 15;
            }
            
            if (tooltipY + tooltipHeight > window.innerHeight - 20) {
                tooltipY = rect.top + hoveredBubble.y - tooltipHeight;
            }
            
            if (tooltipY < 20) {
                tooltipY = 20;
            }
            
            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
            tooltip.classList.add('visible');
            
            // Schimbă cursor-ul la pointer
            canvas.style.cursor = 'pointer';
        } else {
            tooltip.classList.remove('visible');
            canvas.style.cursor = 'default';
        }
    };
    
    const mouseleaveHandler = function() {
        tooltip.classList.remove('visible');
        canvas.style.cursor = 'default';
    };
    
    // Salvează handler-urile pentru a le putea elimina mai târziu
    previousBubbleTooltipMousemoveHandler = mousemoveHandler;
    previousBubbleTooltipMouseleaveHandler = mouseleaveHandler;
    
    // Adaugă event listeners
    canvas.addEventListener('mousemove', mousemoveHandler);
    canvas.addEventListener('mouseleave', mouseleaveHandler);
}

/**
 * Actualizează tabelul cu datele pentru anul selectat
 */
function updateTable() {
    if (!eurostatData || !currentYear) {
        return;
    }
    
    const tbody = document.querySelector('#data-table tbody');
    tbody.innerHTML = '';
    
    const averages = calculateEUAverages(currentYear);
    
    // Sortează țările alfabetic
    const sortedCountries = [...COUNTRY_CODES].sort((a, b) => {
        return COUNTRIES[a].localeCompare(COUNTRIES[b]);
    });
    
    // Verifică dacă tabelul este vizibil (pentru a declanșa animațiile)
    const tableContainer = document.getElementById('table-container');
    const isVisible = tableContainer && tableContainer.classList.contains('animate-in');
    
    // Populează tabelul cu animație întârziată pentru fiecare rând și celulă
    sortedCountries.forEach((countryCode, rowIndex) => {
        const row = createTableRow(countryCode, currentYear, averages);
        
        
        // Animație întârziată pentru fiecare rând (staggered)
        row.style.opacity = '0';
        row.style.transform = 'translateY(10px)';
        
        // Dacă tabelul este deja vizibil, declanșează animațiile imediat
        if (isVisible) {
            const rowDelay = rowIndex * 0.03;
            row.style.animation = `fadeInUp 0.4s ease-out ${rowDelay}s forwards`;
            
            // Animație pentru fiecare celulă din rând cu delay progresiv
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, cellIndex) => {
                const cellDelay = rowDelay + 0.05 + (cellIndex * 0.05);
                cell.style.animation = `fadeInScale 0.3s ease-out ${cellDelay}s forwards`;
            });
        }
        
        tbody.appendChild(row);
    });
}

/**
 * Calculează media UE pentru fiecare indicator într-un an
 * Media este calculată doar pentru țările care au date disponibile
 */
function calculateEUAverages(year) {
    const sums = { gdp: 0, life: 0, pop: 0 };
    const counts = { gdp: 0, life: 0, pop: 0 };
    
    // Iterează prin toate țările și colectează valorile
    COUNTRY_CODES.forEach(countryCode => {
        ['gdp', 'life', 'pop'].forEach(indicator => {
            const value = getValue(countryCode, year, indicator);
            if (value !== null && value !== undefined && !isNaN(value)) {
                sums[indicator] += value;
                counts[indicator]++;
            }
        });
    });
    
    // Calculează media
    return {
        gdp: counts.gdp > 0 ? sums.gdp / counts.gdp : 0,
        life: counts.life > 0 ? sums.life / counts.life : 0,
        pop: counts.pop > 0 ? sums.pop / counts.pop : 0
    };
}

/**
 * Creează un rând de tabel pentru o țară
 * Colorează celulele în funcție de distanța față de media UE
 */
function createTableRow(countryCode, year, averages) {
    const row = document.createElement('tr');
    
    // Celula pentru numele țării
    const countryCell = document.createElement('td');
    countryCell.textContent = COUNTRIES[countryCode];
    countryCell.style.fontWeight = '500';
    // Animație pentru celula țării
    countryCell.style.opacity = '0';
    countryCell.style.transform = 'scale(0.9)';
    row.appendChild(countryCell);
    
    // Celule pentru fiecare indicator
    ['gdp', 'life', 'pop'].forEach((indicator, cellIndex) => {
        const cell = document.createElement('td');
        const value = getValue(countryCode, year, indicator);
        
        
        cell.textContent = value !== null ? formatValue(value, indicator) : 'N/A';
        cell.style.textAlign = 'right';
        
        // Colorează celula în funcție de distanța față de medie
        if (value !== null && averages[indicator] > 0) {
            const color = getColorForValue(value, averages[indicator]);
            cell.style.backgroundColor = color;
        } else {
            cell.style.backgroundColor = '#f5f5f7';
        }
        
        // Animație pentru fiecare celulă individuală
        cell.style.opacity = '0';
        cell.style.transform = 'scale(0.9)';
        
        row.appendChild(cell);
    });
    
    return row;
}

/**
 * Obține valoarea pentru o țară, an și indicator din structura de date
 */
function getValue(countryCode, year, indicator) {
    if (!eurostatData) {
        return null;
    }
    
    if (!eurostatData[indicator]) {
        return null;
    }
    
    if (!eurostatData[indicator][countryCode]) {
        return null;
    }
    
    // Asigură-te că anul este un număr pentru căutare corectă
    const yearNum = typeof year === 'string' ? parseInt(year) : year;
    
    // Verifică ce ani sunt disponibili pentru această țară și indicator
    const availableYears = Object.keys(eurostatData[indicator][countryCode]);
    
    // Încearcă să găsească valoarea folosind anul ca număr sau string
    let value = eurostatData[indicator][countryCode][yearNum];
    
    // Dacă nu găsește cu număr, încearcă cu string
    if (value === undefined || value === null) {
        value = eurostatData[indicator][countryCode][year];
    }
    
    // Dacă încă nu găsește, încearcă cu string din număr
    if (value === undefined || value === null) {
        value = eurostatData[indicator][countryCode][String(yearNum)];
    }
    
    // Verifică că valoarea este validă
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
        return null;
    }
    
    return value;
}

/**
 * Formatează o valoare pentru afișare în funcție de tipul indicatorului
 */
function formatValue(value, indicator) {
    if (indicator === 'pop') {
        // Populația în milioane
        return (value / 1000000).toFixed(2) + ' mil';
    } else if (indicator === 'gdp') {
        // PIB-ul cu separator de mii și simbol EUR
        return Math.round(value).toLocaleString() + ' €';
    } else {
        return parseFloat(value).toFixed(2) + ' ani';
    }
}

/**
 * Calculează culoarea pentru o valoare în funcție de distanța față de medie
 * Roșu = sub medie, Galben = la medie, Verde = peste medie
 */
function getColorForValue(value, average) {
    // Calculează procentul față de medie
    const ratio = value / average;
    
    // Normalizează între 0 și 1 pentru gradient
    // Sub medie (< 1.0): roșu -> galben
    // Peste medie (> 1.0): galben -> verde
    let red, green, blue;
    
    if (ratio < 1.0) {
        // Sub medie: roșu -> galben
        const factor = ratio; // 0.0 -> 1.0
        red = 255;
        green = Math.floor(255 * factor);
        blue = 0;
    } else {
        // Peste medie: galben -> verde
        const factor = Math.min((ratio - 1.0) * 2, 1.0); // 0.0 -> 1.0
        red = Math.floor(255 * (1 - factor));
        green = 255;
        blue = 0;
    }
    
    // Ajustează intensitatea pentru a fi mai subtilă
    red = Math.floor(200 + (red - 200) * 0.7);
    green = Math.floor(200 + (green - 200) * 0.7);
    
    return `rgb(${red}, ${green}, ${blue})`;
}

/**
 * Comută animația bubble chart între play și pause
 */
function toggleAnimation() {
    const animateBtn = document.getElementById('animate-btn');
    
    if (animationInterval) {
        // Oprește animația
        stopAnimation();
        animateBtn.textContent = 'Play Animation';
    } else {
        // Pornește animația
        startAnimation();
        animateBtn.textContent = 'Pause Animation';
    }
}

/**
 * Pornește animația bubble chart
 * Iterează prin toți anii disponibili automat folosind requestAnimationFrame pentru animație fluidă
 */
function startAnimation() {
    const years = extractAvailableYears();
    if (years.length === 0) return;
    
    years.sort((a, b) => a - b); // Sortare crescătoare pentru animație
    
    let currentIndex = 0;
    let lastTime = 0;
    const bubbleYearSelect = document.getElementById('bubble-year-select');
    const frameDelay = 1000; // Schimbă anul la fiecare 1000ms (1 secundă) pentru animație mai rapidă
    
    // Folosește requestAnimationFrame pentru animație fluidă
    function animateFrame(timestamp) {
        // Verifică dacă animația a fost oprită
        if (!animationInterval) return;
        
        // Controlează viteza animației
        if (timestamp - lastTime >= frameDelay) {
            // Actualizează anul curent
            currentYear = years[currentIndex];
            bubbleYearSelect.value = currentYear;
            
            // Actualizează bubble chart-ul
            updateBubbleChart();
            
            // Trece la următorul an
            currentIndex++;
            
            // Dacă am ajuns la sfârșit, reîncepe de la început
            if (currentIndex >= years.length) {
                currentIndex = 0;
            }
            
            lastTime = timestamp;
        }
        
        // Continuă animația
        animationFrameId = requestAnimationFrame(animateFrame);
    }
    
    // Pornește animația
    animationFrameId = requestAnimationFrame(animateFrame);
    animationInterval = true; // Folosim ca flag pentru a verifica dacă animația rulează
}

/**
 * Oprește animația bubble chart
 */
function stopAnimation() {
    // Oprește flag-ul de animație
    animationInterval = null;
    
    // Anulează requestAnimationFrame dacă există
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

