/**
 * Photo Watermarking & Geolocation Utility for Fleet Maintenance
 *
 * Automatically stamps captured camera photos with:
 * 1. Formatted capture Date & Time (e.g. 03 Nov 2026 | 10:45 AM)
 * 2. Real-time Geographic Location with Accurate GPS Coordinates
 *    (e.g. 19.0596° N, 72.8895° E • Chembur, Mumbai)
 *
 * Embedded permanently into the image canvas in the bottom-left corner
 * with clean typography and semi-transparent dark backdrop.
 */

// Format timestamp: "03 Nov 2026 | 10:45 AM"
export function formatCaptureDateTime(date = new Date()) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, "0");

  return `${day} ${month} ${year} | ${formattedHours}:${minutes} ${ampm}`;
}

// In-memory cache & promise deduplication for location queries
let cachedLocation = null;
let cachedLocationTimestamp = 0;
let inFlightLocationPromise = null;
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds cache for successful location

/**
 * Check whether the current origin is a secure context (HTTPS or localhost)
 */
export function isSecureOrigin() {
  if (typeof window === "undefined") return true;
  return window.isSecureContext !== false;
}

/**
 * Check browser geolocation permission state
 * @returns {Promise<'granted'|'prompt'|'denied'|'unknown'>}
 */
export async function checkLocationPermissionState() {
  if (typeof window === "undefined" || !navigator.permissions || !navigator.permissions.query) {
    return "unknown";
  }
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch (_) {
    return "unknown";
  }
}

/**
 * Extract human-readable locality and city from geocoding response
 */
function extractPlaceName(data) {
  if (!data) return "";
  const addr = data.address || data;
  const parts = [];

  // Locality / Suburb (e.g. "Chembur", "Kharghar", "Andheri East")
  const locality =
    addr.suburb ||
    data.locality ||
    addr.neighbourhood ||
    addr.subLocality ||
    data.neighbourhood ||
    data.subLocality ||
    addr.residential ||
    addr.village ||
    addr.town;

  // City / Municipal District (e.g. "Mumbai", "Navi Mumbai", "Thane")
  const city =
    data.city ||
    addr.city ||
    addr.city_district ||
    addr.state_district ||
    data.principalSubdivision ||
    addr.state;

  if (locality) parts.push(locality);
  if (city && city !== locality) parts.push(city);

  return parts.join(", ");
}

/**
 * Reverse geocode the ACTUAL device GPS coordinates:
 * 1. BigDataCloud free client-side API
 * 2. OpenStreetMap Nominatim API
 * NOTE: Only called with real coordinates; never uses inaccurate ISP IP guessing.
 */
export async function reverseGeocode(latitude, longitude) {
  // Strategy 1: BigDataCloud free client-side API with coordinates
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const place = extractPlaceName(data);
      if (place) return place;
    }
  } catch (_) {}

  // Strategy 2: OpenStreetMap Nominatim fallback
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const place = extractPlaceName(data);
      if (place) return place;
    }
  } catch (_) {}

  return "";
}

/**
 * Manually set or override coordinates (e.g. for Chembur office or if browser blocks GPS)
 */
export async function setManualLocation(latitude, longitude, customPlaceName = "") {
  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);
  if (isNaN(latNum) || isNaN(lngNum)) return null;

  const latStr = `${Math.abs(latNum).toFixed(4)}° ${latNum >= 0 ? "N" : "S"}`;
  const lngStr = `${Math.abs(lngNum).toFixed(4)}° ${lngNum >= 0 ? "E" : "W"}`;
  const coordStr = `${latStr}, ${lngStr}`;

  let placeName = customPlaceName;
  if (!placeName) {
    try {
      placeName = await reverseGeocode(latNum, lngNum);
    } catch (_) {}
  }

  const fullAddress = placeName ? `${coordStr} • ${placeName}` : coordStr;
  const locData = {
    address: fullAddress,
    placeName: placeName || "",
    coordStr,
    latitude: latNum,
    longitude: lngNum,
    accuracy: 10,
    source: "manual",
  };

  cachedLocation = locData;
  cachedLocationTimestamp = Date.now();
  return locData;
}

/**
 * Direct device location query via browser Geolocation API
 * Fast staggered strategy: Starts high-accuracy GPS and parallel low-accuracy Wi-Fi query
 * to prevent freezes indoors or on mobile.
 */
