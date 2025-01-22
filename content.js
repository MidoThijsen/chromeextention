function getPageTitleAndContent() {
    // Get the page title
    const title = document.title;

    // Define the specific XPaths for different websites
    const cmsXPath = '/html/body/div[1]/div[2]/div[2]/div[1]/div[2]/div[1]/div/div[1]/div[1]/div[2]/div[1]/div[3]/div';
    const rechtspraakXPath = '/html/body/app-root/lib-register-skeleton/div/main/div[2]/div/div/div/div/app-details/div[1]/lib-rnl-ui-loader/div/div[1]/lib-rnl-ui-panel/div/div[2]';

    let content = '';

    try {
        let contentElement = null;

        if (window.location.href.startsWith("https://cms.")) {
            // Use the XPath specific to "https://cms." sites
            const result = document.evaluate(cmsXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            contentElement = result.singleNodeValue;

            if (contentElement) {
                content = contentElement.innerText.trim(); // Extract visible text from the element
                console.log("Content extracted using the CMS XPath.");
            } else {
                console.warn("No content found for the specified CMS XPath.");
            }
        } else if (window.location.href.startsWith("https://uitspraken.rechtspraak.nl")) {
            // Use the XPath specific to "https://uitspraken.rechtspraak.nl" sites
            const result = document.evaluate(rechtspraakXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            contentElement = result.singleNodeValue;

            if (contentElement) {
                content = contentElement.innerText.trim(); // Extract visible text from the element
                console.log("Content extracted using the Rechtspraak XPath.");
            } else {
                console.warn("No content found for the specified Rechtspraak XPath.");
            }
        }

        // Fallback: Attempt to grab content from <article> tag
        if (!content) {
            const articleElement = document.querySelector("article");
            if (articleElement) {
                content = articleElement.innerText.trim();
                console.log("Content extracted from <article> tag.");
            } else {
                console.warn("No <article> tag found.");
            }
        }

        // Fallback: Grab the text content of the entire body
        if (!content) {
            content = document.body.innerText.trim();
            console.log("Content extracted from the entire body.");
        }
    } catch (error) {
        console.error("Error extracting content:", error);
    }

    // Limit the content length to avoid passing too much data
    return { title, content: content.slice(0, 15000) }; // Limit to first 15000 characters
}

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "get_page_data_for_titles") {
        const data = getPageTitleAndContent();
        console.log("Sending extracted data to popup.js:", data);
        sendResponse(data);
    }
});
