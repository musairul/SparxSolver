// content.js

(function () {
  // This function is to prevent running the script multiple times on the same page,
  // which can happen with some navigation events.
  if (window.hasRunSparxSolverContent) {
    return;
  }
  window.hasRunSparxSolverContent = true;

  console.log("[SparxSolver] Content script loaded.");

  function extractBookworkCodeFromText(text) {
    const match = String(text || "")
      .trim()
      .match(/(?:^|\b)Bookwork(?:\s+code:)?\s+([0-9]+[A-Za-z]+)\b/i);

    return match ? match[1] : null;
  }

  function findCurrentBookworkChip() {
    const classMatchedChip = Array.from(document.querySelectorAll("div[class*='Bookwork']")).find((element) => {
      const text = (element.textContent || "").trim();
      return /^Bookwork\s+[0-9]+[A-Za-z]+$/i.test(text);
    });

    if (classMatchedChip) {
      return classMatchedChip;
    }

    return Array.from(document.querySelectorAll("div")).find((element) => {
      const text = (element.textContent || "").trim();
      if (!/^Bookwork\s+[0-9]+[A-Za-z]+$/i.test(text)) {
        return false;
      }

      return !Array.from(element.children).some((child) =>
        /Bookwork/i.test(child.textContent || "")
      );
    }) || null;
  }

  function findCurrentBookworkCode() {
    const chip = findCurrentBookworkChip();
    const chipCode = extractBookworkCodeFromText(chip?.textContent);

    if (chipCode) {
      console.log(`[SparxSolver] Found bookwork code from chip: ${chipCode}`);
      return { code: chipCode, element: chip };
    }

    const textMatchElement = Array.from(document.querySelectorAll("*")).find((element) => {
      const text = (element.textContent || "").trim();
      if (/Bookwork check/i.test(text)) {
        return false;
      }

      if (!extractBookworkCodeFromText(text)) {
        return false;
      }

      return !Array.from(element.children).some((child) =>
        extractBookworkCodeFromText(child.textContent || "")
      );
    });

    const fallbackCode = extractBookworkCodeFromText(textMatchElement?.textContent);
    if (fallbackCode) {
      console.log(`[SparxSolver] Found bookwork code from fallback text: ${fallbackCode}`);
      return { code: fallbackCode, element: textMatchElement };
    }

    console.warn("[SparxSolver] Current bookwork code chip not found.");
    return { code: null, element: null };
  }

  function isBookworkCheckPage() {
    return Array.from(document.querySelectorAll("*")).some((element) =>
      (element.textContent || "").trim().toLowerCase().includes("bookwork check")
    );
  }

  // Function to find and display bookwork answer
  function findAndDisplayBookworkAnswer() {
    const { code: bookworkCode, element: targetElement } = findCurrentBookworkCode();

    if (!bookworkCode || !targetElement) {
      console.log("[SparxSolver] No current bookwork chip/code found for image injection.");
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
    const continueLink = findLinkWithNestedText('continue');

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

function getOrderedAnswerItems() {
  let answerParts = [
    ...document.querySelectorAll("[class*='AnswerPart']")
  ];

  const items = [];

  if (answerParts.length === 0) {
    const mainContainer = document.querySelector("div[class*='QuestionWrapper']");
    if (mainContainer) {
      console.log("[SparxSolver] No AnswerPart elements found. Using main QuestionWrapper container.");
      answerParts = [mainContainer];
    }
  }

  console.log("answerParts", answerParts);

  for (const part of answerParts) {
    const numericInputs = [
      ...part.querySelectorAll("input[class*='TextFieldNumeric']")
    ];

    if (numericInputs.length) {
      for (const input of numericInputs) {
        items.push({
          type: "numeric",
          input
        });
      }
    }

    // Locate this section inside getOrderedAnswerItems() loop and append the multiple-choice check:

    const multipleChoiceButtons = [
      ...part.querySelectorAll('div[role="button"]')
    ].filter(choice => !choice.querySelector("img")); // Filter OUT items that contain images

    if (multipleChoiceButtons.length > 0) {
      items.push({
        type: "multiple-choice",
        answerPart: part,
        choices: multipleChoiceButtons
      });
    }

    const imageChoices = [
      ...part.querySelectorAll('div[role="button"]')
    ].filter(choice => choice.querySelector("img"));

    if (imageChoices.length > 1) {
      items.push({
        type: "image",
        answerPart: part,
        choices: imageChoices
      });
    }

    const inlineSlots = [
      ...part.querySelectorAll("[class*='_CardContentEmpty_']")
    ];

    if (inlineSlots.length) {
      for (const slot of inlineSlots) {
        // Ensure we grab the outer clickable container div
        const slotButton = slot.closest("[class*='_CardContentEmpty_']") || slot;
        items.push({
          type: "inline-slot",
          slot: slotButton
        });
      }
    }

  }

  return items;
}

/**
 * Safely extracts clean text or raw LaTeX notation from a DOM element,
 * prioritizing KaTeX source annotations over messy text concatenation.
 */
function extractChoiceText(choiceElement) {
  // 1. Try to find KaTeX source annotation string (raw LaTeX format)
  const annotation = choiceElement.querySelector('annotation[encoding="application/x-tex"]');
  if (annotation) {
    return annotation.textContent.trim();
  }
  
  // 2. Fallback to just the rendered visual HTML block to avoid duplicate MathML text
  const katexHtml = choiceElement.querySelector('.katex-html');
  if (katexHtml) {
    return katexHtml.textContent.trim();
  }
  
  // 3. Standard plain text fallback
  return choiceElement.textContent.trim();
}

/**
 * Strips mathematical syntax noise (backslashes, braces, parentheses, spaces)
 * to ensure that text-based variants and LaTeX tokens resolve to identical strings.
 */
function cleanMathText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/\\/g, "")          // Remove backslashes (\tan -> tan)
    .replace(/[{}]/g, "")        // Remove grouping braces
    .replace(/[()]/g, "")        // Remove parentheses
    .replace(/\s+/g, "")         // Remove all whitespace
    .trim();
}

/**
 * Character crawler that advances through the stream and slices off the matched text,
 * dynamically skipping formatting symbols and whitespace noise.
 */
function consumePhraseResilient(currentText, cleanChoiceText) {
  if (!cleanChoiceText) return currentText;
  
  const cleanCurrent = cleanMathText(currentText);
  const cleanMatchStart = cleanCurrent.indexOf(cleanChoiceText);
  
  if (cleanMatchStart === -1) return currentText; // Fallback safety
  
  let cleanIdx = 0;
  let originalIdx = 0;
  let currentCleanCount = 0;
  
  while (originalIdx < currentText.length && cleanIdx < cleanChoiceText.length) {
    const origChar = currentText[originalIdx].toLowerCase();
    
    // Check if this character is one that cleanMathText keeps
    const isKept = !/[\\{}\s()]/.test(origChar);
    
    if (isKept) {
      if (currentCleanCount >= cleanMatchStart) {
        if (origChar === cleanChoiceText[cleanIdx]) {
          cleanIdx++;
        } else {
          cleanIdx = 0; // Reset progress if a segment breaks mid-evaluation
        }
      }
      currentCleanCount++;
    }
    originalIdx++;
  }
  
  return currentText.slice(originalIdx);
}

/**
 * Handles the bookwork check flow by trying text-based matching via OCR first,
 * and falling back to a numbered visual choice comparison if text matching fails.
 */
/**
 * Handles the bookwork check flow by capturing a numbered screenshot of the 
 * answer choices and passing it, along with the correct answer image URL,
 * directly to the LLM Vision pipeline.
 */

/**
 * Specialised bookwork screenshot tool that overlays numbers 
 * and snaps the entire container element as one single image.
 */

function getBookworkOptionsContainer() {
  return document.querySelector("div[class*='OptionsGrid']");
}

function findBookworkOptionElements() {
  const container = getBookworkOptionsContainer();
  if (!container) {
    console.warn("[SparxSolver] Bookwork options grid not found.");
    return [];
  }

  const selectors = [
    "div[class*='_Option']",
    "div[role='button']",
    "button",
    "div[class*='Interactable']",
    "div[class*='CardContentClickable']",
    "div[class*='Chip']",
  ];

  const seen = new Set();
  const options = [];

  for (const selector of selectors) {
    for (const element of container.querySelectorAll(selector)) {
      if (seen.has(element)) continue;
      if (element.querySelector("[class*='OptionsGrid']")) continue;
      if (!(element.textContent || "").trim() && !element.querySelector("img,svg,canvas")) continue;

      seen.add(element);
      options.push(element);
    }

    if (options.length > 1) {
      break;
    }
  }

  console.log(`[SparxSolver] Found ${options.length} bookwork option element(s).`, options);
  return options;
}

function isLikelyBookworkOptionSelected(optionElement) {
  if (!optionElement) {
    return false;
  }

  const ariaSelected = optionElement.getAttribute("aria-selected");
  const ariaPressed = optionElement.getAttribute("aria-pressed");
  const dataSelected = optionElement.getAttribute("data-selected");
  const className = optionElement.className || "";

  if (ariaSelected === "true" || ariaPressed === "true" || dataSelected === "true") {
    return true;
  }

  return /selected|active|checked|is-selected|is-active|highlighted|chosen/i.test(String(className));
}

async function clickBookworkOption(optionElement) {
  if (!optionElement) {
    return false;
  }

  optionElement.scrollIntoView({ block: "center", inline: "center" });
  optionElement.click();

  for (const eventName of ["pointerdown", "mousedown", "mouseup", "click"]) {
    const EventCtor = eventName.startsWith("pointer") ? PointerEvent : MouseEvent;
    optionElement.dispatchEvent(new EventCtor(eventName, {
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  }

  await sleep(400);

  const selectedByState = isLikelyBookworkOptionSelected(optionElement);
  const submitButton = findButtonWithNestedText("submit");
  const submitClickable = !!submitButton && !submitButton.disabled && window.getComputedStyle(submitButton).pointerEvents !== "none";

  return selectedByState || submitClickable;
}

async function handleBookworkCheck(imageUrl) {
  console.log("[SparxSolver] Starting visual bookwork verification check...");

  try {
    const choicesContainer = getBookworkOptionsContainer();
    const answerDivs = findBookworkOptionElements();

    if (!choicesContainer || !answerDivs.length) {
      console.warn("[SparxSolver] Bookwork options not found.");
      return false;
    }

    console.log("[SparxSolver] Targeting container:", choicesContainer);

    console.log("[SparxSolver] Capturing numbered answer options...");
    const { imageDataUrl, choiceCount } = await captureInlineSlotArea(choicesContainer, answerDivs);
    
    console.log("[SparxSolver] Invoking LLM Vision choice selection...");
    const response = await chooseImageAnswer(
      imageUrl,        // Reference answer image URL string
      imageDataUrl,    // Single grid layout screenshot
      choiceCount,     // Total items
      true             // isBookwork explicit flag
    );

    const choiceIndex = response?.choiceIndex;

    if (choiceIndex && choiceIndex > 0 && choiceIndex <= answerDivs.length) {
      console.log(`[SparxSolver] LLM Vision selected bookwork option index: ${choiceIndex}`);
      const selectionApplied = await clickBookworkOption(answerDivs[choiceIndex - 1]);
      if (!selectionApplied) {
        console.warn("[SparxSolver] Bookwork option click did not visibly affect the page.");
        return false;
      }

      return true;
    }

    console.warn("[SparxSolver] LLM did not return a valid bookwork option index.", response);
  } catch (error) {
    console.error("[SparxSolver] Error during visual bookwork verification flow:", error);
  }

  return false;
}

// ---- NEW: Badge and capture functions for inline slots ----
function addInlineSlotNumberBadges(choices) {
  const badges = [];

  choices.forEach((choice, index) => {
    const previousPosition = choice.style.position;
    if (window.getComputedStyle(choice).position === "static") {
      choice.style.position = "relative";
    }

    const badge = document.createElement("div");
    badge.textContent = String(index + 1);
    badge.style.position = "absolute";
    badge.style.top = "2px";
    badge.style.left = "2px";
    badge.style.zIndex = "999999";
    badge.style.width = "10px";
    badge.style.height = "10px";
    badge.style.borderRadius = "50%";
    badge.style.background = "#000"; 
    badge.style.color = "#fff";
    badge.style.fontSize = "8px";
    badge.style.fontWeight = "bold";
    badge.style.lineHeight = "10px";
    badge.style.textAlign = "center";
    badge.style.pointerEvents = "none";

    choice.appendChild(badge);
    badges.push({ badge, choice, previousPosition });
  });

  return () => {
    badges.forEach(({ badge, choice, previousPosition }) => {
      badge.remove();
      choice.style.position = previousPosition;
    });
  };
}

async function captureInlineSlotArea(container, choices) {
  await ensureHtml2CanvasLoaded();

  const removeBadges = addInlineSlotNumberBadges(choices);

  try {
    const canvas = await window.html2canvas(container, {
      scale: window.devicePixelRatio * 2,
      scrollY: -window.scrollY,
      useCORS: true,
      allowTaint: true,
    });
    return {
      imageDataUrl: canvas.toDataURL(),
      choiceCount: choices.length,
    };
  } finally {
    removeBadges();
  }
}


async function handleInlineSlotAnswer(item, dynamicAnswer) {
  console.log("[SparxSolver] Opening inline slot...");
  
  clickIntoInput(item.slot);
  await sleep(300); // Wait for the dropdown container to generate

  const optionsContainer = document.querySelector("[class*='_InlineSlotOptions_']");
  if (!optionsContainer) {
    console.error("[SparxSolver] Inline slot options container not found.");
    return null;
  }

  const choices = [
    ...optionsContainer.querySelectorAll("[class*='_CardContentClickable_']")
  ];

  if (!choices.length) {
    console.error("[SparxSolver] No clickable options found inside the slot container.");
    return null;
  }

  // Map choices into structured objects containing cleaned strings
  const processedChoices = choices.map(choice => {
    const rawText = extractChoiceText(choice);
    return {
      element: choice,
      rawText: rawText,
      cleanText: cleanMathText(rawText)
    };
  });

  // Sort choices by clean text length descending to prioritize long expressions
  processedChoices.sort((a, b) => b.cleanText.length - a.cleanText.length);

  const normalizedAnswer = cleanMathText(dynamicAnswer);
  let targetChoice = null;

  for (const choice of processedChoices) {
    if (choice.cleanText && normalizedAnswer.includes(choice.cleanText)) {
      targetChoice = choice;
      break;
    }
  }

  if (targetChoice) {
    console.log(`[SparxSolver] Selecting inline math option: "${targetChoice.rawText}"`);
    targetChoice.element.click();
    await sleep(200);
    return targetChoice.cleanText; // Return clean representation to guide cutting engine
  }

  console.warn(`[SparxSolver] No math matching option found for text: "${dynamicAnswer}". Falling back to LLM Vision...`);
  
  // ---- NEW: LLM Fallback for Inline Slots ----
  try {
    const { imageDataUrl, choiceCount } = await captureInlineSlotArea(optionsContainer, choices);
    
    // We reuse chooseImageAnswer from the background script to handle the visual query
    const { choiceIndex } = await chooseImageAnswer(
      dynamicAnswer,
      imageDataUrl,
      choiceCount,
      false
    );

    if (choiceIndex && choiceIndex > 0 && choiceIndex <= choices.length) {
      const selectedChoice = choices[choiceIndex - 1];
      console.log(`[SparxSolver] LLM Vision selected inline slot option index: ${choiceIndex}`);
      
      selectedChoice.click();
      await sleep(200);
      
      // Return the cleanText from the selected element to properly chop the dynamicAnswer window
      return cleanMathText(extractChoiceText(selectedChoice));
    }
  } catch (err) {
    console.error("[SparxSolver] LLM fallback for inline slot failed:", err);
  }

  return null;
}


function formatNumericAnswer(answer) {
  const str = String(answer);

  // Match numbers that are NOT part of a unit exponent like ^2
  const matches = str.match(/(?<!\^)-?\d+(\.\d+)?(?!\w)/g);

   return matches || [];
}

function getImageAnswerChoices(answerPart) {
  return [
    ...answerPart.querySelectorAll('div[role="button"]')
  ].filter(choice => choice.querySelector("img"));
}



function getImageChoiceCaptureRoot(answerPart) {
  return (
    answerPart.closest("div[class*='AnswerPart']") ??
    answerPart.closest("div[class*='AnswerScreen']") ??
    answerPart
  );
}

function addImageChoiceNumberBadges(choices) {
  const badges = [];

  choices.forEach((choice, index) => {
    const previousPosition = choice.style.position;
    if (window.getComputedStyle(choice).position === "static") {
      choice.style.position = "relative";
    }

    const badge = document.createElement("div");
    badge.textContent = String(index + 1);
    badge.style.position = "absolute";
    badge.style.top = "6px";
    badge.style.left = "6px";
    badge.style.zIndex = "999999";
    badge.style.width = "24px";
    badge.style.height = "24px";
    badge.style.borderRadius = "50%";
    badge.style.background = "#000";
    badge.style.color = "#fff";
    badge.style.fontSize = "14px";
    badge.style.fontWeight = "bold";
    badge.style.lineHeight = "24px";
    badge.style.textAlign = "center";
    badge.style.pointerEvents = "none";
    badge.dataset.sparxSolverImageChoiceBadge = "true";

    choice.appendChild(badge);
    badges.push({ badge, choice, previousPosition });
  });

  return () => {
    badges.forEach(({ badge, choice, previousPosition }) => {
      badge.remove();
      choice.style.position = previousPosition;
    });
  };
}

function ensureHtml2CanvasLoaded() {
  if (window.html2canvas) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("libs/html2canvas.min.js");
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load html2canvas."));
    document.head.appendChild(script);
  });
}

async function captureImageChoiceArea(answerPart) {
  const choices = getImageAnswerChoices(answerPart);
  if (choices.length < 2) {
    throw new Error("Image answer choices not found.");
  }

  await ensureHtml2CanvasLoaded();

  const captureRoot = getImageChoiceCaptureRoot(answerPart);
  const removeBadges = addImageChoiceNumberBadges(choices);
  const replaced = typeof replaceInputsWithSpans === "function"
    ? replaceInputsWithSpans(captureRoot)
    : [];

  try {
    const canvas = await window.html2canvas(captureRoot, {
      scale: window.devicePixelRatio * 2,
      scrollY: -window.scrollY,
      useCORS: true,
      allowTaint: true,
    });
    return {
      imageDataUrl: canvas.toDataURL(),
      choiceCount: choices.length,
    };
  } finally {
    if (typeof restoreInputs === "function") {
      restoreInputs(replaced);
    }
    removeBadges();
  }
}

function chooseImageAnswer(finalAnswer, imageDataUrl, choiceCount, isBookwork = false) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "chooseImageAnswer",
        finalAnswer,
        imageDataUrl,
        choiceCount,
        isBookwork
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response || response.error) {
          reject(new Error(response?.error || "Image answer choice failed."));
          return;
        }

        resolve(response);
      }
    );
  });
}