export async function queryDeviceLocation({ forceRefresh = false } = {}) {
  if (typeof window === "undefined") {
    return {
      address: "Location unavailable",
      placeName: "",
      coordStr: "",
      latitude: null,
      longitude: null,
      error: "no-window",
    };
  }

  // If valid cached GPS coordinates exist and not forcing refresh, reuse within cache window
  if (
    !forceRefresh &&
    cachedLocation &&
    cachedLocation.latitude &&
    cachedLocation.longitude &&
    Date.now() - cachedLocationTimestamp < CACHE_DURATION_MS
  ) {
    return cachedLocation;
  }

  if (!navigator.geolocation) {
    return {
      address: "Geolocation not supported by browser",
      placeName: "",
      coordStr: "",
      latitude: null,
      longitude: null,
      error: "unsupported",
    };
  }

  // Check secure context (Chrome and Safari forbid geolocation on insecure HTTP unless localhost)
  if (window.isSecureContext === false) {
    console.warn("Geolocation blocked: origin is not secure (requires HTTPS or localhost)");
    return {
      address: "Location requires HTTPS (Insecure origin)",
      placeName: "",
      coordStr: "",
      latitude: null,
      longitude: null,
      error: "insecure-context",
      isInsecure: true,
    };
  }

  return new Promise((resolve) => {
    let resolved = false;
    let permDenied = false;

    // Fast-resolve handler
    const handleSuccess = async (position) => {
      if (resolved) return;
      resolved = true;

      const { latitude, longitude, accuracy } = position.coords;
      const latStr = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? "N" : "S"}`;
      const lngStr = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? "E" : "W"}`;
      const coordStr = `${latStr}, ${lngStr}`;

      let placeName = "";
      try {
        placeName = await reverseGeocode(latitude, longitude);
      } catch (_) {}

      const fullAddress = placeName ? `${coordStr} • ${placeName}` : coordStr;
      const locData = {
        address: fullAddress,
        placeName: placeName || "",
        coordStr,
        latitude,
        longitude,
        accuracy: accuracy || null,
        source: "gps",
      };

      cachedLocation = locData;
      cachedLocationTimestamp = Date.now();
      resolve(locData);
    };

    // Staggered dual query:
    // 1. High accuracy GPS (timeout 4500ms)
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        if (err?.code === 1) permDenied = true;
        // If high accuracy failed, try low accuracy network immediately
        if (!resolved && !permDenied) {
          navigator.geolocation.getCurrentPosition(handleSuccess, (e2) => {
            if (e2?.code === 1) permDenied = true;
          }, {
            enableHighAccuracy: false,
            timeout: 4000,
            maximumAge: 60000,
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 4500,
        maximumAge: 15000,
      }
    );

    // 2. Also start Low Accuracy after 2000ms if High Accuracy is still negotiating satellites
    // (This guarantees that indoors in an office, Wi-Fi location resolves in ~2.5s instead of hanging!)
    setTimeout(() => {
      if (!resolved && !permDenied) {
        navigator.geolocation.getCurrentPosition(handleSuccess, (err) => {
          if (err?.code === 1) permDenied = true;
        }, {
          enableHighAccuracy: false,
          timeout: 4000,
          maximumAge: 60000,
        });
      }
    }, 2000);

    // 3. Final safety timeout (6500ms total)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          address: permDenied
            ? "Location permission denied"
            : "Location unavailable (Turn on GPS)",
          placeName: "",
          coordStr: "",
          latitude: null,
          longitude: null,
          error: permDenied ? "denied" : "timeout",
          permissionDenied: permDenied,
        });
      }
    }, 6500);
  });
}

/**
 * Preload location early in the background
 */
export function preloadLocation() {
  if (typeof window === "undefined" || !navigator.geolocation) return;
  if (cachedLocation && cachedLocation.latitude && Date.now() - cachedLocationTimestamp < CACHE_DURATION_MS) {
    return;
  }
  if (!inFlightLocationPromise) {
    inFlightLocationPromise = queryDeviceLocation().finally(() => {
      inFlightLocationPromise = null;
    });
  }
}

/**
 * Get current geographical location details
 */
export async function getCurrentLocationDetails(options = {}) {
  if (!options.forceRefresh && cachedLocation && cachedLocation.latitude && Date.now() - cachedLocationTimestamp < CACHE_DURATION_MS) {
    return cachedLocation;
  }
  if (!options.forceRefresh && inFlightLocationPromise) {
    return await inFlightLocationPromise;
  }
  inFlightLocationPromise = queryDeviceLocation(options).finally(() => {
    inFlightLocationPromise = null;
  });
  return await inFlightLocationPromise;
}

/**
 * Helper to draw rounded rectangle on Canvas with backwards compatibility
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Embeds permanent date, time, and location watermark into captured photo.
 *
 * @param {File|Blob} imageFile - Original captured photo file
 * @param {object} options
 * @param {Date|number} [options.captureTime] - Exact capture timestamp
 * @param {object} [options.locDetails] - Pre-resolved location details object
 * @param {string} [options.locationText] - Pre-resolved location string fallback
 * @returns {Promise<File>} Watermarked image File object
 */
