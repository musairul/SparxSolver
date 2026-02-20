// popup.js
document.addEventListener("DOMContentLoaded", function () {
  console.log("[SparxSolver] Popup script loaded.");
  const solveButton = document.getElementById("solveButton");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const resultContainer = document.getElementById("resultContainer");
  const apiKeyScreen = document.getElementById("apiKeyScreen");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const saveApiKeyButton = document.getElementById("saveApiKeyButton");
  const changeApiKeyButton = document.getElementById("changeApiKeyButton");
  const solveTab = document.getElementById("solveTab");
  const bookworksTab = document.getElementById("bookworksTab");
  const solveTabBtn = document.getElementById("solveTabBtn");
  const bookworksTabBtn = document.getElementById("bookworksTabBtn");
  const headerCloseBtn = document.getElementById("headerCloseBtn");
  const finalAnswerScreen = document.getElementById("finalAnswerScreen");
  const finalAnswerDisplay = document.getElementById("finalAnswerDisplay");
  const explanationContainer = document.getElementById("explanationContainer");
  const toggleExplanationBtn = document.getElementById("toggleExplanationBtn");
  const explanationText = document.getElementById("explanationText");
  const tabHeader = document.getElementById("tabHeader");
  const providerSelect = document.getElementById("providerSelect");
  const apiKeyGroup = document.getElementById("apiKeyGroup");

  const PROVIDER_MODELS = {
    openrouter: "openrouter/free",
    cerebras: "gpt-oss-120b",
    gemini: "gemini-2.5-flash-lite",
    mistral: "mistral-medium-latest",
    groq: "openai/gpt-oss-120b",
  };

  function sendHeightToParent() {
    // Hide scrollbars on the iframe's content right before resizing starts
    document.body.style.overflow = "hidden";
    // A small delay to ensure the DOM is fully rendered before calculating height
    setTimeout(() => {
      // offsetHeight is more reliable for detecting when content shrinks.
      const height = document.body.offsetHeight;
      window.parent.postMessage(
        { action: "sparxSolver-resizeIframe", height: height },
        "*"
      );

      // Restore scrollbar visibility after the transition in the parent is likely complete.
      // The transition is 0.1s (100ms), so we'll wait a bit longer than that.
      setTimeout(() => {
        document.body.style.overflow = ""; // Revert to default
      }, 250);
    }, 100);
  }

  // Clear Bookworks Button Logic
  const clearBtn = document.getElementById("clearBookworksBtn");
  if (clearBtn) {
    clearBtn.onclick = function () {
      if (
        confirm(
          "Are you sure you want to delete all saved bookworks? This cannot be undone."
        )
      ) {
        chrome.storage.local.remove("bookworks", () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error clearing bookworks:",
              chrome.runtime.lastError
            );
          } else {
            console.log("[Bookwork] All bookworks have been cleared.");
            renderBookworkGallery(); // Refresh the gallery view
          }
        });
      }
    };
  }

  // Tab switching logic for classic tabs
  // Handle both close buttons
  function closeIframe() {
    // Send a message to the parent window (content script) to close the iframe.
    // We are in an iframe, so window.parent is the host page's window.
    // The content script will be listening for this.
    window.parent.postMessage({ action: "sparxSolver-closeIframe" }, "*");
  }

  // Function to reset solve tab to initial state
  function resetSolveTab() {
    if (finalAnswerScreen) {
      finalAnswerScreen.style.display = "none";
    }
    resultContainer.style.display = "block";
    // Always ensure solve button is visible - don't need to explicitly show it as it should always be visible
  }

  if (headerCloseBtn) {
    headerCloseBtn.onclick = closeIframe;
  }

  // API Key Logic
  function showApiKeyScreen() {
    apiKeyScreen.style.display = "block";
    solveButton.style.display = "none";
    resultContainer.style.display = "none";
    loadingIndicator.style.display = "none";
    changeApiKeyButton.style.display = "none";
    // Hide final answer/explanation if visible
    if (finalAnswerScreen) {
      finalAnswerScreen.style.display = "none";
      if (finalAnswerDisplay) finalAnswerDisplay.innerHTML = "";
      if (explanationText) explanationText.innerHTML = "";
    }
    // Ensure other tabs are not interfering if they were visible
    bookworksTab.style.display = "none";
    solveTab.style.display = "block"; // Keep solve tab visible
    tabHeader.style.display = "flex"; // Keep tab header visible

    // Pre-populate from storage
    chrome.storage.local.get(["apiKey", "provider"], (data) => {
      if (data.provider && providerSelect) {
        providerSelect.value = data.provider;
        apiKeyGroup.style.display = "block";
      } else {
        // Fresh state: reset dropdown and hide group
        if (providerSelect) providerSelect.value = "";
        apiKeyGroup.style.display = "none";
      }
      if (data.apiKey && apiKeyInput) {
        apiKeyInput.value = data.apiKey;
      } else if (apiKeyInput) {
        apiKeyInput.value = "";
      }
      sendHeightToParent();
    });
  }

  function hideApiKeyScreen() {
    apiKeyScreen.style.display = "none";
    solveButton.style.display = "block"; // Show solve button
    changeApiKeyButton.style.display = "block"; // Show change API key button
    // Restore the correct tab visibility based on current active tab
    if (solveTabBtn.classList.contains("tab-active")) {
      solveTab.style.display = "block";
      bookworksTab.style.display = "none";
    } else {
      // This case should ideally not be reached if API key screen is part of solveTab
      solveTab.style.display = "none";
      bookworksTab.style.display = "block";
    }
    sendHeightToParent();
  }

  // Provider dropdown change handler
  if (providerSelect) {
    providerSelect.addEventListener("change", () => {
      apiKeyGroup.style.display = providerSelect.value ? "block" : "none";
      sendHeightToParent();
    });
  }

  // Save button handler - saves provider, API key, and hardcoded model
  if (saveApiKeyButton && apiKeyInput) {
    saveApiKeyButton.onclick = () => {
      const provider = providerSelect.value;
      const apiKey = apiKeyInput.value.trim();
      if (!provider) {
        alert("Please select a provider.");
        return;
      }
      if (!apiKey) {
        alert("Please enter an API key.");
        return;
      }
      const model = PROVIDER_MODELS[provider];
      chrome.storage.local.set(
        { apiKey: apiKey, provider: provider, model: model },
        () => {
          console.log("[SparxSolver] Provider, API Key, and model saved.", { provider, model });
          hideApiKeyScreen();
        }
      );
    };
  }

  if (changeApiKeyButton) {
    changeApiKeyButton.onclick = showApiKeyScreen;
  }

  // Check for API key, provider, and model on load
  chrome.storage.local.get(["apiKey", "provider", "model"], (data) => {
    if (!data.apiKey || !data.provider || !data.model) {
      // If on solve tab, show API key screen
      if (solveTabBtn.classList.contains("tab-active")) {
        showApiKeyScreen();
      } else {
        // If on another tab (e.g., bookworks), don't automatically show API key screen
        // but ensure solve button is hidden if solve tab is not active and no key
        solveButton.style.display = "none";
        changeApiKeyButton.style.display = "none";
      }
    } else {
      // All config exists, normal setup
      solveButton.style.display = "block";
      changeApiKeyButton.style.display = "block";
      if (solveTabBtn.classList.contains("tab-active")) {
        solveTab.style.display = "block";
        bookworksTab.style.display = "none";
      }
    }
    sendHeightToParent();
  });

  if (solveTabBtn && bookworksTabBtn && solveTab && bookworksTab) {
    solveTabBtn.onclick = function () {
      chrome.storage.local.get(["apiKey", "provider", "model"], (data) => {
        if (!data.apiKey || !data.provider || !data.model) {
          showApiKeyScreen();
          resultContainer.style.display = "none"; // Ensure hidden if API key screen shown
        } else {
          hideApiKeyScreen(); // Ensure API screen is hidden if key exists
          solveButton.style.display = "block"; // Ensure solve button is visible

          // Only manage finalAnswerScreen and resultContainer if an API key exists
          // and a solve operation might have occurred or could occur.
          const hasFinalAnswer =
            finalAnswerDisplay && finalAnswerDisplay.children.length > 0;

          if (finalAnswerScreen) {
            finalAnswerScreen.style.display = hasFinalAnswer ? "block" : "none";
          }

          if (resultContainer) {
            // Hide result container if final answer is shown, or if no final answer and not loading.
            // It will be shown by solveButton click if a new solve is initiated.
            if (hasFinalAnswer) {
              resultContainer.style.display = "none";
            } else {
              // If no final answer, result container should be hidden unless actively loading/streaming
              // For now, upon tab switch, default to hidden if no final answer.
              // It will be set to 'block' by the solveButton click event.
              resultContainer.style.display = "none";
            }
          }
        }
        solveTab.style.display = "block";
        bookworksTab.style.display = "none";

        solveTabBtn.classList.add("tab-active");
        bookworksTabBtn.classList.remove("tab-active");
        sendHeightToParent();
      });
    };
    bookworksTabBtn.onclick = function () {
      // Always hide API key screen when switching to bookworks tab
      apiKeyScreen.style.display = "none";
      solveButton.style.display = "block"; // Or hide if you prefer until back on solve tab with key
      if (finalAnswerScreen) finalAnswerScreen.style.display = "none";
      if (resultContainer) resultContainer.style.display = "none"; // Hide result container on bookworks tab
      solveTab.style.display = "none";
      bookworksTab.style.display = "block";
      solveTabBtn.classList.remove("tab-active");
      bookworksTabBtn.classList.add("tab-active");
      renderBookworkGallery(); // This already calls sendHeightToParent
    };
  }

  // Show Solve tab by default, and check API key/provider/model status for it
  if (solveTab && bookworksTab && solveTabBtn && bookworksTabBtn) {
    chrome.storage.local.get(["apiKey", "provider", "model"], (data) => {
      if (!data.apiKey || !data.provider || !data.model) {
        showApiKeyScreen();
      } else {
        hideApiKeyScreen();
        solveButton.style.display = "block";
      }
      solveTab.style.display = "block";
      bookworksTab.style.display = "none";
      solveTabBtn.classList.add("tab-active");
      bookworksTabBtn.classList.remove("tab-active");
      sendHeightToParent();
    });
  }

  // Bookwork gallery rendering
  function renderBookworkGallery() {
    const gallery = document.getElementById("bookworkGallery");
    if (!gallery) return;
    gallery.innerHTML = ""; // Clear only the gallery content

    if (!chrome.storage || !chrome.storage.local) {
      gallery.innerHTML +=
        '<div style="color:red">chrome.storage.local not available.</div>';
      return;
    }
    chrome.storage.local.get("bookworks", function (data) {
      const bookworks = data.bookworks || {};
      console.log("[Bookwork] Fetched bookwork images for gallery:", bookworks);
      if (!bookworks || Object.keys(bookworks).length === 0) {
        gallery.innerHTML = "<div>No saved bookworks yet.</div>"; // Use '=' to replace content
        sendHeightToParent();
        return;
      }
      const list = document.createElement("div");
      for (const [code, url] of Object.entries(bookworks)) {
        const item = document.createElement("div");
        item.style.marginBottom = "16px";
        const img = document.createElement("img");
        img.src = url;
        img.style.maxWidth = "420px";
        img.style.maxHeight = "400px";
        img.style.border = "1px solid #ccc";
        img.style.display = "block";
        img.style.marginTop = "4px";
        img.style.cursor = "pointer";
        img.onclick = () => showImagePreview(url);

        const strong = document.createElement("strong");
        strong.textContent = code;

        item.appendChild(strong);
        item.appendChild(document.createElement("br"));
        item.appendChild(img);
        list.appendChild(item);
      }
      gallery.appendChild(list);
      sendHeightToParent();
    });
  }

  // --- Image Preview Modal Logic ---
  let scale = 1;

  function setTransform(element) {
    element.style.transform = `scale(${scale})`;
  }

  function showImagePreview(url) {
    const modal = document.getElementById("imagePreviewModal");
    const modalImg = document.getElementById("modalImage");
    if (modal && modalImg) {
      modal.style.display = "flex";
      modalImg.src = url;
      // Reset transformations on new image
      scale = 1;
      setTransform(modalImg);
    }
  }

  function hideImagePreview() {
    const modal = document.getElementById("imagePreviewModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  // Event listeners for modal
  const modal = document.getElementById("imagePreviewModal");
  const modalImg = document.getElementById("modalImage");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");

  if (modal && modalImg && zoomInBtn && zoomOutBtn) {
    // Close by clicking the 'x'
    const closeBtn = modal.querySelector(".modal-close");
    if (closeBtn) closeBtn.onclick = hideImagePreview;

    // Close by clicking outside the image
    modal.onclick = function (event) {
      if (event.target === modal) {
        hideImagePreview();
      }
    };

    // Zoom functionality with buttons
    zoomInBtn.onclick = () => {
      scale = Math.min(10, scale * 1.2);
      setTransform(modalImg);
    };

    zoomOutBtn.onclick = () => {
      scale = Math.max(1, scale / 1.2);
      setTransform(modalImg);
    };
  }

  // Preload gallery in case user switches
  renderBookworkGallery();

  // --- Explanation Toggle Logic ---
  if (toggleExplanationBtn && explanationText) {
    toggleExplanationBtn.addEventListener("click", () => {
      const isHidden = explanationText.style.display === "none";
      explanationText.style.display = isHidden ? "block" : "none";
      toggleExplanationBtn.textContent = isHidden
        ? "Minimise Explanation"
        : "Expand Explanation";
      sendHeightToParent(); // Adjust iframe height when explanation toggles
    });
  }

  solveButton.addEventListener("click", () => {
    chrome.storage.local.get(["apiKey", "provider", "model"], (data) => {
      if (!data.apiKey || !data.provider || !data.model) {
        showApiKeyScreen();
        return;
      }
      // Hide final answer screen and show result container for new solve
      if (finalAnswerScreen) {
        finalAnswerScreen.style.display = "none";
      }
      // FIX: Only show resultContainer, not create or append new ones
      resultContainer.style.display = "block";
      loadingIndicator.style.display = "block";
      resultContainer.innerHTML = "";

      // Use a port for streaming
      const port = chrome.runtime.connect({ name: "solveMathStream" });
      let solutionBuffer = "";
      let isDone = false;

      port.onMessage.addListener((msg) => {
        if (msg.chunk) {
          solutionBuffer += msg.chunk;
          // Show the streaming text as it arrives
          resultContainer.textContent = solutionBuffer;
        }
        if (msg.error) {
          loadingIndicator.style.display = "none";
          resultContainer.textContent = "Error: " + msg.error;
          port.disconnect();
          isDone = true;
        }
        if (msg.done && !isDone) {
          loadingIndicator.style.display = "none";
          resultContainer.style.display = "block";
          isDone = true;
          // Final formatting (same as before, but using solutionBuffer)
          let solution = solutionBuffer;
          solution = solution.replace(/\text/g, "\\text");
          const lines = solution.trim().split("\n");
          const finalAnswerText = lines[lines.length - 1];
          const finalAnswerDisplayElement = document.createElement("div");
          finalAnswerDisplayElement.classList.add("final-answer-display");
          finalAnswerDisplayElement.textContent = finalAnswerText;
          renderMathInElement(finalAnswerDisplayElement, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\[", right: "\\]", display: true },
              { left: "\\(", right: "\\)", display: false },
            ],
          });
          resultContainer.innerHTML = "";
          // DO NOT append finalAnswerDisplayElement to resultContainer here

          // Populate explanation text with the full solution
          if (explanationText && finalAnswerDisplay) {
            finalAnswerDisplay.innerHTML = "";
            finalAnswerDisplay.appendChild(finalAnswerDisplayElement);

            const explanationDiv = document.createElement("div");
            explanationDiv.innerHTML = solutionBuffer.replace(/\n/g, "<br>");
            explanationDiv.style.whiteSpace = "pre-wrap";
            explanationDiv.style.wordWrap = "break-word";

            renderMathInElement(explanationDiv, {
              delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false },
                { left: "\\[", right: "\\]", display: true },
                { left: "\\(", right: "\\)", display: false },
              ],
            });
            explanationText.innerHTML = "";
            explanationText.appendChild(explanationDiv);
          }

          // Show final answer screen within the solve tab
          if (finalAnswerScreen) {
            finalAnswerScreen.style.display = "block";
            resultContainer.style.display = "none";
          }

          if (explanationText && toggleExplanationBtn) {
            explanationText.style.display = "none";
            toggleExplanationBtn.textContent = "Expand Explanation";
          }

          sendHeightToParent();
          port.disconnect();
        }
      });
      port.postMessage({ action: "solveMath" });
    });

    sendHeightToParent();
  });
});
