// Content script to detect the 'Correct!' message
console.log("[SparxSolver] Content script loaded.");

function showScreenshotOverlay(dataUrl) {
  // Remove any existing overlay
  const existing = document.getElementById("sparxsolver-screenshot-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "sparxsolver-screenshot-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "20px";
  overlay.style.right = "20px";
  overlay.style.zIndex = "99999";
  overlay.style.background = "rgba(255,255,255,0.95)";
  overlay.style.border = "1px solid #888";
  overlay.style.padding = "10px";
  overlay.style.borderRadius = "8px";
  overlay.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  overlay.innerHTML = `<div style="text-align:right"><button id="sparxsolver-close-overlay">✖</button></div>`;
  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.maxWidth = "400px";
  img.style.maxHeight = "300px";
  overlay.appendChild(img);
  document.body.appendChild(overlay);
  document.getElementById("sparxsolver-close-overlay").onclick = () =>
    overlay.remove();
}

function blockContinueButton(block) {
  const btn = document.querySelector(
    "div._ButtonsContainer_1ylu5_158._Correct_1ylu5_21 a._ButtonBase_nt2r3_1._FocusTarget_1nxry_1._ButtonMd_nt2r3_35._ButtonBlue_nt2r3_76._ButtonContained_nt2r3_111"
  );
  if (btn) {
    if (block) {
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.5";
      document.addEventListener("keydown", preventEnterKey, true);
    } else {
      btn.style.pointerEvents = "";
      btn.style.opacity = "";
      document.removeEventListener("keydown", preventEnterKey, true);
    }
  }
}

function preventEnterKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
  }
}

function replaceInputsWithSpans(root = document) {
  const replaced = [];
  root.querySelectorAll("input").forEach((input) => {
    const span = document.createElement("span");
    span.textContent = input.value;
    // Copy computed styles
    const style = window.getComputedStyle(input);
    span.style.display = "inline-block";
    span.style.width = style.width;
    span.style.height = style.height;
    span.style.fontSize = style.fontSize;
    span.style.fontFamily = style.fontFamily;
    span.style.fontWeight = style.fontWeight;
    span.style.color = style.color;
    span.style.background = style.background;
    span.style.border = style.border;
    span.style.boxSizing = style.boxSizing;
    span.style.paddingTop = style.paddingTop;
    span.style.paddingBottom = style.paddingBottom;
    span.style.paddingLeft = style.paddingLeft;
    span.style.paddingRight = style.paddingRight;
    span.style.textAlign = style.textAlign;
    // Improved vertical alignment
    if (style.lineHeight && style.lineHeight !== "normal") {
      span.style.lineHeight = style.lineHeight;
    } else if (style.height && style.height !== "auto") {
      span.style.lineHeight = style.height;
    } else {
      span.style.lineHeight = style.fontSize;
    }
    span.style.verticalAlign = "middle";
    input.parentNode.replaceChild(span, input);
    replaced.push({ input, span });
  });
  return replaced;
}

function restoreInputs(replaced) {
  replaced.forEach(({ input, span }) => {
    span.parentNode.replaceChild(input, span);
  });
}

function screenshotQuestionDivWithDelay(bookworkCode) {
  blockContinueButton(true);
  setTimeout(() => {
    const questionDiv = document.querySelector("div[class*='AnswerScreen'], div[class*='AnswerPart'], div[class*='OptionSelected']");
    if (!questionDiv) {
      console.log("Question div not found for screenshot.");
      blockContinueButton(false);
      return;
    }
    // Replace inputs with spans for html2canvas workaround
    const replaced = replaceInputsWithSpans(questionDiv);
    html2canvas(questionDiv, {
      scale: window.devicePixelRatio * 2,
      scrollY: -window.scrollY,
      useCORS: true,
      allowTaint: true,
    })
      .then((canvas) => {
        const dataUrl = canvas.toDataURL();
        console.log("Question screenshot (data URL):", dataUrl);
        // showScreenshotOverlay(dataUrl);
        if (bookworkCode) {
          sendMessageWithRetry({
            action: "saveBookwork",
            code: bookworkCode,
            url: dataUrl,
          });
        }
      })
      .catch((e) => {
        console.error("html2canvas error:", e);
      })
      .finally(() => {
        restoreInputs(replaced);
        blockContinueButton(false);
      });
  }, 500); // 500ms delay
}

