// background.js

// Function to load system prompt from file
async function loadSystemPrompt() {
  try {
    const url = chrome.runtime.getURL("systemprompt.txt");
    const response = await fetch(url);
    return await response.text();
  } catch (error) {
    console.error("Failed to load system prompt:", error);
    return "You are an expert AI assistant configured to solve UK GCSE Maths problems."; // Fallback prompt
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "solveMath") {
    captureAndProcessScreenshot(sendResponse);
    return true; // Indicates that the response will be sent asynchronously
  }
  if (request.action === "saveBookwork") {
    if (request.code && request.url) {
      chrome.storage.local.get("bookworks", (data) => {
        const bookworks = data.bookworks || {};
        bookworks[request.code] = request.url;
        chrome.storage.local.set({ bookworks: bookworks }, () => {
          console.log(`[Background] Saved bookwork: ${request.code}`);
          sendResponse({ status: "success", code: request.code });
        });
      });
    }
    return true;
  }
});

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === "solveMathStream") {
    port.onMessage.addListener(async function (msg) {
      if (msg.action === "solveMath") {
        try {
          // Fetch API Key from storage
          const { apiKey: storedApiKey } = await new Promise((resolve) =>
            chrome.storage.local.get("apiKey", resolve)
          );

          if (!storedApiKey) {
            port.postMessage({
              error: "API Key not found. Please set it in the extension popup.",
            });
            port.disconnect();
            return;
          }

          // 1. Request screenshot of the question element from content script
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (!tab || !tab.id) {
            port.postMessage({ error: "No active tab found." });
            port.disconnect();
            return;
          }
          const dataUrlResponse = await new Promise((resolve) => {
            chrome.tabs.sendMessage(
              tab.id,
              { action: "captureQuestionScreenshot" },
              (response) => resolve(response)
            );
          });
          if (!dataUrlResponse || dataUrlResponse.error) {
            port.postMessage({
              error:
                dataUrlResponse?.error ||
                "Failed to capture question screenshot.",
            });
            port.disconnect();
            return;
          }
          const dataUrl = dataUrlResponse.dataUrl;
          const base64ImageData = dataUrl.split(",")[1];

          const detailedPrompt = await loadSystemPrompt();
          const requestBody = {
            contents: [
              {
                parts: [
                  { text: detailedPrompt },
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: base64ImageData,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              topK: 32,
              topP: 1,
              maxOutputTokens: 4096,
              stopSequences: [],
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
            ],
          };
          // 2. Stream API Call
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${storedApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            }
          );
          if (!response.ok || !response.body) {
            port.postMessage({
              error: `API request failed: ${response.status} ${response.statusText}`,
            });
            port.disconnect();
            return;
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let done = false;
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            if (value) {
              buffer += decoder.decode(value, { stream: true });
              let lineEnd;
              while ((lineEnd = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, lineEnd).trim();
                buffer = buffer.slice(lineEnd + 1);
                if (line.startsWith("data: ")) {
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") {
                    done = true;
                    break;
                  }
                  if (!data) continue;
                  try {
                    const parsed = JSON.parse(data);
                    const chunk =
                      parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (chunk) {
                      port.postMessage({ chunk });
                    }
                  } catch (e) {
                    // If JSON.parse fails, put this line back in buffer and wait for more data
                    buffer = line + "\n" + buffer;
                    break;
                  }
                }
              }
            }
            if (streamDone) break;
          }
          port.postMessage({ done: true });
          port.disconnect();
        } catch (error) {
          port.postMessage({
            error: `An unexpected error occurred: ${error.message}`,
          });
          port.disconnect();
        }
      }
    });
  }
});