export async function watermarkCapturedPhoto(imageFile, options = {}) {
  if (!imageFile || typeof window === "undefined") return imageFile;

  // 1. Capture exact date and time
  const captureTime =
    options.captureTime instanceof Date
      ? options.captureTime
      : typeof options.captureTime === "number"
      ? new Date(options.captureTime)
      : imageFile.lastModified && Math.abs(Date.now() - imageFile.lastModified) < 24 * 60 * 60 * 1000
      ? new Date(imageFile.lastModified)
      : new Date();

  const dateTimeText = formatCaptureDateTime(captureTime);

  // 2. Obtain current location details
  let locDetails = options.locDetails;
  if (!locDetails || !locDetails.latitude) {
    locDetails = await getCurrentLocationDetails();
  }

  // 3. Load image into memory
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(imageFile);

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(imageFile);
      };

      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);

        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            return resolve(imageFile);
          }

          // Preserve aspect ratio; cap at 1920px max dimension for optimal performance & quality
          const MAX_DIMENSION = 1920;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          // 4. Initialize Canvas
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(imageFile);

          // Draw the base image
          ctx.drawImage(img, 0, 0, width, height);

          // 5. Watermark dimensions & typography calculations
          const minDim = Math.min(width, height);
          const fontSize = Math.max(13, Math.round(minDim * 0.023));
          const lineHeight = Math.round(fontSize * 1.45);
          const paddingX = Math.round(fontSize * 0.9);
          const paddingY = Math.round(fontSize * 0.65);
          const badgeMargin = Math.round(fontSize * 0.85);
          const borderRadius = Math.round(fontSize * 0.4);

          const fontStack = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
          ctx.font = fontStack;

          const maxAllowedTextWidth = width - badgeMargin * 2 - paddingX * 2 - fontSize;

          // Build lines to display: Date/Time + Coordinates + Suburb/City
          const lines = [];
          lines.push(`📅 ${dateTimeText}`);

          if (locDetails && locDetails.latitude && locDetails.longitude) {
            const coordStr = locDetails.coordStr || `${Math.abs(locDetails.latitude).toFixed(4)}° ${locDetails.latitude >= 0 ? "N" : "S"}, ${Math.abs(locDetails.longitude).toFixed(4)}° ${locDetails.longitude >= 0 ? "E" : "W"}`;
            const place = locDetails.placeName;

            if (place) {
              const combined = `📍 ${coordStr} • ${place}`;
              if (ctx.measureText(combined).width <= maxAllowedTextWidth) {
                lines.push(combined);
              } else {
                lines.push(`📍 ${coordStr}`);
                lines.push(`📍 ${place}`);
              }
            } else {
              lines.push(`📍 ${coordStr}`);
            }
          } else {
            lines.push(`📍 ${locDetails?.address || options.locationText || "Location unavailable"}`);
          }

          // Ensure lines fit within maximum width, truncate if necessary
          for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (ctx.measureText(line).width > maxAllowedTextWidth) {
              while (line.length > 8 && ctx.measureText(`${line}…`).width > maxAllowedTextWidth) {
                line = line.slice(0, -1);
              }
              lines[i] = `${line}…`;
            }
          }

          let maxTextWidth = 0;
          lines.forEach((l) => {
            const w = ctx.measureText(l).width;
            if (w > maxTextWidth) maxTextWidth = w;
          });

          const badgeWidth = Math.round(maxTextWidth + paddingX * 2);
          const badgeHeight = Math.round(lineHeight * lines.length + paddingY * 2);

          // Position at Bottom-Left corner
          const badgeX = badgeMargin;
          const badgeY = height - badgeHeight - badgeMargin;

          // 6. Draw semi-transparent dark pill background
          ctx.save();
          ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
          ctx.shadowBlur = Math.round(fontSize * 0.35);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.round(fontSize * 0.15);

          ctx.fillStyle = "rgba(15, 23, 42, 0.84)";
          drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, borderRadius);
          ctx.fill();

          // Clean subtle white border for contrast against bright scenes
          ctx.shadowColor = "transparent";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
          ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.05));
          ctx.stroke();

          // 7. Render crisp typography
          ctx.font = fontStack;
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
          ctx.shadowBlur = Math.round(fontSize * 0.2);

          lines.forEach((lineText, idx) => {
            const lineY = Math.round(badgeY + paddingY + lineHeight * (idx + 0.5));
            ctx.fillText(lineText, badgeX + paddingX, lineY);
          });
          ctx.restore();

          // 8. Export to Blob and File
          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(imageFile);

              const originalName = imageFile.name || "camera-photo.jpg";
              const baseName = originalName.replace(/\.[^/.]+$/, "");
              const finalFileName = `${baseName}.jpg`;

              const watermarkedFile = new File([blob], finalFileName, {
                type: "image/jpeg",
                lastModified: captureTime.getTime(),
              });

              resolve(watermarkedFile);
            },
            "image/jpeg",
            0.88
          );
        } catch (procErr) {
          console.warn("Canvas watermark processing error, using original file:", procErr);
          resolve(imageFile);
        }
      };

      img.src = objectUrl;
    } catch (err) {
      console.warn("Watermarking initialization error, using original file:", err);
      resolve(imageFile);
    }
  });
}
