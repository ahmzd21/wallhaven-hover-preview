// Wallhaven Hover Preview Content Script

console.log("Wallhaven Hover Preview: Loaded");

const POPUP_ID = 'wh-hover-preview';
let popup = null;
let imgElement = null;

// Initialize Popup
function createPopup() {
    if (document.getElementById(POPUP_ID)) return;

    popup = document.createElement('div');
    popup.id = POPUP_ID;

    imgElement = document.createElement('img');
    popup.appendChild(imgElement);

    document.body.appendChild(popup);
}

// Helper to get URL - tries FULL resolution first
function getPreviewUrl(thumbElement) {
    const link = thumbElement.querySelector('a.preview') || thumbElement.closest('a');
    if (!link) return null;

    const href = link.getAttribute('href');
    // href should be like https://wallhaven.cc/w/wg9xyz
    const matches = href.match(/\/w\/([a-z0-9]+)$/);
    if (!matches) return null;

    const id = matches[1];
    const sub = id.substring(0, 2);

    // Logic for Full Image:
    // https://w.wallhaven.cc/full/{sub}/wallhaven-{id}.jpg
    // Fallback: If .jpg fails, we might need .png. 
    // Since we can't easily check HEAD without fetch overhead, we rely on 'onerror' in the img tag.

    return {
        full: `https://w.wallhaven.cc/full/${sub}/wallhaven-${id}.jpg`,
        fullPng: `https://w.wallhaven.cc/full/${sub}/wallhaven-${id}.png`,
        largeThumb: `https://th.wallhaven.cc/lg/${sub}/${id}.jpg`
    };
}

// Mouse Event Handlers
function handleMouseEnter(e) {
    const thumb = e.currentTarget;
    const urls = getPreviewUrl(thumb);

    if (!urls) return;

    // Reset state
    imgElement.src = "";
    popup.classList.add('loading');
    popup.classList.add('visible');

    // Try JPG -> PNG -> Large Thumb
    imgElement.onerror = () => {
        console.log(`Failed to load JPG: ${urls.full}, trying PNG...`);
        imgElement.onerror = () => {
            console.log(`Failed to load PNG: ${urls.fullPng}, falling back to large thumb...`);
            imgElement.onerror = null; // Stop infinite loop if thumb fails (shouldn't)
            imgElement.src = urls.largeThumb;
        };
        imgElement.src = urls.fullPng;
    };

    imgElement.onload = () => {
        popup.classList.remove('loading');
    };

    imgElement.src = urls.full;

    updatePosition(e);
}

function handleMouseLeave(e) {
    popup.classList.remove('visible');
    // Clear src slightly later to avoid flicker if re-entering quickly, 
    // but clear it to stop large downloads if user moves away.
    setTimeout(() => {
        if (!popup.classList.contains('visible')) {
            imgElement.src = '';
            imgElement.onerror = null;
        }
    }, 100);
}

function handleMouseMove(e) {
    if (!popup.classList.contains('visible')) return;
    updatePosition(e);
}

function updatePosition(e) {
    const offset = 20;

    // Center popup logic? Or Cursor logic?
    // User asked: "pop up window needs to be big like covering almost all of the page"
    // So fixed center is better than following cursor for massive images.
    // If it covers "almost all of page", lets center it fixed.

    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';

    // Override the scale transform in CSS for visibility if needed, 
    // but our CSS uses .visible { transform: scale(1) } which conflicts with translate(-50%, -50%).
    // We need to adjust CSS or handle transform here.
    // Let's modify style.css to handle centering or use fixed top/left 0 with w/h 100% and flex center.
}

// Attach listeners to a thumbnail
function attachListeners(element) {
    if (element.dataset.whHoverAttached) return;

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    // element.addEventListener('mousemove', handleMouseMove); // optimize: disable mousemove if we center fixed

    element.dataset.whHoverAttached = 'true';
}

// Main Observer Logic
function init() {
    createPopup();

    // Selectors:
    // Homepage often uses `section.thumb-listing-page ul li figure.thumb`
    // Search uses `div#thumbs section.thumb-listing-page ul li figure.thumb`
    // Just `figure.thumb` should match both if they exist.
    // If homepage fails, check if elements are `li` class `thumb` or similar.
    // `curl` showed `li` class `thumb` might be parents?

    const thumbs = document.querySelectorAll('figure.thumb');
    console.log(`Found ${thumbs.length} thumbs`);
    thumbs.forEach(attachListeners);

    // Observer for infinite scroll
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element
                    if (node.matches && node.matches('figure.thumb')) {
                        attachListeners(node);
                    } else {
                        // Check children
                        const nested = node.querySelectorAll ? node.querySelectorAll('figure.thumb') : [];
                        nested.forEach(attachListeners);
                    }
                }
            });
        });
    });

    const container = document.querySelector('main') || document.body;
    observer.observe(container, { childList: true, subtree: true });
}

// Use requestIdleCallback or simple timeout to ensure load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
