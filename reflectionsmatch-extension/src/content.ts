// Auto-Sync Logic for LinkedIn
console.log("ReflectionsMatch Content Script Loaded");

const showBanner = (text: string, color: string = "#4f46e5") => {
    let banner = document.getElementById("reflections-sync-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "reflections-sync-banner";
        banner.style.position = "fixed";
        banner.style.top = "0";
        banner.style.left = "0";
        banner.style.width = "100%";
        banner.style.padding = "10px";
        banner.style.color = "white";
        banner.style.textAlign = "center";
        banner.style.zIndex = "999999";
        banner.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
        banner.style.fontFamily = "system-ui, -apple-system, sans-serif";
        banner.style.fontWeight = "600";
        document.body.prepend(banner);
    }
    banner.style.backgroundColor = color;
    banner.innerText = text;
};

const removeBanner = () => {
    const banner = document.getElementById("reflections-sync-banner");
    if (banner) banner.remove();
};

const scrapeData = () => {
    const bodyText = document.body.innerText;

    const findSection = (keyword: string, length = 1500) => {
        const regex = new RegExp(`${keyword}\\s*\\n`, 'i');
        const match = bodyText.match(regex);
        if (match && match.index) {
            return bodyText.substring(match.index + match[0].length, match.index + match[0].length + length);
        }
        return "";
    };

    const aboutText = findSection("About", 2000);
    const experienceText = findSection("Experience", 4000);

    // Fallback / Basic Info
    const getName = () => (document.querySelector('h1') as HTMLElement)?.innerText || "";
    const getHeadline = () => (document.querySelector('.text-body-medium') as HTMLElement)?.innerText || "";
    const getMetaAbout = () => document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";

    return {
        name: getName(),
        headline: getHeadline(),
        about: getMetaAbout(),
        deepProfileText: `About Section:\n${aboutText}\n\nExperience Section:\n${experienceText}\n\n(Extracted from LinkedIn)`,
        profileUrl: window.location.href,
        scrapedAt: new Date().toISOString()
    };
};

const runAutoSync = async () => {
    showBanner("Reflections Match: Syncing Profile... Please wait.", "#4f46e5"); // Indigo

    // Scroll Logic
    const scrollInterval = setInterval(() => {
        window.scrollBy(0, 500);
        if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 100) {
            clearInterval(scrollInterval);

            // Reached bottom, wait a moment for lazy load
            setTimeout(() => {
                const data = scrapeData();
                console.log("Scraped Data:", data);

                // Send to Background
                chrome.runtime.sendMessage({ type: "LINKEDIN_SYNC_DATA", data }, (response) => {
                    if (response && response.success) {
                        showBanner("Sync Complete! You can close this tab.", "#10b981"); // Green
                        setTimeout(() => removeBanner(), 5000);
                    } else {
                        showBanner("Sync Failed. Please try again or use the extension popup.", "#ef4444"); // Red
                    }
                });

                // Scroll back up
                window.scrollTo(0, 0);

            }, 2000);
        }
    }, 200);
};


// Check for trigger
if (window.location.href.includes("reflections_sync=true")) {
    // Wait for page load
    if (document.readyState === "complete") {
        runAutoSync();
    } else {
        window.addEventListener("load", runAutoSync);
    }
}
