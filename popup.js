let globalArticleContent = ""; // Store article content globally
let titlesTrainingData = ""; // Store Titles.txt content globally


// Function to preload article content on popup load
async function preloadArticleContent() {
    const { title, content } = await getPageTitleAndContent();
    if (!content || content === "Unable to load content.") {
        console.error("Unable to preload article content.");
        globalArticleContent = "Geen artikelinhoud beschikbaar.";
    } else {
        globalArticleContent = `Titel: ${title}\nInhoud: ${content}`;
        console.log("Article content preloaded successfully:", globalArticleContent.slice(0, 100)); // Log first 100 characters
    }
}

// Function to save chat history to Chrome storage
function saveChatHistory() {
    const chatHistoryDiv = document.getElementById("chat-history");
    const chatContent = chatHistoryDiv.innerHTML; // Save the current chat history as HTML
    chrome.storage.local.set({ chatHistory: chatContent }, () => {
        console.log("Chat history saved.");
    });
}

// Function to load chat history from Chrome storage
function loadChatHistory() {
    chrome.storage.local.get("chatHistory", (result) => {
        if (result.chatHistory) {
            const chatHistoryDiv = document.getElementById("chat-history");
            chatHistoryDiv.innerHTML = result.chatHistory; // Restore the chat history
            console.log("Chat history loaded.");
        }
    });
}
async function getPageTitleAndContent() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { message: "get_page_data_for_titles" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error communicating with content script:", chrome.runtime.lastError.message);
                    resolve({ title: "Error", content: "Unable to load content." });
                } else if (!response) {
                    console.error("No response received from content script.");
                    resolve({ title: "Error", content: "No content returned by content script." });
                } else {
                    console.log("Content received from content.js:", response);
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.error("Error getting page data:", error);
        return { title: "Error", content: "An unexpected error occurred." };
    }
}

// Markdown to HTML converter
function convertMarkdownToHTML(markdown) {
    return markdown
        .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>') // Convert headings
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Convert bold text
        .replace(/\n/g, '<br>'); // Convert newlines
}

// Function to add messages to the chat UI
function addMessage(role, message) {
    const chatHistoryDiv = document.getElementById("chat-history");

    const messageWrapper = document.createElement("div");
    messageWrapper.style.display = "flex";
    messageWrapper.style.alignItems = "flex-start";
    messageWrapper.style.marginBottom = "10px";

    // Add icon or block
    const iconDiv = document.createElement("div");
    iconDiv.style.width = "30px";
    iconDiv.style.height = "30px";
    iconDiv.style.borderRadius = "50%";
    iconDiv.style.display = "flex";
    iconDiv.style.alignItems = "center";
    iconDiv.style.justifyContent = "center";
    iconDiv.style.marginRight = "10px";
    iconDiv.style.fontWeight = "bold";
    iconDiv.style.color = "white";
    iconDiv.style.backgroundColor = role === "user" ? "#1e3a8a" : "#2d3748";
    iconDiv.textContent = role === "user" ? "U" : "AI";

    // Convert Markdown to HTML
    const convertedMessage = convertMarkdownToHTML(message);

    // Add message content
    const messageContentDiv = document.createElement("div");
    messageContentDiv.style.backgroundColor = role === "user" ? "#dbeafe" : "#edf2f7";
    messageContentDiv.style.color = role === "user" ? "#1e3a8a" : "#2d3748";
    messageContentDiv.style.padding = "10px";
    messageContentDiv.style.borderRadius = "8px";
    messageContentDiv.style.maxWidth = "75%";
    messageContentDiv.style.wordWrap = "break-word";
    messageContentDiv.style.fontSize = "16px";

    // Inject HTML safely
    messageContentDiv.innerHTML = convertedMessage;

    // Combine icon and content
    messageWrapper.appendChild(iconDiv);
    messageWrapper.appendChild(messageContentDiv);

    chatHistoryDiv.appendChild(messageWrapper);
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;

    // Save chat history to Chrome storage
    saveChatHistory();
}

// Function to load the API key from api_key.txt
async function loadApiKey() {
    try {
        const response = await fetch(chrome.runtime.getURL('api_key.txt'));
        const apiKey = await response.text();
        console.log("API key loaded successfully:", apiKey.trim()); // Debugging
        return apiKey.trim(); // Remove any whitespace
    } catch (error) {
        console.error("Error loading the API key:", error);
        return null; // Return null if the key cannot be loaded
    }
}

