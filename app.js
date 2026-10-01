/* ==========================================================================
   FCFD SENTINEL - Main Application Script
   ========================================================================== */

// Global Variables
let map;
let geofencePolygon;
let marker;
let autocomplete;

// 1. Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                registration.update();
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// 2. Map Initialization (Called by Google Maps API script tag callback)
function initMap() {
    // Verify coordinates from geofence.js exist
    if (typeof geofenceCoords === 'undefined' || !geofenceCoords.length) {
        alert("Geofence coordinates not found. Please verify geofence.js is present in the repository root.");
        return;
    }

    // Initialize Map Instance
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 10,
        center: { lat: 38.15, lng: -85.6 },
        mapId: "DEMO_MAP_ID"
    });

    // Draw Boundary Polygon
    geofencePolygon = new google.maps.Polygon({
        paths: geofenceCoords,
        strokeColor: "#003366",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#1a5276",
        fillOpacity: 0.35,
    });
    geofencePolygon.setMap(map);

    // Auto-fit Map View to District Boundary
    fitMapToBoundary();

    // Setup Places Autocomplete
    const input = document.getElementById("autocomplete");
    autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo("bounds", map);
    autocomplete.addListener("place_changed", verifyAddress);

    // Monitor Input Field for Manual Typing/Pasting
    input.addEventListener("input", toggleClearButton);
    input.addEventListener("keyup", toggleClearButton);
}

// 3. Auto-fit Map to Coordinates
function fitMapToBoundary() {
    if (!map || !geofenceCoords || !geofenceCoords.length) return;
    const bounds = new google.maps.LatLngBounds();
    geofenceCoords.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds);
}

// 4. Input Controls & Clear Button Logic
function toggleClearButton() {
    const input = document.getElementById("autocomplete");
    const clearBtn = document.getElementById("clearAddressBtn");
    if (clearBtn) {
        clearBtn.style.display = (input.value && input.value.trim().length > 0) ? "inline-block" : "none";
    }
}

function clearAddressInput() {
    const input = document.getElementById("autocomplete");
    const clearBtn = document.getElementById("clearAddressBtn");
    const banner = document.getElementById("statusBanner");

    if (input) input.value = "";
    if (clearBtn) clearBtn.style.display = "none";
    if (banner) banner.style.display = "none";

    // Remove Pin Marker
    if (marker) {
        marker.map = null;
    }

    // Reset View to Entire Boundary
    fitMapToBoundary();

    if (input) input.focus();
}

// 5. Boundary Verification Logic
function verifyAddress() {
    const place = autocomplete.getPlace();

    if (!place || !place.geometry || !place.geometry.location) {
        alert("Please select a valid address from the dropdown list.");
        return;
    }

    const location = place.geometry.location;

    // Display Clear Button
    const clearBtn = document.getElementById("clearAddressBtn");
    if (clearBtn) clearBtn.style.display = "inline-block";

    // Focus Map on Selected Location
    map.setCenter(location);
    map.setZoom(15);

    // Update Advanced Marker Pin
    if (marker) marker.map = null;
    marker = new google.maps.marker.AdvancedMarkerElement({
        position: location,
        map: map,
        title: place.formatted_address
    });

    // Determine Geofence Spatial Relationship
    const isInside = google.maps.geometry.poly.containsLocation(location, geofencePolygon);
    
    // Render Status Banner & Directions Button
    const banner = document.getElementById("statusBanner");
    const statusText = document.getElementById("statusText");
    const directionsBtn = document.getElementById("directionsBtn");
    
    if (banner && statusText && directionsBtn) {
        banner.style.display = "block";
        if (isInside) {
            banner.className = "in-district";
            statusText.innerHTML = "✅ IN DISTRICT: Address is WITHIN the FCFD service area.";
        } else {
            banner.className = "out-district";
            statusText.innerHTML = "❌ OUT OF DISTRICT: Address is OUTSIDE the FCFD service area.";
        }

        // Build Google Maps Navigation Deep Link
        const encodedAddress = encodeURIComponent(place.formatted_address);
        directionsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
        directionsBtn.style.display = "inline-block";
    }

    // Record Entry in History Log
    addSearchHistory(place.formatted_address, isInside);
}

// 6. Recent Search History Table
function addSearchHistory(address, isInside) {
    const historyList = document.getElementById("historyList");
    if (!historyList) return;

    if (historyList.children[0] && historyList.children[0].innerText === "No recent searches") {
        historyList.innerHTML = "";
    }

    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
        <span>${address}</span>
        <span class="badge ${isInside ? 'badge-in' : 'badge-out'}">${isInside ? 'IN DISTRICT' : 'OUT OF DISTRICT'}</span>
    `;
    historyList.prepend(item);
}

function clearHistory() {
    const historyList = document.getElementById("historyList");
    if (historyList) {
        historyList.innerHTML = '<div style="font-size: 12px; color: #888; text-align: center; padding: 10px;">No recent searches</div>';
    }
}

// 7. Share App Modal & Utilities
function openShareModal() {
    const modal = document.getElementById("shareModal");
    const qrContainer = document.getElementById("qrCodeContainer");
    const nativeBtn = document.getElementById("nativeShareBtn");
    const currentUrl = window.location.href;

    if (qrContainer) {
        qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}" alt="App QR Code" />`;
    }

    if (navigator.share && nativeBtn) {
        nativeBtn.style.display = "inline-block";
    }

    if (modal) modal.style.display = "flex";
}

function closeShareModal() {
    const modal = document.getElementById("shareModal");
    const alert = document.getElementById("copyAlert");
    if (modal) modal.style.display = "none";
    if (alert) alert.style.display = "none";
}

function copyAppUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const alert = document.getElementById("copyAlert");
        if (alert) {
            alert.style.display = "block";
            setTimeout(() => { alert.style.display = "none"; }, 3000);
        }
    });
}

function triggerNativeShare() {
    if (navigator.share) {
        navigator.share({
            title: 'FCFD SENTINEL',
            text: 'Check addresses against the Fern Creek Fire & EMS District Boundary.',
            url: window.location.href
        }).catch(() => {});
    }
}