function sendMessageWithRetry(message, retries = 3, delay = 100) {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      const errorMessage = chrome.runtime.lastError.message;
      if (
        errorMessage.includes(
          "The message port closed before a response was received"
        ) ||
        errorMessage.includes(
          "Could not establish connection. Receiving end does not exist."
        )
      ) {
        if (retries > 0) {
          console.warn(
            `[SparxSolver] Retrying message send, attempts left: ${retries - 1}`
          );
          setTimeout(
            () => sendMessageWithRetry(message, retries - 1, delay * 2),
            delay
          ); // Exponential backoff
        } else {
          console.error(
            "[SparxSolver] Failed to send message after multiple retries:",
            errorMessage
          );
          // Optionally, inform the user more directly here if needed
          if (message.action === "saveBookwork") {
            alert(
              "Failed to save bookwork. The extension's background service may be refreshing. Please try again in a moment."
            );
          }
        }
      } else {
        console.error(
          "[SparxSolver] Unhandled error sending message:",
          errorMessage
        );
      }
    } else {
      if (response && response.status === "success") {
        console.log(
          `[SparxSolver] Bookwork ${response.code} saved successfully.`
        );
      }
    }
  });
}

let lastCorrectHandled = false;

function isCleanBookworkCode(value) {
  return /^\d+[A-Za-z]+$/.test(value);
}

function findBookworkCode() {
  const taskItemsContainer = document.querySelector(
    "div[class*='TaskItemsContainer']"
  );

  if (taskItemsContainer) {
    const selectedCorrectTaskItem = taskItemsContainer.querySelector(
      "a[class*='Correct'][class*='Selected']"
    );
    const selectedCode = selectedCorrectTaskItem
      ?.querySelector("span")
      ?.textContent.trim();

    if (selectedCode && isCleanBookworkCode(selectedCode)) {
      console.log(
        `[SparxSolver] Found bookwork code from selected task item: ${selectedCode}`
      );
      return selectedCode;
    }
  }

  const bookworkCodeElement = [...document.querySelectorAll("*")]
    .filter((element) => element.textContent.includes("Bookwork code:"))
    .pop();

  if (bookworkCodeElement) {
    const match = bookworkCodeElement.textContent.match(
      /Bookwork code:\s*([0-9]+[A-Za-z]+)/
    );

    if (match && isCleanBookworkCode(match[1])) {
      console.log(
        `[SparxSolver] Found bookwork code from Bookwork code text: ${match[1]}`
      );
      return match[1];
    }
  }

  const bookworkLabelElements = [...document.querySelectorAll("*")].filter(
    (element) => {
      const text = element.textContent || "";
      if (!text.includes("Bookwork") || text.includes("Bookwork check")) {
        return false;
      }

      return !Array.from(element.children).some((child) => {
        const childText = child.textContent || "";
        return childText.includes("Bookwork");
      });
    }
  );

  for (const element of bookworkLabelElements) {
    const match = (element.textContent || "")
      .trim()
      .match(/^Bookwork\s+([0-9]+[A-Za-z]+)$/);

    if (match && isCleanBookworkCode(match[1])) {
      console.log(
        `[SparxSolver] Found bookwork code from Bookwork label: ${match[1]}`
      );
      return match[1];
    }
  }

  const detectedBookworkTexts = [...document.querySelectorAll("*")]
    .map((element) => (element.textContent || "").trim())
    .filter((text) => text.includes("Bookwork"))
    .slice(0, 5);

  console.warn(
    "[SparxSolver] Bookwork code not found; screenshot was captured but not saved.",
    detectedBookworkTexts
  );
  return null;
}

function logIfCorrectMessagePresent() {
  const correctSpan = document.querySelector("span._ResultMessage_1ylu5_132");
  if (correctSpan && correctSpan.textContent.trim() === "Correct!") {
    if (lastCorrectHandled) return; // Prevent repeat
    lastCorrectHandled = true;
    console.log("Correct!");
    const bookworkCode = findBookworkCode();
    // Take screenshot of the question div with delay and block continue
    screenshotQuestionDivWithDelay(bookworkCode);
  } else {
    lastCorrectHandled = false; // Reset if not present
  }
}

// Run once on load
logIfCorrectMessagePresent();
// Optionally, observe for changes in case the element appears later
const observer = new MutationObserver(() => {
  logIfCorrectMessagePresent();
});
observer.observe(document.body, { childList: true, subtree: true });