// Function to send a request to the OpenAI API
async function sendMessageToAI(prompt) {
    const apiKey = await loadApiKey();
    if (!apiKey) {
        console.error("API key is missing or invalid.");
        return "Error: Unable to load the API key.";
    }

    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const data = {
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: "Je bent een AI chatbot die de redactie helpt met artikelen in WordPress schrijven. Hou de tekst kort en zorg dat het gesprek een conversatie stijl heeft dus niet grote lappen tekst. Geen alleen meer tekst als de gebruiker er voor vraagt, Geef maximaal 200 woorden" },
            { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
    };

    try {
        console.log("Sending prompt to OpenAI:", prompt);

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorDetail = await response.json();
            console.error("OpenAI API Error:", errorDetail);
            return `Error: ${errorDetail.error.message || "API request failed"}`;
        }

        const json = await response.json();
        console.log("Response from OpenAI:", json);
        return json.choices[0].message.content.trim();
    } catch (error) {
        console.error("Network or other error:", error);
        return "Error: Unable to process the request.";
    }
}

// Handle chat input
document.getElementById("send-btn").addEventListener("click", async () => {
    const userInput = document.getElementById("user-input").value.trim();
    if (!userInput) return;

    addMessage("user", userInput);
    document.getElementById("user-input").value = "";

    const prompt = `${globalArticleContent}\n\nVraag: ${userInput}`;
    const aiResponse = await sendMessageToAI(prompt);
    addMessage("assistant", aiResponse);
});

// Clear the chat history
document.getElementById("clear-btn").addEventListener("click", () => {
    const chatHistoryDiv = document.getElementById("chat-history");
    chatHistoryDiv.innerHTML = "";
    chrome.storage.local.remove("chatHistory", () => {
        console.log("Chat history cleared.");
    });
});

// Function to preload Titles.txt content
async function preloadTitlesData() {
    try {
        const response = await fetch(chrome.runtime.getURL('Titles.txt'));
        titlesTrainingData = await response.text();
        console.log("Titles.txt content loaded successfully:", titlesTrainingData.slice(0, 100)); // Log first 100 characters
    } catch (error) {
        console.error("Error loading Titles.txt content:", error);
        titlesTrainingData = "Geen trainingsdata beschikbaar.";
    }
}


// Handle button actions
document.getElementById("generate-headlines-btn").addEventListener("click", async () => {
    const prompt = `Genereer drie creatieve titels voor het volgende artikel, geef de titels in 3 aparte zinnen en regels, gebruik voorbeelden uit trainingsdata voor inspiratie:\n\n${globalArticleContent}`;
    addMessage("user", "Genereer titels");
    const aiResponse = await sendMessageToAI(prompt);
    addMessage("assistant", aiResponse);
});

document.getElementById("summarize-article-btn").addEventListener("click", async () => {
    const prompt = `Vat het volgende artikel samen in 50 woorden:\n\n${globalArticleContent}`;
    addMessage("user", "Vat artikel samen");
    const aiResponse = await sendMessageToAI(prompt);
    addMessage("assistant", aiResponse);
});
/*
document.getElementById("save-content-btn").addEventListener("click", async () => {
    const fileContent = globalArticleContent;
    const blob = new Blob([fileContent], { type: "text/plain" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "webpage_content.txt";
    link.click();
    console.log("Content saved to file:", link.download);
});
*/
document.getElementById("give-advice-btn").addEventListener("click", async () => {
    const prompt = `Ik ben een redacteur van het commercieel vastgoed b2b magazine Vastgoedmarkt, geef me tips over specifiek het artikel dat ik nu aan het schrijven ben. Geef maximaal 150 woorden, geef directe feedback over dingen in het artikel dat ik aan het schrijven ben:\n\n${globalArticleContent}`;
    addMessage("user", "Geef me advies");
    const aiResponse = await sendMessageToAI(prompt);
    addMessage("assistant", aiResponse);
});

// Function to fetch and display the help.txt content
async function displayHelpContent() {
    try {
        // Fetch the help.txt file from the extension's directory
        const response = await fetch(chrome.runtime.getURL('help.txt'));
        const helpText = await response.text();

        // Display the content as a message from the AI
        addMessage("assistant", helpText);
    } catch (error) {
        console.error("Error loading help.txt:", error);
        addMessage("assistant", "Er is een fout opgetreden bij het laden van de helpinformatie.");
    }
}

// Add an event listener to the "Help" button
document.getElementById("help-btn").addEventListener("click", displayHelpContent);



// On popup load
document.addEventListener("DOMContentLoaded", () => {
    preloadTitlesData(); // Load Titles.txt first
    loadChatHistory();
    preloadArticleContent();

    const userInputField = document.getElementById("user-input");
    userInputField.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            document.getElementById("send-btn").click();
        }
    });
});