async function captureAndProcessScreenshot(sendResponse) {
  try {
    // Fetch API Key from storage
    const { apiKey: storedApiKey } = await new Promise((resolve) =>
      chrome.storage.local.get("apiKey", resolve)
    );

    if (!storedApiKey) {
      sendResponse({
        error: "API Key not found. Please set it in the extension popup.",
      });
      return;
    }

    // 1. Capture Screenshot
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: "png",
    });
    if (!dataUrl) {
      sendResponse({ error: "Failed to capture screenshot." });
      return;
    } // 2. Prepare Image for API (extract base64 data)
    // The dataUrl is in the format "data:image/png;base64,BASE64_ENCODED_IMAGE_DATA"
    // We need to extract just the BASE64_ENCODED_IMAGE_DATA part.
    const base64ImageData = dataUrl.split(",")[1];

    const detailedPrompt = await loadSystemPrompt();

    // 3. Construct API Request
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: detailedPrompt,
            },
            {
              inlineData: {
                mimeType: "image/png",
                data: base64ImageData,
              },
            },
          ],
        },
      ],
      generationConfig: {
        // Optional: customize as needed
        temperature: 0.3,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096, // Adjust as needed
        stopSequences: [],
      },
      safetySettings: [
        // Optional: Adjust safety settings
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    };

    // 4. Make API Call
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${storedApiKey}`;
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("API Error Response:", errorBody);
      sendResponse({
        error: `API request failed: ${response.status} ${
          response.statusText
        }. ${errorBody?.error?.message || "Check console for details."}`,
      });
      return;
    }

    const responseData = await response.json();

    // 5. Extract Solution
    // The structure of the response needs to be carefully checked against the Gemini API documentation.
    // Assuming the solution is in responseData.candidates[0].content.parts[0].text
    if (
      responseData.candidates &&
      responseData.candidates.length > 0 &&
      responseData.candidates[0].content &&
      responseData.candidates[0].content.parts &&
      responseData.candidates[0].content.parts.length > 0 &&
      responseData.candidates[0].content.parts[0].text
    ) {
      const solutionText = responseData.candidates[0].content.parts[0].text;
      sendResponse({ solution: solutionText });
    } else {
      console.error("Unexpected API response structure:", responseData);
      // Check for promptFeedback for blocked content
      if (
        responseData.promptFeedback &&
        responseData.promptFeedback.blockReason
      ) {
        sendResponse({
          error: `AI could not process the request. Reason: ${responseData.promptFeedback.blockReason}. It might be due to safety settings or an unclear image.`,
        });
      } else {
        sendResponse({
          error:
            "Could not extract solution from AI response. The response structure might have changed or the content is missing.",
        });
      }
    }
  } catch (error) {
    console.error("Error in background script:", error);
    sendResponse({ error: `An unexpected error occurred: ${error.message}` });
  }
}

// Log for debugging when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("SparxSolver extension installed/updated.");
});

chrome.action.onClicked.addListener((tab) => {
  // We can only inject into http/https pages, not chrome:// pages or other extension pages.
  if (tab.url?.startsWith("http")) {
    chrome.tabs.sendMessage(tab.id, { action: "toggle_ui" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(
          "[SparxSolver] Could not send message to content script, probably not injected yet. Error:",
          chrome.runtime.lastError.message
        );
      } else {
        console.log(
          "[SparxSolver] Sent toggle_ui message, response:",
          response
        );
      }
    });
  } else {
    console.log(
      "[SparxSolver] Cannot inject UI into non-http/s page:",
      tab.url
    );
  }
});

// Function to check URL and attempt to enable pointer events if it ends with "wac"
async function checkUrlForWac(tabId, url) {
  if (!(url?.startsWith("http://") || url?.startsWith("https://"))) {
    return;
  }

  if (url && url.endsWith("wac")) {
    console.log(
      "[SparxSolver] Current URL ends with wac, attempting to enable pointer events:",
      url
    );

    const sendMessageToContentScript = (isRetry = false) => {
      chrome.tabs.sendMessage(
        tabId,
        { action: "enablePointerEvents" },
        (response) => {
          if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message;
            console.warn(
              `[SparxSolver] ${
                isRetry ? "Retry " : ""
              }Send "enablePointerEvents" failed:`,
              errorMessage
            );

            if (
              !isRetry &&
              errorMessage &&
              errorMessage.includes("Could not establish connection")
            ) {
              console.log(
                "[SparxSolver] Content script may not be injected. Attempting programmatic injection..."
              );
              chrome.scripting.executeScript(
                {
                  target: { tabId: tabId },
                  files: ["content.js"],
                },
                (injectionResults) => {
                  if (chrome.runtime.lastError) {
                    console.error(
                      "[SparxSolver] Failed to inject content script:",
                      chrome.runtime.lastError.message
                    );
                    return;
                  }
                  console.log(
                    "[SparxSolver] Content script injection attempted. Retrying message..."
                  );
                  sendMessageToContentScript(true); // Retry sending the message
                }
              );
            }
          } else {
            console.log(
              `[SparxSolver] Sent "enablePointerEvents" message ${
                isRetry ? "on retry " : ""
              }successfully, response:`,
              response
            );
          }
        }
      );
    };

    sendMessageToContentScript(); // Initial attempt
  }
}

// Listener for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const urlToCheck = changeInfo.url || (tab ? tab.url : null);
  if (urlToCheck) {
    if (changeInfo.status === "complete") {
      // Ensure page is loaded before checking URL
      checkUrlForWac(tabId, urlToCheck);
    }
  }
});

// Listener for tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url && tab.status === "complete") {
      // Ensure tab is loaded
      checkUrlForWac(tab.id, tab.url);
    }
  } catch (error) {
    // Gracefully handle cases where tab might not be accessible or was closed
    if (
      error &&
      error.message &&
      !error.message.includes("No tab with id") &&
      !error.message.includes("cannot be scripted") &&
      !error.message.includes("Invalid tab ID")
    ) {
      console.warn(
        "[SparxSolver] Error getting tab info on activation:",
        error.message
      );
    }
  }
});
