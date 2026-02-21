// content.js

(function () {
  // This function is to prevent running the script multiple times on the same page,
  // which can happen with some navigation events.
  if (window.hasRunSparxSolverContent) {
    return;
  }
  window.hasRunSparxSolverContent = true;

  console.log("[SparxSolver] Content script loaded.");

  // Function to find and display bookwork answer
  function findAndDisplayBookworkAnswer() {
    // Get all elements on the page (not just divs)
    const allElements = Array.from(document.querySelectorAll("*"));

    // Filter for innermost elements that contain "Bookwork" text
    // (exclude parent elements that only contain "Bookwork" via child elements)
    const bookworkElements = allElements.filter((element) => {
      const text = element.textContent || "";
      if (!text.includes("Bookwork")) return false;

      // Check if any child element also contains "Bookwork"
      const hasChildWithBookwork = Array.from(element.children).some((child) => {
        return child.textContent && child.textContent.includes("Bookwork");
      });

      // Only return true if this element contains "Bookwork" but children don't
      return !hasChildWithBookwork;
    });

    console.log(bookworkElements)

    if (bookworkElements.length === 0) {
      console.log("[SparxSolver] No element containing 'Bookwork' found on page.");
      return;
    }

    console.log(
      `[SparxSolver] Found ${bookworkElements.length} element(s) containing 'Bookwork'.`
    );

    // Find the "Bookwork check" element to exclude it
    const bookworkCheckElement = bookworkElements.find((element) => {
      const text = (element.textContent || "").trim();
      return text.includes("Bookwork check");
    });

    console.log(bookworkCheckElement)

    // Filter out the "Bookwork check" element to get the actual bookwork code element
    const bookworkCodeElements = bookworkElements.filter((element) => element !== bookworkCheckElement);

    if (bookworkCodeElements.length === 0) {
      console.log(
        "[SparxSolver] No bookwork code element found (only 'Bookwork check' present)."
      );
      return;
    }

    // Use the first matching bookwork code element (e.g., "Bookwork 5B")

    const targetElement = bookworkCodeElements[0];
    console.log(
      "[SparxSolver] Target bookwork code element found. Text:",
      targetElement.textContent
    );
    const fullText = (targetElement.textContent || "").trim();

    console.log(
      "[SparxSolver] Found target bookwork div. Text:",
      fullText
    );

    // Extract bookwork code (e.g., "5B" from "Bookwork 5B")
    const bookworkCode = fullText.replace("Bookwork", "").trim();

    if (!bookworkCode) {
      console.warn(
        "[SparxSolver] Could not extract bookwork code from div text:",
        fullText
      );
      return;
    }

    console.log("[SparxSolver] Extracted bookwork code:", bookworkCode);

    chrome.storage.local.get("bookworks", (data) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[SparxSolver] Error retrieving bookworks from storage:",
          chrome.runtime.lastError.message
        );
        return;
      }

      const bookworks = data.bookworks;
      
      if (!bookworks || !bookworks[bookworkCode]) {
        console.log(
          `[SparxSolver] No image URL found in storage for bookwork code: ${bookworkCode}.`
        );
        return;
      }

      const imageUrl = bookworks[bookworkCode];
      console.log(`[SparxSolver] Found image URL for ${bookworkCode}.`);

      const containerId = `sparx-bookwork-container-${bookworkCode}`;
      if (document.getElementById(containerId)) {
        console.log(
          `[SparxSolver] Bookwork container for ${bookworkCode} already exists.`
        );
        return;
      }

      // Create the main container div
      const imageContainerDiv = document.createElement("div");
      imageContainerDiv.id = containerId;
      imageContainerDiv.style.maxWidth = "600px";
      imageContainerDiv.style.marginTop = "15px";
      imageContainerDiv.style.marginBottom = "15px";
      imageContainerDiv.style.padding = "10px";
      imageContainerDiv.style.border = "5px solid #000000";
      imageContainerDiv.style.backgroundColor = "#f9f9f9";

      // Create the text element
      const textElement = document.createElement("p");
      textElement.textContent = "Correct Answer";
      textElement.style.fontWeight = "bold";
      textElement.style.marginBottom = "5px";

      // Create the image element
      const imgElement = document.createElement("img");
      imgElement.src = imageUrl;
      imgElement.alt = `Bookwork ${bookworkCode} Image`;
      imgElement.style.display = "block";
      imgElement.style.maxWidth = "100%";
      imgElement.style.height = "auto";
      imgElement.style.border = "1px solid #ccc";

      // Append text and image to the container div
      imageContainerDiv.appendChild(textElement);
      imageContainerDiv.appendChild(imgElement);

      // Insert the container div after the target bookwork element
      targetElement.insertAdjacentElement("afterend", imageContainerDiv);
      console.log(
        `[SparxSolver] Bookwork container for ${bookworkCode} inserted after div.`
      );
    });
  }

  const IFRAME_ID = "sparx-solver-iframe";
  const MAX_IFRAME_HEIGHT = 700; // Maximum height for the iframe in pixels
  let iframe = null;
  let isIframeVisible = false;

  function createIframe() {
    if (document.getElementById(IFRAME_ID)) {
      return document.getElementById(IFRAME_ID);
    }

    const iframeElement = document.createElement("iframe");
    iframeElement.id = IFRAME_ID;
    iframeElement.src = chrome.runtime.getURL("popup.html");
    iframeElement.style.position = "fixed";
    iframeElement.style.top = "20px";
    iframeElement.style.right = "20px";
    iframeElement.style.width = "475px";
    iframeElement.style.height = "200px"; // Initial height, will be adjusted dynamically
    iframeElement.style.zIndex = "99999";
    iframeElement.style.border = "1px solid #dbdbdb";
    iframeElement.style.borderRadius = "8px";
    iframeElement.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    iframeElement.style.backgroundColor = "white";
    iframeElement.style.display = "none"; // Initially hidden
    iframeElement.style.transition = "height 0.2s ease-in-out";

    document.body.appendChild(iframeElement);
    return iframeElement;
  }

  function toggleIframe() {
    if (!iframe) {
      iframe = createIframe();
    }

    isIframeVisible = !isIframeVisible;
    iframe.style.display = isIframeVisible ? "block" : "none";
    console.log(
      `[SparxSolver] Iframe visibility toggled to: ${iframe.style.display}`
    );
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggle_ui") {
      console.log("[SparxSolver] Toggle UI message received.");
      toggleIframe();
      sendResponse({ status: "UI toggled" });
    } else if (request.action === "enablePointerEvents") {
      setTimeout(() => {
        document.body.style.setProperty("pointer-events", "all", "important");
        console.log(
          "[SparxSolver] Pointer events enabled on body with !important after 2000ms delay."
        );
        sendResponse({
          status: "Pointer events enabled with !important after delay",
        });

        // ---- BOOKWORK CHECK LOGIC ----
        findAndDisplayBookworkAnswer();
        // ---- END BOOKWORK CHECK LOGIC ----
      }, 2000); // Current delay
    }
    return true; // Keep the message channel open for async response
  });

  // Listen for messages from the iframe (e.g., to close itself or resize)
  window.addEventListener("message", (event) => {
    // IMPORTANT: Validate the origin of the message
    if (event.origin !== new URL(chrome.runtime.getURL("")).origin) {
      return;
    }

    if (event.data) {
      switch (event.data.action) {
        case "sparxSolver-closeIframe":
          if (isIframeVisible) {
            toggleIframe();
          }
          break;
        case "sparxSolver-resizeIframe":
          if (iframe && event.data.height) {
            // Add a small buffer to prevent scrollbars
            let newHeight = event.data.height + 20;
            if (newHeight > MAX_IFRAME_HEIGHT) {
              newHeight = MAX_IFRAME_HEIGHT;
            }
            iframe.style.height = `${newHeight}px`;
          }
          break;
      }
    }
  });

  // Listen for screenshot request from background.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "captureQuestionScreenshot") {
      // Dynamically load html2canvas if not present
      function doScreenshot() {
        const questionEl = document.querySelector("._QuestionWrapper_ypayp_46");
        if (!questionEl) {
          sendResponse({ error: "Question element not found." });
          return;
        }
        window
          .html2canvas(questionEl, {
            scale: window.devicePixelRatio * 2,
            useCORS: true,
            allowTaint: true,
          })
          .then((canvas) => {
            const dataUrl = canvas.toDataURL();
            sendResponse({ dataUrl });
          })
          .catch((e) => {
            sendResponse({ error: e.message });
          });
      }
      if (window.html2canvas) {
        doScreenshot();
      } else {
        // Inject html2canvas if not present
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("libs/html2canvas.min.js");
        script.onload = doScreenshot;
        document.head.appendChild(script);
      }
      return true; // Keep channel open for async response
    }
  });
})();
