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
      imageContainerDiv.style.border = "5px solid #ff0000";
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

 function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForContinue(timeout = 5000, interval = 100) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const continueLink = findContinueLink();

    if (continueLink) {
      return continueLink;
    }

    await sleep(interval);
  }

  return null;
}

function findAnswerButton() {
  console.log("[SparxSolver] Finding Answer button...");

  return [...document.querySelectorAll("button")].find(button =>
    button.textContent.trim().toLowerCase() === "answer"
  ) || null;
}

function clickAnswerButton() {
  console.log("[SparxSolver] Clicking Answer button...");

  const button = findAnswerButton();

  if (!button) {
    console.error("[SparxSolver] Answer button not found.");
    return false;
  }

  button.click();
  return true;
}

function isNumericAnswer() {
  console.log('isNumericAnswer =', !!document.querySelector("[data-numeric-keypad]"));
  return !!document.querySelector("[data-numeric-keypad]");
}

function formatNumericAnswer(answer) {
  //finds all numbers and returns the last one, which is usually the final answer
  const matches = String(answer).match(/-?\d+(\.\d+)?/g);
  return matches ? matches[matches.length - 1] : null;
}

async function typeNumericAnswer(finalAnswer) {
  finalAnswer = formatNumericAnswer(finalAnswer);
  console.log("[SparxSolver] Typing numeric answer:", finalAnswer);

  const input = document.querySelector("input[data-ref][readonly]");

  if (!input) {
    console.error("[SparxSolver] Numeric input not found.");
    return false;
  }

  input.click();
  input.focus();

  await sleep(100);

  for (const key of String(finalAnswer)) {
    let code;

    if (/^\d$/.test(key)) {
      code = `Digit${key}`;
    } else if (key === ".") {
      code = "Period";
    } else if (key === "-") {
      code = "Minus";
    } else {
      code = `Key${key.toUpperCase()}`;
    }

    input.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      code,
      bubbles: true,
      cancelable: true
    }));

    input.dispatchEvent(new KeyboardEvent("keypress", {
      key,
      code,
      bubbles: true,
      cancelable: true
    }));

    input.dispatchEvent(new KeyboardEvent("keyup", {
      key,
      code,
      bubbles: true,
      cancelable: true
    }));

    await sleep(20);
  }

  return true;
}

async function typeAnswer(finalAnswer) {
  if (isNumericAnswer()) {
    return await typeNumericAnswer(finalAnswer);
  }

  console.error("[SparxSolver] Unsupported answer type.");
  return false;
}

function waitForSubmitButton(timeout = 10000, interval = 100) {
  console.log("[SparxSolver] Waiting for Submit button...");

  return new Promise((resolve) => {
    const start = Date.now();

    const timer = setInterval(() => {
      const btn = findSubmitButton();

      if (btn) {
        clearInterval(timer);
        console.log("[SparxSolver] Submit button found.");
        return resolve(btn);
      }

      if (Date.now() - start > timeout) {
        clearInterval(timer);
        console.log("[SparxSolver] Submit button timeout.");
        return resolve(null);
      }
    }, interval);
  });
}

function findSubmitButton() {
  console.log("[SparxSolver] Finding Submit button...");

  return [...document.querySelectorAll("button")].find(button =>
    button.textContent.trim().toLowerCase().startsWith("submit")
  ) || null;
}

function clickSubmitButton(button) {
  console.log("[SparxSolver] Clicking Submit button...");

  if (!button) {
    console.error("[SparxSolver] Submit button not found.");
    return false;
  }

  button.click();
  return true;
}

function waitForContinueLink(timeout = 10000, interval = 500) {
  console.log("[SparxSolver] Waiting for Continue link...");

  return new Promise((resolve) => {
    const start = Date.now();

    const timer = setInterval(() => {
      const link = findContinueLink();

      if (link) {
        const pointerEvents = window.getComputedStyle(link).pointerEvents;

        // clickable when NOT "none"
        if (pointerEvents !== "none") {
          clearInterval(timer);
          console.log("[SparxSolver] Continue link is clickable.");
          return resolve(link);
        }
      }

      if (Date.now() - start > timeout) {
        clearInterval(timer);
        console.log("[SparxSolver] Continue link timeout.");
        return resolve(null);
      }
    }, interval);
  });
}

function findContinueLink() {
  console.log("[SparxSolver] Finding Continue link...");

  return [...document.querySelectorAll("a")].find(link =>
    link.textContent.trim().toLowerCase() === "continue"
  ) || null;
}

function disableAutoSolveAfterFailure() {
  chrome.storage.local.set({ autoSolveEnabled: false }, () => {
    chrome.runtime.sendMessage({ action: "autoSolveDisabled" });
  });
}

function handleAutoSolveFailure() {
  console.error("[SparxSolver] Auto solve failed.");

  disableAutoSolveAfterFailure();
  alert("Auto solve failed");
}

async function runAutoSolvePageFlow(finalAnswer) {
  console.log("[SparxSolver] Auto solve answer ready:", finalAnswer);

  // Click the Answer button
  if (!clickAnswerButton()) {
    handleAutoSolveFailure();
    return;
  }

  const submitBtn = await waitForSubmitButton();

  if (!submitBtn) {
    handleAutoSolveFailure();
    return;
  }

  // Type the answer
  if (!(await typeAnswer(finalAnswer))) {
    handleAutoSolveFailure();
    return;
  }

  await sleep(150);

  // Click Submit
  if (!clickSubmitButton(submitBtn)) {
    handleAutoSolveFailure();
    return;
  }

  await sleep(1500);

  console.log("[SparxSolver] Waiting for Continue link...");

  const continueLink = await waitForContinueLink();

  if (!continueLink) {
    handleAutoSolveFailure();
    return;
  }

  console.log("[SparxSolver] Continue link found.");

  continueLink.click();
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
  }

  else if (request.action === "autoSolveAnswerReady") {
    (async () => {
      try {
        await runAutoSolvePageFlow(request.finalAnswer);

        sendResponse({
          status: "Auto solve completed"
        });
      } catch (err) {
        console.error("[SparxSolver] Auto solve failed:", err);

        sendResponse({
          status: "Auto solve failed",
          error: err.message
        });
      }
    })();
  }

  else if (request.action === "enablePointerEvents") {
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
    }, 2000);
  }

  return true;
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
  const questionEl =
          document.querySelector('[class*="QuestionWrapper"]') ||
          document.querySelector('[class^="_Question_"]');
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