function setLocalStorage(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function selectImageAnswerChoiceMock(index) {
  if (window.__sparxSolverMockSelectionEnabled !== true) {
    return false;
  }

  const fixture = document.querySelectorAll('[data-sparx-solver-mock-choice]')[index - 1];
  if (fixture) {
    fixture.click();
    return true;
  }

  return false;
}

function selectImageAnswerChoice(answerPart, index) {
  const choices = getImageAnswerChoices(answerPart);

  const target = choices[index - 1];

  if (!target) {
    console.log("Image choice not found:", index);
    return false;
  }

  target.click();

  console.log(
    `[SparxSolver] Clicked image choice ${index}.`
  );

  return true;
}

async function recognizeImageChoiceAnswer(answerPart, finalAnswer) {
  const { imageDataUrl, choiceCount } = await captureImageChoiceArea(answerPart);
  const { choiceIndex, rawText } = await chooseImageAnswer(
    finalAnswer,
    imageDataUrl,
    choiceCount
  );

  await setLocalStorage({
    lastImageAnswerChoiceIndex: choiceIndex,
    lastImageAnswerChoiceRawText: rawText,
  });

  console.log(`[SparxSolver] Recommended image answer choice: ${choiceIndex}`);
  selectImageAnswerChoice(answerPart, choiceIndex);
  return { recognizedOnly: false, choiceIndex };
}

async function clickIntoInput(input) {
  input.click();
  input.focus();
  
  // Simulate the full lifecycle of a mouse click
  input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  input.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  console.log("click into input");
}

async function typeIntoNumericInput(input, value) {


  await clickIntoInput(input);

  await sleep(500);

  console.log("Target:", input.dataset.ref);
  console.log("Active:", document.activeElement.dataset.ref);
  console.log("Same?", document.activeElement === input);

  for (const key of String(value)) {
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

  console.log(
  "After typing:",
  input.dataset.ref,
  "value =",
  input.value
);
}

async function typeNumericInput(input, value) {
  if (value == null) {
    return;
  }
  console.log("Typing", value, input);
  await typeIntoNumericInput(input, value);
  
}

/**
 * Searches for the first valid numeric token, extracts it, and crops the string from that point forward.
 * @param {string} currentText - The remaining answer string window.
 * @returns {object} An object containing the matched numeric 'value' and the updated 'remaining' text.
 */
function extractAndConsumeNumeric(currentText) {
  const match = currentText.match(/(?<!\^)-?\d+(\.\d+)?(?!\w)/);
  if (!match) {
    return { value: null, remaining: currentText };
  }

  const value = match[0];
  const sliceIndex = currentText.indexOf(value) + value.length;
  
  return {
    value,
    remaining: currentText.slice(sliceIndex)
  };
}

async function handleMultipleChoiceAnswer(item, dynamicAnswer) {
  console.log("[SparxSolver] Processing multiple choice answers...");

  const choices = item.choices;
  if (!choices.length) {
    console.error("[SparxSolver] No multiple choice options found.");
    return null;
  }

  // Map choices into structured objects containing cleaned strings
  const processedChoices = choices.map(choice => {
    const rawText = extractChoiceText(choice);
    return {
      element: choice,
      rawText: rawText,
      cleanText: cleanMathText(rawText)
    };
  });

  // Sort choices by clean text length descending to prioritize longer expressions
  processedChoices.sort((a, b) => b.cleanText.length - a.cleanText.length);

  const normalizedAnswer = cleanMathText(dynamicAnswer);
  let targetChoice = null;

  for (const choice of processedChoices) {
    if (choice.cleanText && normalizedAnswer.includes(choice.cleanText)) {
      targetChoice = choice;
      break;
    }
  }

  if (targetChoice) {
    console.log(`[SparxSolver] Selecting matching text option: "${targetChoice.rawText}"`);
    targetChoice.element.click();
    await sleep(200);
    return targetChoice.cleanText; // Return clean representation to guide cutting engine
  }

  console.warn(`[SparxSolver] No text matching option found for: "${dynamicAnswer}". Falling back to LLM Vision...`);

  // ---- LLM Fallback for Multiple Choice ----
  try {
    // Reusing captureInlineSlotArea as it handles standard element container snapshots
    const { imageDataUrl, choiceCount } = await captureInlineSlotArea(item.answerPart, choices);
    
    // Send the vision payload to your background engine
    const { choiceIndex } = await chooseImageAnswer(
      dynamicAnswer,
      imageDataUrl,
      choiceCount,
      false
    );

    if (choiceIndex && choiceIndex > 0 && choiceIndex <= choices.length) {
      const selectedChoice = choices[choiceIndex - 1];
      console.log(`[SparxSolver] LLM Vision selected option index: ${choiceIndex}`);
      
      selectedChoice.click();
      await sleep(200);
      
      // Return cleanText from the selected element to properly slice the remaining stream
      return cleanMathText(extractChoiceText(selectedChoice));
    }
  } catch (err) {
    console.error("[SparxSolver] LLM fallback for multiple choice failed:", err);
  }

  return null;
}



async function typeAnswer(finalAnswer) {
  const answerItems = getOrderedAnswerItems();
  console.log(answerItems);

  if (!answerItems.length) {
    console.error("[SparxSolver] No answer items found.");
    return false;
  }

  let dynamicAnswer = finalAnswer;

  for (const item of answerItems) {
    switch (item.type) {
      case "numeric": {
        const { value, remaining } = extractAndConsumeNumeric(dynamicAnswer);

        if (!value) {
          console.warn("[SparxSolver] Missing numeric value in remaining text:", dynamicAnswer);
          continue;
        }

        await typeNumericInput(item.input, value);
        dynamicAnswer = remaining;
        console.log("[SparxSolver] Consumed numeric value. Remaining window:", dynamicAnswer);
        break;
      }

      // Locate the switch (item.type) block inside typeAnswer() and add this case:

      case "multiple-choice": {
        const matchedCleanText = await handleMultipleChoiceAnswer(item, dynamicAnswer);
        if (!matchedCleanText) {
          return false; // Safely abort sequence if mismatch breaks execution
        }

        // Chop the remaining answer string window cleanly using your crawler
        dynamicAnswer = consumePhraseResilient(dynamicAnswer, matchedCleanText);
        console.log("[SparxSolver] Consumed multiple choice phrase. Remaining window:", dynamicAnswer);
        break;
      }

      case "image": {
        await recognizeImageChoiceAnswer(item.answerPart, finalAnswer);
        break;
      }

      case "inline-slot": {
        // Pass dynamicAnswer window to the matching engine
        const matchedCleanText = await handleInlineSlotAnswer(item, dynamicAnswer);
        if (!matchedCleanText) {
          return false; // Safely abort sequence if mismatch breaks execution
        }

        // Use the character crawler to chop the string forward cleanly
        dynamicAnswer = consumePhraseResilient(dynamicAnswer, matchedCleanText);
        console.log("[SparxSolver] Consumed slot phrase. Remaining window:", dynamicAnswer);
        break;
      }

      default:
        console.warn("[SparxSolver] Unknown answer item:", item);
    }
  }

  return true;
}

function waitForSubmitButton(timeout = 10000, interval = 100) {
  console.log("[SparxSolver] Waiting for Submit button...");

  return new Promise((resolve) => {
    const start = Date.now();

    const timer = setInterval(() => {
      const btn = findButtonWithNestedText('submit');

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

function findButtonWithNestedText(text) {
  console.log(`[SparxSolver] Finding, ${text}, button...`);

  return [...document.querySelectorAll("button")].find(button =>
    button.textContent.trim().toLowerCase().startsWith(text.toLowerCase())
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

function waitForContinueLink(timeout = 5000, interval = 500) {
  console.log("[SparxSolver] Waiting for Continue control...");

  return new Promise((resolve) => {
    const start = Date.now();

    const timer = setInterval(() => {
      const continueControl = findLinkWithNestedText('continue');

      if (continueControl) {
        const pointerEvents = window.getComputedStyle(continueControl).pointerEvents;
        const isDisabled = continueControl.disabled || continueControl.getAttribute("aria-disabled") === "true";

        if (pointerEvents !== "none" && !isDisabled) {
          clearInterval(timer);
          console.log("[SparxSolver] Continue control is clickable.");
          return resolve(continueControl);
        }
      }

      if (Date.now() - start > timeout) {
        clearInterval(timer);
        console.log("[SparxSolver] Continue control timeout.");
        return resolve(null);
      }
    }, interval);
  });
}

function findLinkWithNestedText(text) {
  const candidateSelectors = [
    "button",
    "a",
    "div[role='button']",
    "[role='button']",
    "div",
  ];

  console.log(`[SparxSolver] Finding, ${text}, control...`);

  return candidateSelectors
    .flatMap(selector => [...document.querySelectorAll(selector)])
    .find((element) => {
      const normalizedText = (element.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      return normalizedText === text.toLowerCase() || normalizedText.startsWith(text.toLowerCase());
    }) || null;
}

function findKeepGoingLink() {
  const targetAnchor = Array.from(document.querySelectorAll('a')).find(anchor => {
    const div = anchor.querySelector('div');
    return div && div.textContent.trim().toLowerCase() === 'keep going';
  });

  console.log(targetAnchor);
  return targetAnchor; // Added this so the function outputs the result
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

// Requesting the next solve cycle from background engine
  function requestNextAnswerIfEnabled() {
    chrome.storage.local.get("autoSolveEnabled", (data) => {
      if (data.autoSolveEnabled) {
        console.log("[SparxSolver] Loop verified active. Requesting next answer parameters...");
        chrome.runtime.sendMessage({ action: "requestNextAnswer" });
      }
    });
  }

async function runAutoSolvePageFlow(finalAnswer) {
  console.log("[SparxSolver] Auto solve answer ready:", finalAnswer);

  const isBookworkCheckPage = Array.from(document.querySelectorAll("*")).some(el => {
    return (el.textContent || "").trim().toLowerCase().includes("bookwork check");
  });

  if (isBookworkCheckPage) {
    console.log("[SparxSolver] Bookwork check detected. Standard auto-solve is pausing until this screen clears.");
    return false; // Exit safely, doing nothing
  }

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

  // Type or recognize the answer
  let answerResult;
  try {
    answerResult = await typeAnswer(finalAnswer);
  } catch (err) {
    console.error("[SparxSolver] Answer recognition failed:", err);
    handleAutoSolveFailure();
    return;
  }

  if (!answerResult) {
    handleAutoSolveFailure();
    return;
  }

  await sleep(150);

  // Click Submit
  if (!clickSubmitButton(submitBtn)) {
    handleAutoSolveFailure();
    return;
  }

  await sleep(1000);

  const tryAgainLink = findLinkWithNestedText('try again');

  if (tryAgainLink) {
    console.error("[SparxSolver] Submission failed. 'Try Again' link detected.");
    handleAutoSolveFailure();
    return;
  }

  console.log("[SparxSolver] Waiting for Continue link...");

  const continueLink = await waitForContinueLink();

  if (!continueLink) {
    handleAutoSolveFailure();
    return;
  }

  console.log("[SparxSolver] Continue link found.");

  continueLink.click();

  //now it should repeat as long as the autoSolveEnabled toggle is still on, and the next page has a new answer to solve

  console.log("[SparxSolver] Navigating to the next task screen...");

  // Wait for transition, then check for next question
  await sleep(1000);
  requestNextAnswerIfEnabled();



}

  const IFRAME_ID = "sparx-solver-iframe";
  const MAX_IFRAME_HEIGHT = 700; // Maximum height for the iframe in pixels
  const IFRAME_Z_INDEX = "2147483647";
  let iframe = null;
  let isIframeVisible = false;
  let bodyPointerEventsObserver = null;
  let autoBookworkRunInProgress = false;
  let bookworkObserverTimer = null;

  function getSolverIframe() {
    return iframe || document.getElementById(IFRAME_ID);
  }

  function applyIframeInteractionStyles(iframeElement) {
    if (!iframeElement) return;

    iframeElement.style.position = "fixed";
    iframeElement.style.top = "20px";
    iframeElement.style.right = "20px";
    iframeElement.style.width = "475px";
    iframeElement.style.zIndex = IFRAME_Z_INDEX;
    iframeElement.style.pointerEvents = "auto";
    iframeElement.style.border = "1px solid #dbdbdb";
    iframeElement.style.borderRadius = "8px";
    iframeElement.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    iframeElement.style.backgroundColor = "white";
    iframeElement.style.transition = "height 0.2s ease-in-out";
  }

  function enablePageAndIframePointerEvents() {
    if (
      document.body.style.getPropertyValue("pointer-events") !== "auto" ||
      document.body.style.getPropertyPriority("pointer-events") !== "important"
    ) {
      document.body.style.setProperty("pointer-events", "auto", "important");
    }

    applyIframeInteractionStyles(getSolverIframe());
  }

  function startBodyPointerEventsObserver() {
    if (bodyPointerEventsObserver) return;

    bodyPointerEventsObserver = new MutationObserver(() => {
      if (!isIframeVisible) return;
      enablePageAndIframePointerEvents();
    });

    bodyPointerEventsObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }

  function stopBodyPointerEventsObserver() {
    if (!bodyPointerEventsObserver) return;

    bodyPointerEventsObserver.disconnect();
    bodyPointerEventsObserver = null;
  }

  function createIframe() {
    if (document.getElementById(IFRAME_ID)) {
      const existingIframe = document.getElementById(IFRAME_ID);
      applyIframeInteractionStyles(existingIframe);
      return existingIframe;
    }

    const iframeElement = document.createElement("iframe");
    iframeElement.id = IFRAME_ID;
    iframeElement.src = chrome.runtime.getURL("popup.html");
    iframeElement.style.height = "200px"; // Initial height, will be adjusted dynamically
    iframeElement.style.display = "none"; // Initially hidden
    applyIframeInteractionStyles(iframeElement);

    document.body.appendChild(iframeElement);
    return iframeElement;
  }

  function toggleIframe() {
    if (!iframe) {
      iframe = createIframe();
    }

    isIframeVisible = !isIframeVisible;
    iframe.style.display = isIframeVisible ? "block" : "none";
    applyIframeInteractionStyles(iframe);

    if (isIframeVisible) {
      enablePageAndIframePointerEvents();
      startBodyPointerEventsObserver();
    } else {
      stopBodyPointerEventsObserver();
    }

    console.log(
      `[SparxSolver] Iframe visibility toggled to: ${iframe.style.display}`
    );
  }

  async function runAutoBookworkSequence() {
    if (autoBookworkRunInProgress) {
      console.log("[SparxSolver] Auto bookwork run already in progress.");
      return;
    }

    autoBookworkRunInProgress = true;

    try {
      const data = await new Promise((resolve) => {
        chrome.storage.local.get(["autoBookworkEnabled", "bookworks"], resolve);
      });

      if (!data.autoBookworkEnabled) {
        console.log("[SparxSolver] Auto bookwork toggle is OFF. Skipping automated run.");
        return;
      }

      if (!isBookworkCheckPage()) {
        console.log("[SparxSolver] Not currently on a Bookwork check screen.");
        return;
      }

      console.log("[SparxSolver] Bookwork page detected. Proceeding with automated verification...");

      const { code: bookworkCode } = findCurrentBookworkCode();
      if (!bookworkCode) {
        console.log("[SparxSolver] No current bookwork code found for automated run.");
        return;
      }

      const imageUrl = data.bookworks?.[bookworkCode];
      if (!imageUrl) {
        console.log(`[SparxSolver] No saved bookwork image found for code: ${bookworkCode}.`);
        return;
      }

      const selectionSucceeded = await handleBookworkCheck(imageUrl);
      if (!selectionSucceeded) {
        console.warn("[SparxSolver] Bookwork option was not selected; skipping submit/continue.");
        return;
      }

      const submitButton = await waitForSubmitButton();
      if (!submitButton) {
        console.warn("[SparxSolver] Submit button never became enabled after selection.");
        return;
      }

      if (!clickSubmitButton(submitButton)) {
        console.warn("[SparxSolver] Failed to click the Bookwork submit button.");
        return;
      }

      const continueLink = await waitForContinueLink();
      if (!continueLink) {
        console.warn("[SparxSolver] Continue link never appeared after Bookwork submit.");
        return;
      }

      console.log("[SparxSolver] Continue link found. Proceeding to next screen.");
      continueLink.click();
    } finally {
      autoBookworkRunInProgress = false;
    }
  }

  function scheduleBookworkPageRefresh(delay = 300) {
    clearTimeout(bookworkObserverTimer);

    bookworkObserverTimer = setTimeout(() => {
      if (!isBookworkCheckPage()) {
        return;
      }

      findAndDisplayBookworkAnswer();
      runAutoBookworkSequence();
    }, delay);
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
        sendResponse({ status: "Auto solve completed" });
      } catch (err) {
        console.error("[SparxSolver] Auto solve failed:", err);
        handleAutoSolveFailure();
        sendResponse({ error: err.message });
      }
    })();
    return true; // Keep message channel open for async execution
  }

  else if (request.action === "enablePointerEvents") {
  setTimeout(() => {
    enablePageAndIframePointerEvents();

    console.log(
      "[SparxSolver] Pointer events enabled on body and iframe with !important after 2000ms delay."
    );

    sendResponse({
      status: "Pointer events enabled on body and iframe after delay",
    });

    scheduleBookworkPageRefresh(0);

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
            applyIframeInteractionStyles(iframe);
          }
          break;
      }
    }
  });

  // Add this near the bottom of content.js where your event listeners live
  // Add this near the bottom of content.js
  chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.autoBookworkEnabled) {
    const isBookworkEnabled = changes.autoBookworkEnabled.newValue;
    console.log(`[SparxSolver] Auto-Bookwork toggle turned ${isBookworkEnabled ? "ON" : "OFF"}`);
    
    // If turned ON, dynamically kick off the sequence right now
    if (isBookworkEnabled) {
      scheduleBookworkPageRefresh(0);
    }
  }
});

  const bookworkPageObserver = new MutationObserver(() => {
    if (autoBookworkRunInProgress) {
      return;
    }

    scheduleBookworkPageRefresh(300);
  });

  bookworkPageObserver.observe(document.body, {
    childList: true,
    subtree: true,
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
