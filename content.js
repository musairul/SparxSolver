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
  return findActionControlByText("answer");
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

function getOrderedAnswerItems(log = true) {
  let answerParts = [
    ...document.querySelectorAll("[class*='AnswerPart']")
  ];

  const items = [];

  if (answerParts.length === 0) {
    const mainContainer = findQuestionContentElement();
    if (mainContainer) {
      if (log) console.log("[SparxSolver] No AnswerPart elements found. Using main QuestionWrapper container.");
      answerParts = [mainContainer];
    }
  }

  if (log) console.log("answerParts", answerParts);

  const seenNumericInputs = new Set();
  const numericFieldSelector = [
    "[class*='TextFieldNumeric']",
    "input[type='number']",
    "input[inputmode='decimal']",
    "input[inputmode='numeric']",
    "input[placeholder*='number' i]",
  ].join(", ");

  for (const [partIndex, part] of answerParts.entries()) {
    const numericInputs = [...part.querySelectorAll(numericFieldSelector)]
      .map((field) => field.matches("input, textarea")
        ? field
        : field.querySelector("input, textarea, [role='textbox'], [contenteditable='true']"))
      .filter((input) => {
        if (!input || seenNumericInputs.has(input)) return false;
        const style = window.getComputedStyle(input);
        const visible = style.display !== "none" && style.visibility !== "hidden" && input.getClientRects().length > 0;
        if (visible) seenNumericInputs.add(input);
        return visible;
      });

    if (numericInputs.length) {
      for (const [partFieldIndex, input] of numericInputs.entries()) {
        items.push({
          type: "numeric",
          input,
          fieldContainer: input.closest("[class*='TextFieldNumeric']") || input,
          answerPart: part,
          answerPartIndex: partIndex,
          answerPartFieldIndex: partFieldIndex,
        });
      }
    }

    const dropTargetSelector = [
      "[class*='DropZone']",
      "[class*='DropTarget']",
      "[class*='Droppable']",
      "[class*='DropArea']",
      "[data-drop-target]",
      "[aria-dropeffect]",
      "[class*='_CardContentEmpty_']",
    ].join(", ");
    const dragChoiceSelector = [
      "[draggable='true']",
      "[class*='Draggable']",
      "[class*='DragItem']",
      "[class*='DragOption']",
      "[data-draggable]",
      "[class*='_CardContentClickable_']",
    ].join(", ");
    const dragDropTargets = [...part.querySelectorAll(dropTargetSelector)].filter(
      (target) => !target.parentElement?.closest(dropTargetSelector)
    );
    const questionContainer = part.closest("[class*='QuestionWrapper']") || part;
    const dragDropChoices = [...questionContainer.querySelectorAll(dragChoiceSelector)].filter(
      (choice) =>
        !choice.matches(dropTargetSelector) &&
        !choice.closest(dropTargetSelector) &&
        (choice.textContent || "").trim()
    );
    const hasDragDrop = dragDropTargets.length > 0 && dragDropChoices.length > 0;

    if (hasDragDrop) {
      const usedChoices = new Set();
      for (const target of dragDropTargets) {
        items.push({
          type: "drag-drop",
          target,
          choices: dragDropChoices,
          usedChoices,
        });
      }
    }

    const hasNumericInputs = numericInputs.length > 0;
    const multipleChoiceButtons = hasDragDrop || hasNumericInputs ? [] : [
      ...part.querySelectorAll('div[role="button"]')
    ].filter(choice => !choice.querySelector("img"));

    if (multipleChoiceButtons.length > 0) {
      items.push({
        type: "multiple-choice",
        answerPart: part,
        choices: multipleChoiceButtons
      });
    }

    const imageChoices = hasDragDrop || hasNumericInputs ? [] : [
      ...part.querySelectorAll('div[role="button"]')
    ].filter(choice => choice.querySelector("img"));

    if (imageChoices.length > 1) {
      items.push({
        type: "image",
        answerPart: part,
        choices: imageChoices
      });
    }

    const inlineSlots = hasDragDrop ? [] : [
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

function getStaticAnswerPartText(item) {
  if (!item.answerPart) return "";

  const clone = item.answerPart.cloneNode(true);
  clone.querySelectorAll(
    "input, textarea, button, [role='button'], [contenteditable='true'], [class*='TextFieldNumeric'], [class*='Keypad'], [class*='keypad']"
  ).forEach((element) => element.remove());

  return (clone.innerText || clone.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
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

function normalizeAlgebraFactor(text) {
  return String(text)
    .replace(/\$/g, "")
    .replace(/\\(?:left|right)\b/g, "")
    .replace(/\\(?:cdot|times)\b/g, "*")
    .replace(/[·×]/g, "*")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\^\{([^}]+)\}/g, "^$1")
    .replace(/[{}\s]/g, "")
    .replace(/[−–]/g, "-")
    .toLowerCase();
}

function getCommutativeProductFactors(expression) {
  const normalized = normalizeAlgebraFactor(expression);
  const factors = [];
  let depth = 0;
  let factorStart = -1;
  let consumedThrough = 0;

  for (let index = 0; index < normalized.length; index++) {
    const character = normalized[index];
    if (character === "(") {
      if (depth === 0) {
        const separator = normalized.slice(consumedThrough, index).replace(/[*)]/g, "");
        if (separator) return null;
        factorStart = index + 1;
      }
      depth++;
    } else if (character === ")") {
      depth--;
      if (depth < 0) return null;
      if (depth === 0) {
        factors.push(normalized.slice(factorStart, index));
        consumedThrough = index + 1;
      }
    }
  }

  if (depth !== 0 || factors.length < 2) return null;
  if (normalized.slice(consumedThrough).replace(/[*)]/g, "")) return null;
  return factors.sort();
}

function hasEquivalentFactorProduct(firstExpression, secondExpression) {
  const firstFactors = getCommutativeProductFactors(firstExpression);
  const secondFactors = getCommutativeProductFactors(secondExpression);
  return !!firstFactors && !!secondFactors &&
    firstFactors.length === secondFactors.length &&
    firstFactors.every((factor, index) => factor === secondFactors[index]);
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

  let candidate = optionElement;
  for (let depth = 0; candidate && depth < 3; depth++, candidate = candidate.parentElement) {
    const ariaSelected = candidate.getAttribute("aria-selected");
    const ariaPressed = candidate.getAttribute("aria-pressed");
    const ariaChecked = candidate.getAttribute("aria-checked");
    const dataSelected = candidate.getAttribute("data-selected");
    const dataState = candidate.getAttribute("data-state");
    const className = candidate.className || "";
    const checkedInput = candidate.matches("input:checked") || !!candidate.querySelector("input:checked");

    if (ariaSelected === "true" || ariaPressed === "true" || ariaChecked === "true" ||
        dataSelected === "true" || /^(checked|selected|active)$/i.test(dataState || "") || checkedInput) {
      return true;
    }

    if (/selected|active|checked|is-selected|is-active|highlighted|chosen/i.test(String(className))) {
      return true;
    }
  }

  return false;
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
  
  await clickIntoInput(item.slot);
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
  let targetChoice = processedChoices.find((choice) =>
    hasEquivalentFactorProduct(dynamicAnswer, choice.rawText)
  ) || null;

  if (targetChoice) {
    console.info(`[SparxSolver] Matched equivalent factor product despite factor order: "${targetChoice.rawText}".`);
  }

  if (!targetChoice) {
    for (const choice of processedChoices) {
      if (choice.cleanText && normalizedAnswer.includes(choice.cleanText)) {
        targetChoice = choice;
        break;
      }
    }
  }

  if (targetChoice) {
    console.log(`[SparxSolver] Selecting inline math option: "${targetChoice.rawText}"`);
    if (!await activateAndVerifyAnswerChoice(targetChoice.element, "inline math option")) {
      return null;
    }
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
      if (!await activateAndVerifyAnswerChoice(selectedChoice, `visual inline option ${choiceIndex}`)) {
        return null;
      }
      
      // Return the cleanText from the selected element to properly chop the dynamicAnswer window
      return cleanMathText(extractChoiceText(selectedChoice));
    }
  } catch (err) {
    console.error("[SparxSolver] LLM fallback for inline slot failed:", err);
  }

  return null;
}

async function dragChoiceIntoTarget(choice, target) {
  if (!choice.isConnected || !target.isConnected || typeof DataTransfer === "undefined") {
    return false;
  }

  choice.scrollIntoView({ block: "center", inline: "center" });
  target.scrollIntoView({ block: "center", inline: "center" });

  const dataTransfer = new DataTransfer();
  const choiceText = extractChoiceText(choice);
  dataTransfer.setData("text/plain", choiceText);

  function dispatchDragEvent(element, type) {
    const rect = element.getBoundingClientRect();
    return element.dispatchEvent(new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
  }

  dispatchDragEvent(choice, "dragstart");
  dispatchDragEvent(target, "dragenter");
  dispatchDragEvent(target, "dragover");
  const dropAccepted = !dispatchDragEvent(target, "drop");
  dispatchDragEvent(choice, "dragend");
  await sleep(250);

  const targetText = cleanMathText(extractChoiceText(target));
  const expectedText = cleanMathText(choiceText);
  return target.contains(choice) || targetText.includes(expectedText) || dropAccepted;
}

async function handleDragDropAnswer(item, dynamicAnswer) {
  const normalizedAnswer = cleanMathText(dynamicAnswer);
  const matchingChoice = item.choices
    .filter((choice) => choice.isConnected && !item.usedChoices.has(choice))
    .map((element) => ({
      element,
      cleanText: cleanMathText(extractChoiceText(element)),
    }))
    .filter((choice) => choice.cleanText && normalizedAnswer.includes(choice.cleanText))
    .sort((first, second) => second.cleanText.length - first.cleanText.length)[0];

  if (!matchingChoice) {
    console.warn("[SparxSolver] No draggable option matched the answer text.");
    return null;
  }

  const moved = await dragChoiceIntoTarget(matchingChoice.element, item.target);
  if (!moved) {
    console.warn("[SparxSolver] Drag-and-drop did not appear to reach its target.");
    return null;
  }

  item.usedChoices.add(matchingChoice.element);
  return matchingChoice.cleanText;
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

async function selectImageAnswerChoice(answerPart, index) {
  const choices = getImageAnswerChoices(answerPart);

  const target = choices[index - 1];

  if (!target) {
    console.log("Image choice not found:", index);
    return false;
  }

  const selected = await activateAndVerifyAnswerChoice(target, `image option ${index}`);
  if (!selected) return false;

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
  const selected = await selectImageAnswerChoice(answerPart, choiceIndex);
  if (!selected) {
    throw new Error(`Image option ${choiceIndex} could not be selected.`);
  }
  return { recognizedOnly: false, choiceIndex };
}

async function clickIntoInput(input, fieldContainer = input) {
  const target = fieldContainer?.isConnected ? fieldContainer : input;
  target.scrollIntoView({ block: "center", inline: "center" });
  const bounds = target.getBoundingClientRect();
  const trustedClick = await dispatchTrustedInputSequence([{
    type: "click",
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  }]);

  if (!trustedClick) {
    const eventPosition = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    };
    target.dispatchEvent(new PointerEvent("pointerdown", eventPosition));
    target.dispatchEvent(new MouseEvent("mousedown", eventPosition));
    target.dispatchEvent(new MouseEvent("mouseup", eventPosition));
    target.dispatchEvent(new MouseEvent("click", eventPosition));
  }
  input.focus({ preventScroll: true });

  const focused = document.activeElement === input;
  console.info(`[SparxSolver] Activated answer-slot container; child input focused: ${focused}; slot position: ${Math.round(bounds.x)},${Math.round(bounds.y)}.`, target);
  return focused;
}

async function typeIntoNumericInput(input, value, fieldContainer = input) {
  await clickIntoInput(input, fieldContainer);
  const expectedValue = String(value);
  let prototype = input;
  let valueSetter = null;
  while (prototype && !valueSetter) {
    valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    prototype = Object.getPrototypeOf(prototype);
  }

  if (valueSetter) {
    valueSetter.call(input, expectedValue);
  } else if (input.isContentEditable || input.getAttribute("role") === "textbox") {
    input.textContent = expectedValue;
  } else {
    throw new Error("No supported value setter found for the answer field.");
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(120);

  return "value" in input
    ? String(input.value)
    : String(input.textContent || "").trim();
}

function normalizeAnswerKeyLabel(value) {
  return String(value || "")
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^(key|digit)\s+/, "")
    .replace(/\s+(key|button)$/, "");
}

function dispatchTrustedInputSequence(events) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "trustedInputSequence", events }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        if (response?.error) console.warn("[SparxSolver] Trusted input unavailable:", response.error);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

function trustedKeyEventForToken(token) {
  if (/^\d$/.test(token)) {
    return {
      type: "key",
      key: token,
      code: `Digit${token}`,
      windowsVirtualKeyCode: 48 + Number(token),
      text: token,
    };
  }

  const keyDefinitions = {
    "-": { key: "-", code: "Minus", windowsVirtualKeyCode: 189, text: "-" },
    ".": { key: ".", code: "Period", windowsVirtualKeyCode: 190, text: "." },
    "/": { key: "/", code: "Slash", windowsVirtualKeyCode: 191, text: "/" },
  };
  return keyDefinitions[token] ? { type: "key", ...keyDefinitions[token] } : null;
}

async function activateAndVerifyAnswerChoice(choice, label) {
  if (!choice?.isConnected) return false;
  if (isLikelyBookworkOptionSelected(choice)) {
    console.info(`[SparxSolver] ${label} is already selected.`);
    return true;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    await activateAnswerKeyControl(choice);
    await sleep(180);
    if (!choice.isConnected) {
      console.info(`[SparxSolver] ${label} was removed or replaced after activation.`);
      return true;
    }
    if (isLikelyBookworkOptionSelected(choice)) {
      console.info(`[SparxSolver] Verified ${label} selected on attempt ${attempt}.`);
      return true;
    }
    console.warn(`[SparxSolver] ${label} selection not reflected in the page state after attempt ${attempt}/3.`);
  }

  return false;
}

function findAnswerKeyControl(token, cache = null) {
  if (cache?.has(token)) return cache.get(token);

  const aliases = {
    "π": ["π", "pi", "pi symbol"],
    "×": ["×", "multiply", "times"],
    "-": ["-", "minus", "negative"],
    ".": [".", "decimal", "decimal point"],
    "/": ["/", "÷", "divide", "fraction"],
    "^": ["^", "power", "exponent"],
    "(": ["(", "left parenthesis"],
    ")": [")", "right parenthesis"],
    backspace: ["backspace", "delete", "⌫", "←"],
    clear: ["clear", "clear all", "clear entry"],
  };
  const expectedLabels = new Set((aliases[token] || [token]).map(normalizeAnswerKeyLabel));
  const selector = [
    "button",
    "[role='button']",
    "[data-key]",
    "[class*='Key']",
    "[class*='key']",
    "[class*='Button']",
    "[class*='button']",
  ].join(", ");

  const controls = [...document.querySelectorAll(selector)];
  const matchingControls = controls.filter((control) => {
    const style = window.getComputedStyle(control);
    if (style.display === "none" || style.visibility === "hidden" || !control.getClientRects().length) {
      return false;
    }
    const labels = [
      control.innerText,
      control.textContent,
      control.getAttribute("aria-label"),
      control.getAttribute("title"),
      control.getAttribute("data-key"),
      control.getAttribute("data-value"),
    ];
    return labels.some((label) => expectedLabels.has(normalizeAnswerKeyLabel(label)));
  });

  const questionElement = findQuestionContentElement();
  matchingControls.sort((first, second) => {
    const keypadSelector = "[class*='Keypad'], [class*='keypad'], [class*='Keyboard'], [class*='keyboard'], [data-testid*='keypad' i]";
    const firstInKeypad = first.closest(keypadSelector) ? 1 : 0;
    const secondInKeypad = second.closest(keypadSelector) ? 1 : 0;
    const firstInQuestion = questionElement?.contains(first) ? 1 : 0;
    const secondInQuestion = questionElement?.contains(second) ? 1 : 0;
    return secondInKeypad - firstInKeypad || secondInQuestion - firstInQuestion;
  });

  const result = matchingControls[0] || null;
  cache?.set(token, result);
  return result;
}

function createTrustedClickEvent(control, scrollIntoView = true) {
  if (scrollIntoView) control.scrollIntoView({ block: "center", inline: "center" });
  const bounds = control.getBoundingClientRect();
  return {
    type: "click",
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  };
}

function dispatchSyntheticClick(control) {
  const bounds = control.getBoundingClientRect();
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: bounds.left + bounds.width / 2,
    clientY: bounds.top + bounds.height / 2,
  };
  control.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
  control.dispatchEvent(new MouseEvent("mousedown", eventOptions));
  control.dispatchEvent(new PointerEvent("pointerup", eventOptions));
  control.dispatchEvent(new MouseEvent("mouseup", eventOptions));
  control.dispatchEvent(new MouseEvent("click", eventOptions));
}

async function activateAnswerKeyControl(control) {
  const trustedClick = await dispatchTrustedInputSequence([createTrustedClickEvent(control)]);
  if (trustedClick) return true;

  dispatchSyntheticClick(control);
  return false;
}

function getAnswerKeyTokens(value) {
  return String(value)
    .replace(/\$/g, "")
    .replace(/\\(?:left|right)\b/g, "")
    .replace(/\\pi\b/gi, "π")
    .replace(/\bpi\b/gi, "π")
    .replace(/\\(?:times|cdot)\b/g, "×")
    .replace(/[{}\s]/g, "")
    .split("")
    .filter(Boolean);
}

async function enterAnswerWithKeypad(input, value, fieldContainer = input) {
  const tokens = getAnswerKeyTokens(value);
  const keyControlCache = new Map();
  await clickIntoInput(input, fieldContainer);

  const clearControl = findAnswerKeyControl("clear", keyControlCache);
  const backspaceControl = findAnswerKeyControl("backspace", keyControlCache);
  const tokenControls = [];
  for (const [index, token] of tokens.entries()) {
    const keyControl = findAnswerKeyControl(token, keyControlCache);
    if (!keyControl && !trustedKeyEventForToken(token)) {
      console.warn(`[SparxSolver] No keypad key or trusted keyboard input available for token "${token}" at position ${index + 1}.`);
      return "";
    }
    tokenControls.push({ token, control: keyControl });
  }

  const keypadControls = [clearControl, backspaceControl, ...tokenControls.map(({ control }) => control)]
    .filter(Boolean);
  const keypadContainerSelector = "[class*='Keypad'], [class*='keypad'], [class*='Keyboard'], [class*='keyboard'], [data-testid*='keypad' i]";
  const keypadContainer = keypadControls
    .map((control) => control.closest(keypadContainerSelector))
    .find(Boolean) || keypadControls[0];
  if (keypadContainer) {
    keypadContainer.scrollIntoView({ block: "center", inline: "center" });
  }

  const events = [];
  if (clearControl) {
    events.push(createTrustedClickEvent(clearControl, false));
  } else if (backspaceControl) {
    for (let count = 0; count < 20; count++) {
      events.push(createTrustedClickEvent(backspaceControl, false));
    }
  } else {
    events.push(
      { type: "key", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 },
      { type: "key", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
    );
  }

  for (const { token, control } of tokenControls) {
    if (!control) {
      const keyEvent = trustedKeyEventForToken(token);
      events.push(keyEvent);
    } else {
      events.push(createTrustedClickEvent(control, false));
    }
  }

  const trustedInputWorked = await dispatchTrustedInputSequence(events);
  if (trustedInputWorked) {
    await sleep(120);
    const enteredValue = "value" in input
      ? String(input.value)
      : String(input.textContent || "").trim();
    console.info(`[SparxSolver] Batched ${events.length} trusted keypad events for one answer field; expected "${value}", observed "${enteredValue}".`, tokenControls);
    return enteredValue;
  }

  console.warn("[SparxSolver] Trusted input unavailable; falling back to individual DOM keypad events.");
  await clickIntoInput(input, fieldContainer);
  if (clearControl) {
    dispatchSyntheticClick(clearControl);
  } else if (backspaceControl) {
    for (let count = 0; count < 20; count++) dispatchSyntheticClick(backspaceControl);
  }
  for (const { token, control } of tokenControls) {
    if (control) {
      dispatchSyntheticClick(control);
    } else {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: token, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keypress", { key: token, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: token, bubbles: true }));
    }
  }
  await sleep(120);
  return "value" in input
    ? String(input.value)
    : String(input.textContent || "").trim();
}

async function typeNumericInput(input, value, fieldIndex = 0, answerPartIndex = fieldIndex, answerPartFieldIndex = 0, fieldContainer = input) {
  if (value == null) return false;

  const expectedValue = String(value);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const refreshedFields = getOrderedAnswerItems(false)
      .filter((item) => item.type === "numeric");
    const refreshedPartField = refreshedFields.find((item) =>
      item.answerPartIndex === answerPartIndex &&
      item.answerPartFieldIndex === answerPartFieldIndex
    );
    const activeInput = input.isConnected
      ? input
      : refreshedPartField?.input || null;
    const activeContainer = activeInput === input
      ? fieldContainer
      : refreshedPartField?.fieldContainer || activeInput;

    if (!activeInput) {
      console.warn(`[SparxSolver] Answer part ${answerPartIndex + 1}, field ${fieldIndex + 1} is missing on attempt ${attempt}/${maxAttempts}.`);
    } else {
      const bounds = activeContainer.getBoundingClientRect();
      console.info(`[SparxSolver] Entering answer part ${answerPartIndex + 1}, field ${fieldIndex + 1}, attempt ${attempt}/${maxAttempts}; original field: ${activeInput === input}; position: ${Math.round(bounds.x)},${Math.round(bounds.y)}; value: ${expectedValue}.`);
      try {
        let actualValue = activeInput.readOnly
          ? ""
          : await typeIntoNumericInput(activeInput, expectedValue, activeContainer);
        if (actualValue !== expectedValue) {
          console.info(`[SparxSolver] ${activeInput.readOnly ? "Field is read-only" : "Native input was rejected"} for field ${fieldIndex + 1}; using the visible Sparx keypad.`);
          actualValue = await enterAnswerWithKeypad(activeInput, expectedValue, activeContainer);
        }

        if (normalizeAnswerKeyLabel(actualValue) === normalizeAnswerKeyLabel(expectedValue)) {
          console.info(`[SparxSolver] Verified answer part ${answerPartIndex + 1}, field ${fieldIndex + 1}: ${actualValue}`);
          return true;
        }
        console.warn(`[SparxSolver] Answer part ${answerPartIndex + 1}, field ${fieldIndex + 1} verification mismatch: expected "${expectedValue}", got "${actualValue}".`);
      } catch (error) {
        console.warn(`[SparxSolver] Answer part ${answerPartIndex + 1}, field ${fieldIndex + 1} attempt ${attempt} failed:`, error);
      }
    }

    if (attempt < maxAttempts) {
      await sleep(attempt * 300);
    }
  }

  console.error(`[SparxSolver] Could not verify answer part ${answerPartIndex + 1}, field ${fieldIndex + 1} after ${maxAttempts} attempts.`);
  return false;
}

/**
 * Searches for the first valid numeric token, extracts it, and crops the string from that point forward.
 * @param {string} currentText - The remaining answer string window.
 * @returns {object} An object containing the matched numeric 'value' and the updated 'remaining' text.
 */
function extractAndConsumeNumeric(currentText) {
  const scientificMatch = currentText.match(
    /(-?\d+(?:\.\d+)?)\s*(?:\\times|×|\\cdot|·)\s*10\s*\^\s*\{\s*(-?\d+)\s*\}/i
  );

  if (scientificMatch) {
    const expressionEnd = scientificMatch.index + scientificMatch[0].length;
    const remaining = currentText.slice(0, scientificMatch.index) +
      scientificMatch[2] +
      currentText.slice(expressionEnd);
    return { value: scientificMatch[1], remaining };
  }

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
    if (!await activateAndVerifyAnswerChoice(targetChoice.element, "text answer option")) {
      return null;
    }
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
      if (!await activateAndVerifyAnswerChoice(selectedChoice, `visual answer option ${choiceIndex}`)) {
        return null;
      }
      
      // Return cleanText from the selected element to properly slice the remaining stream
      return cleanMathText(extractChoiceText(selectedChoice));
    }
  } catch (err) {
    console.error("[SparxSolver] LLM fallback for multiple choice failed:", err);
  }

  return null;
}



function parseLinearEquationForTwoNumericFields(finalAnswer, answerItems) {
  const numericItems = answerItems.filter((item) => item.type === "numeric");
  if (numericItems.length !== 2 || numericItems.length !== answerItems.length) return null;

  const normalizedAnswer = String(finalAnswer)
    .replace(/\$/g, "")
    .replace(/\\(?:left|right)\b/g, "")
    .replace(/\s+/g, "")
    .replace(/[·×]/g, "*");
  const match = normalizedAnswer.match(/^y=(.*?)x([+-](?:\d+(?:\.\d+)?|\.\d+))$/i);
  if (!match) return null;

  let coefficient = match[1].replace(/(?:\\times|\\cdot|\*)$/i, "");
  if (coefficient === "") coefficient = "1";
  if (coefficient === "-") coefficient = "-1";
  if (coefficient === "+") coefficient = "1";

  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(coefficient)) return null;
  if (coefficient.startsWith("+")) coefficient = coefficient.slice(1);
  const intercept = match[2].startsWith("+") ? match[2].slice(1) : match[2];
  return [coefficient, intercept];
}

async function typeAnswer(finalAnswer) {
  const answerItems = getOrderedAnswerItems();
  console.log(answerItems);
  const numericTargets = answerItems
    .filter((item) => item.type === "numeric")
    .map((item, index) => {
      const bounds = item.fieldContainer.getBoundingClientRect();
      return {
        field: index + 1,
        answerPart: item.answerPartIndex + 1,
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        tag: item.input.tagName,
        className: String(item.fieldContainer.className || "").slice(0, 100),
      };
    });
  console.info("[SparxSolver] Numeric answer-slot map:", numericTargets);

  if (!answerItems.length) {
    console.error("[SparxSolver] No answer items found.");
    return false;
  }

  let dynamicAnswer = finalAnswer;
  let numericFieldIndex = 0;
  const numericItemCount = answerItems.filter((item) => item.type === "numeric").length;
  const answerParts = String(finalAnswer)
    .trim()
    .replace(/^\$|\$$/g, "")
    .split(/\s*,\s*/)
    .filter(Boolean);
  const linearEquationParts = parseLinearEquationForTwoNumericFields(finalAnswer, answerItems);
  if (linearEquationParts) {
    console.info("[SparxSolver] Converted linear equation to coefficient/intercept blank values:", linearEquationParts);
    answerParts.splice(0, answerParts.length, ...linearEquationParts);
  }
  const hasOneAnswerPerNumericField = numericItemCount === answerItems.length &&
    answerParts.length === numericItemCount;

  for (const item of answerItems) {
    switch (item.type) {
      case "numeric": {
        const currentFieldIndex = numericFieldIndex++;
        const extracted = hasOneAnswerPerNumericField
          ? { value: answerParts[currentFieldIndex], remaining: "" }
          : extractAndConsumeNumeric(dynamicAnswer);
        let { value } = extracted;
        const { remaining } = extracted;

        if (!value) {
          console.error(`[SparxSolver] No numeric value found for field ${currentFieldIndex + 1}. Remaining answer:`, dynamicAnswer);
          return false;
        }

        const coefficientWithPi = String(value).match(/^(-?\d+(?:\.\d+)?)\s*(?:\\pi|π)$/i);
        const staticPartText = getStaticAnswerPartText(item);
        if (coefficientWithPi && /π|\\pi\b/i.test(staticPartText) &&
            (item.input.readOnly || item.input.getAttribute("pattern"))) {
          console.info(`[SparxSolver] Answer part ${item.answerPartIndex + 1} has a numeric-only blank with fixed π nearby; entering coefficient ${coefficientWithPi[1]}.`);
          value = coefficientWithPi[1];
        }

        const enteredAndVerified = await typeNumericInput(
          item.input,
          value,
          currentFieldIndex,
          item.answerPartIndex,
          item.answerPartFieldIndex,
          item.fieldContainer
        );
        if (!enteredAndVerified) return false;
        dynamicAnswer = remaining;
        console.info(`[SparxSolver] Field ${currentFieldIndex + 1} verified; remaining answer text:`, dynamicAnswer);
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

      case "drag-drop": {
        const matchedCleanText = await handleDragDropAnswer(item, dynamicAnswer);
        if (!matchedCleanText) {
          return false;
        }

        dynamicAnswer = consumePhraseResilient(dynamicAnswer, matchedCleanText);
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

function isButtonEnabled(button) {
  return (
    !!button &&
    !button.disabled &&
    button.getAttribute("aria-disabled") !== "true" &&
    window.getComputedStyle(button).pointerEvents !== "none"
  );
}

function waitForSubmitButton(timeout = 10000, interval = 100, requireEnabled = false) {
  console.log("[SparxSolver] Waiting for Submit button...");

  return new Promise((resolve) => {
    const start = Date.now();

    const timer = setInterval(() => {
      const btn = findButtonWithNestedText('submit');

      if (btn && (!requireEnabled || isButtonEnabled(btn))) {
        clearInterval(timer);
        console.log("[SparxSolver] Submit button ready.");
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
  const expectedText = text.toLowerCase();
  return [...document.querySelectorAll("button, a, [role='button']")].find((element) => {
    const actualText = (element.innerText || element.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const style = window.getComputedStyle(element);
    const visible = style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    return visible && (actualText === expectedText || actualText.startsWith(`${expectedText} `));
  }) || null;
}

function clickSubmitButton(button) {
  console.log("[SparxSolver] Clicking Submit button...");

  if (!isButtonEnabled(button)) {
    console.error("[SparxSolver] Submit button is missing or disabled.");
    return false;
  }

  button.click();
  return true;
}

function waitForPostSubmitAction(timeout = 15000, interval = 200) {
  console.log("[SparxSolver] Waiting for Continue or Keep Going control...");

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
          return resolve({ type: "continue", control: continueControl });
        }
      }

      const keepGoingControl = findActionControlByText("keep going");
      if (keepGoingControl) {
        clearInterval(timer);
        console.log("[SparxSolver] Keep Going control is clickable.");
        return resolve({ type: "keep-going", control: keepGoingControl });
      }

      if (Date.now() - start > timeout) {
        clearInterval(timer);
        console.log("[SparxSolver] Post-submit action timeout.");
        return resolve(null);
      }
    }, interval);
  });
}

function findActionControlByText(text) {
  const expectedText = text.toLowerCase();
  const selectors = [
    "button",
    "a",
    "[role='button']",
    "[tabindex]",
    "[class*='Content']",
    "[class*='Button']",
    "[class*='button']",
  ];
  const candidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter((element) => {
      const actualText = (element.innerText || element.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      const style = window.getComputedStyle(element);
      const visible = style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
      return visible && !element.disabled && element.getAttribute("aria-disabled") !== "true" &&
        (actualText === expectedText || actualText.startsWith(`${expectedText} `));
    });

  candidates.sort((first, second) => {
    const firstText = (first.innerText || first.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    const secondText = (second.innerText || second.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    const firstExact = firstText === expectedText;
    const secondExact = secondText === expectedText;
    return Number(secondExact) - Number(firstExact) || firstText.length - secondText.length;
  });

  for (const candidate of candidates) {
    const interactiveAncestor = candidate.closest("button, a, [role='button']");
    const target = interactiveAncestor || candidate;
    const style = window.getComputedStyle(target);
    const visible = style.display !== "none" && style.visibility !== "hidden" && target.getClientRects().length > 0;
    if (visible && !target.disabled && target.getAttribute("aria-disabled") !== "true") {
      return target;
    }
  }

  return null;
}

function waitForActionControl(text, timeout = 4000, interval = 200) {
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const control = findActionControlByText(text);
      if (control || Date.now() - start >= timeout) {
        clearInterval(timer);
        resolve(control);
      }
    }, interval);
  });
}

async function clickNextTask() {
  const nextTaskControl = await waitForActionControl("next task", 2500);
  if (nextTaskControl) {
    console.log("[SparxSolver] Next task control found; continuing.");
    nextTaskControl.click();
    return true;
  }

  return false;
}

function clickKeepGoing(initialControl = null) {
  if (keepGoingActivationPromise) {
    console.info("[SparxSolver] Keep Going activation is already running; joining it.");
    return keepGoingActivationPromise;
  }

  const activationPromise = (async () => {
  let keepGoingControl = initialControl?.isConnected
    ? initialControl
    : await waitForActionControl("keep going", 2500);

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (!keepGoingControl?.isConnected) {
      keepGoingControl = await waitForActionControl("keep going", 1000);
    }
    if (!keepGoingControl) break;

    keepGoingControl.scrollIntoView({ block: "center", inline: "center" });
    const bounds = keepGoingControl.getBoundingClientRect();
    const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    };

    console.info(`[SparxSolver] Activating Keep Going text target, attempt ${attempt}/3:`, {
      tag: keepGoingControl.tagName,
      className: String(keepGoingControl.className || ""),
      text: (keepGoingControl.innerText || keepGoingControl.textContent || "").trim(),
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
    });

    keepGoingControl.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
    keepGoingControl.dispatchEvent(new MouseEvent("mousedown", eventOptions));
    keepGoingControl.dispatchEvent(new PointerEvent("pointerup", eventOptions));
    keepGoingControl.dispatchEvent(new MouseEvent("mouseup", eventOptions));
    keepGoingControl.dispatchEvent(new MouseEvent("click", eventOptions));

    const start = Date.now();
    while (Date.now() - start < 1000) {
      await sleep(150);
      const currentControl = findActionControlByText("keep going");
      if (!currentControl || !currentControl.isConnected) {
        console.info("[SparxSolver] Keep Going prompt disappeared after activation.");
        return true;
      }
    }

    console.warn(`[SparxSolver] Keep Going remained visible after attempt ${attempt}/3.`);
    keepGoingControl = findActionControlByText("keep going");
  }

  console.error("[SparxSolver] Could not dismiss the Keep Going prompt after 3 activation attempts.");
  return false;
  })();

  keepGoingActivationPromise = activationPromise.finally(() => {
    keepGoingActivationPromise = null;
  });
  return keepGoingActivationPromise;
}

function clickBookworkDidntPrompt() {
  const dialogSelector = "[role='dialog'], [aria-modal='true'], [class*='Modal'], [class*='Popup']";
  const dialogs = [...document.querySelectorAll(dialogSelector)];

  for (const dialog of dialogs) {
    if (!/bookwork/i.test(dialog.textContent || "")) continue;

    const didntControl = [...dialog.querySelectorAll("button, [role='button'], a")].find((control) => {
      const text = (control.innerText || control.textContent || "").replace(/\s+/g, " ").trim();
      return /^I\s+didn['’]?t\b/i.test(text) &&
        !control.disabled &&
        control.getAttribute("aria-disabled") !== "true" &&
        control.dataset.sparxSolverDidntClicked !== "true";
    });

    if (!didntControl) continue;

    chrome.storage.local.get("autoBookworkEnabled", (data) => {
      if (data.autoBookworkEnabled && didntControl.isConnected) {
        didntControl.dataset.sparxSolverDidntClicked = "true";
        console.log("[SparxSolver] Selecting the Bookwork 'I didn't' prompt option.");
        didntControl.click();
      }
    });
    return true;
  }

  return false;
}

function findLinkWithNestedText(text) {
  return findActionControlByText(text);
}

function findKeepGoingLink() {
  return findActionControlByText("keep going");
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

  if (!(await waitForAnswerControls())) {
    console.error("[SparxSolver] Answer controls did not appear before the auto-solve timeout.");
    handleAutoSolveFailure();
    return false;
  }

  const answerButton = findAnswerButton();
  if (answerButton) {
    answerButton.click();
    const answerFormSubmitButton = await waitForSubmitButton();
    if (!answerFormSubmitButton) {
      console.error("[SparxSolver] Answer form did not open or expose a Submit button.");
      handleAutoSolveFailure();
      return;
    }
  } else if (!getOrderedAnswerItems().length) {
    console.error("[SparxSolver] No Answer button or visible answer choices found.");
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

  const submitWasPresent = !!findButtonWithNestedText("submit");
  const readySubmitBtn = await waitForSubmitButton(
    answerButton || submitWasPresent ? 10000 : 3000,
    100,
    true
  );
  if (readySubmitBtn && !clickSubmitButton(readySubmitBtn)) {
    handleAutoSolveFailure();
    return;
  }
  if (!readySubmitBtn && (answerButton || submitWasPresent)) {
    console.error("[SparxSolver] Submit control did not become enabled after answering.");
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

  const postSubmitAction = await waitForPostSubmitAction();

  if (postSubmitAction?.type === "continue") {
    console.log("[SparxSolver] Continue link found.");
    postSubmitAction.control.click();
    await clickKeepGoing();
    await clickNextTask();
  } else if (postSubmitAction?.type === "keep-going") {
    console.log("[SparxSolver] Keep Going control found.");
    const clickedKeepGoing = await clickKeepGoing(postSubmitAction.control);
    const advanced = await clickNextTask() || clickedKeepGoing;
    if (!advanced) {
      handleAutoSolveFailure();
      return;
    }
  } else {
    const clickedKeepGoing = await clickKeepGoing();
    const advanced = await clickNextTask() || clickedKeepGoing;
    if (!advanced) {
      handleAutoSolveFailure();
      return;
    }
  }

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
  let keepGoingActivationPromise = null;
  let bookworkObserverTimer = null;
  let keepGoingAutoClickTimer = null;

  function getSolverIframe() {
    return iframe || document.getElementById(IFRAME_ID);
  }

  function applyIframeInteractionStyles(iframeElement) {
    if (!iframeElement) return;

    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const compactViewport = viewportWidth < 520;
    const horizontalInset = compactViewport ? 8 : 20;

    iframeElement.style.position = "fixed";
    iframeElement.style.top = `${horizontalInset}px`;
    iframeElement.style.right = `${horizontalInset}px`;
    iframeElement.style.width = `${Math.max(0, Math.min(475, viewportWidth - horizontalInset * 2))}px`;
    iframeElement.style.maxHeight = `${Math.max(240, Math.min(MAX_IFRAME_HEIGHT, viewportHeight - horizontalInset * 2))}px`;
    iframeElement.style.boxSizing = "border-box";
    iframeElement.style.zIndex = IFRAME_Z_INDEX;
    iframeElement.style.pointerEvents = "auto";
    iframeElement.style.border = "1px solid #dbdbdb";
    iframeElement.style.borderRadius = "8px";
    iframeElement.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    iframeElement.style.backgroundColor = "white";
    iframeElement.style.transition = "height 0.2s ease-in-out";
  }

  window.addEventListener("resize", () => {
    if (isIframeVisible) applyIframeInteractionStyles(getSolverIframe());
  });

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

      const submitButton = await waitForSubmitButton(10000, 100, true);
      if (!submitButton) {
        console.warn("[SparxSolver] Submit button never became enabled after selection.");
        return;
      }

      if (!clickSubmitButton(submitButton)) {
        console.warn("[SparxSolver] Failed to click the Bookwork submit button.");
        return;
      }

      const postSubmitAction = await waitForPostSubmitAction();
      if (postSubmitAction?.type === "continue") {
        console.log("[SparxSolver] Continue link found. Proceeding to next screen.");
        postSubmitAction.control.click();
        await clickKeepGoing();
        await clickNextTask();
      } else if (postSubmitAction?.type === "keep-going") {
        console.log("[SparxSolver] Keep Going control found.");
        const clickedKeepGoing = await clickKeepGoing(postSubmitAction.control);
        const advanced = await clickNextTask() || clickedKeepGoing;
        if (!advanced) {
          console.warn("[SparxSolver] Keep Going prompt remained active; stopping bookwork navigation.");
          return;
        }
      } else {
        const clickedKeepGoing = await clickKeepGoing();
        const advanced = await clickNextTask() || clickedKeepGoing;
        if (advanced) return;
        console.warn("[SparxSolver] No Continue, Summary, or Next task control appeared after Bookwork submit.");
      }
    } finally {
      autoBookworkRunInProgress = false;
    }
  }

  function scheduleBookworkPageRefresh(delay = 300) {
    clearTimeout(bookworkObserverTimer);

    bookworkObserverTimer = setTimeout(() => {
      if (clickBookworkDidntPrompt()) {
        return;
      }

      if (!isBookworkCheckPage()) {
        return;
      }

      findAndDisplayBookworkAnswer();
      runAutoBookworkSequence();
    }, delay);
  }

  function scheduleAutomaticKeepGoingClick(delay = 100) {
    clearTimeout(keepGoingAutoClickTimer);
    keepGoingAutoClickTimer = setTimeout(async () => {
      const settings = await new Promise((resolve) => {
        chrome.storage.local.get(["autoSolveEnabled", "autoBookworkEnabled"], resolve);
      });
      if (!settings.autoSolveEnabled && !settings.autoBookworkEnabled) return;

      const keepGoingControl = findActionControlByText("keep going");
      if (!keepGoingControl) return;

      console.info("[SparxSolver] Keep Going detected by page observer; auto-activating.");
      await clickKeepGoing(keepGoingControl);
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
            const viewportLimit = Math.max(240, Math.min(MAX_IFRAME_HEIGHT, window.innerHeight - 16));
            newHeight = Math.min(newHeight, viewportLimit);
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
  if (areaName === "local") {
    if (changes.autoSolveEnabled?.newValue || changes.autoBookworkEnabled?.newValue) {
      scheduleAutomaticKeepGoingClick(0);
    }

    if (changes.autoBookworkEnabled) {
      const isBookworkEnabled = changes.autoBookworkEnabled.newValue;
      console.log(`[SparxSolver] Auto-Bookwork toggle turned ${isBookworkEnabled ? "ON" : "OFF"}`);

      if (isBookworkEnabled) {
        scheduleBookworkPageRefresh(0);
      }
    }
  }
});

  const bookworkPageObserver = new MutationObserver(() => {
    scheduleAutomaticKeepGoingClick(100);
    if (autoBookworkRunInProgress) {
      return;
    }

    scheduleBookworkPageRefresh(300);
  });

  bookworkPageObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  scheduleAutomaticKeepGoingClick(0);


  // Listen for screenshot request from background.js
  function findQuestionContentElement() {
    return (
      document.querySelector('[class*="QuestionWrapper"]') ||
      document.querySelector('[class^="_Question_"]') ||
      document.querySelector('[class*="Flashcard"], [class*="FlashCard"], [data-testid*="flashcard" i]') ||
      document.querySelector("main") ||
      document.body
    );
  }

  function findQuestionAndAnswerContentElement() {
    let container = findQuestionContentElement();
    const answerElements = getOrderedAnswerItems(false)
      .map((item) => item.fieldContainer || item.input || item.answerPart || item.target || item.slot || item.choices?.[0])
      .filter(Boolean);

    while (container && answerElements.some((element) => !container.contains(element))) {
      container = container.parentElement;
    }

    return container || findQuestionContentElement();
  }

  function describeAnswerLayout() {
    return getOrderedAnswerItems(false).map((item, index) => {
      const target = item.fieldContainer || item.input || item.answerPart || item.target || item.slot || item.choices?.[0];
      const bounds = target?.getBoundingClientRect();
      const answerPart = item.answerPart || item.input?.closest("[class*='AnswerPart']") || item.target?.parentElement;
      const nearbyText = (answerPart?.innerText || answerPart?.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

      return {
        order: index + 1,
        type: item.type,
        placeholder: item.input?.getAttribute("placeholder") || "",
        ariaLabel: item.input?.getAttribute("aria-label") || "",
        inputType: item.input?.getAttribute("type") || "",
        inputMode: item.input?.getAttribute("inputmode") || "",
        readOnly: Boolean(item.input?.readOnly),
        pattern: item.input?.getAttribute("pattern") || "",
        nearbyText: item.type === "numeric" ? getStaticAnswerPartText(item) || nearbyText : nearbyText,
        x: bounds ? Math.round(bounds.x) : null,
        y: bounds ? Math.round(bounds.y) : null,
        choiceCount: item.choices?.length || 0,
      };
    });
  }

  function hasVisibleAnswerControls() {
    const isVisible = (element) => {
      if (!element?.isConnected || !element.getClientRects().length) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    };

    if (findActionControlByText("answer")) return true;

    return getOrderedAnswerItems(false).some((item) => {
      const candidates = [
        item.input,
        item.target,
        item.slot,
        ...(item.choices || []),
      ];
      return candidates.some(isVisible);
    });
  }

  function waitForAnswerControls(timeout = 30000, interval = 250) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const check = () => {
        if (hasVisibleAnswerControls()) {
          resolve(true);
        } else if (Date.now() - startedAt >= timeout) {
          resolve(false);
        } else {
          setTimeout(check, interval);
        }
      };
      check();
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getQuestionText") {
      const questionEl = findQuestionContentElement();
      const questionText = (questionEl?.innerText || questionEl?.textContent || "")
        .trim()
        .slice(0, 12000);

      if (!questionText) {
        sendResponse({ error: "No visible question or flashcard text was found." });
      } else {
        sendResponse({ text: questionText });
      }
      return;
    }

    if (request.action === "captureQuestionScreenshot") {
      // Dynamically load html2canvas if not present
      async function doScreenshot() {
        if (!(await waitForAnswerControls())) {
          sendResponse({ error: "The question is still loading or has no visible answer controls. Please wait for the answer area and try again." });
          return;
        }

        const questionEl = findQuestionAndAnswerContentElement();
        if (!questionEl) {
          sendResponse({ error: "Question element not found." });
          return;
        }
        const answerLayout = describeAnswerLayout();
        const [questionCanvas, viewportCanvas] = await Promise.all([
          window.html2canvas(questionEl, {
            scale: window.devicePixelRatio * 2,
            useCORS: true,
            allowTaint: true,
          }),
          window.html2canvas(document.documentElement, {
            x: window.scrollX,
            y: window.scrollY,
            width: window.innerWidth,
            height: window.innerHeight,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            scale: Math.min(window.devicePixelRatio || 1, 1.5),
            useCORS: true,
            allowTaint: true,
          }),
        ]);
        sendResponse({
          dataUrl: questionCanvas.toDataURL(),
          viewportDataUrl: viewportCanvas.toDataURL(),
          answerLayout,
        });
      }

      const handleScreenshotError = (error) => {
        console.error("[SparxSolver] Question/answer screenshot failed:", error);
        sendResponse({ error: error.message || "Could not capture the question and answer page." });
      };

      if (window.html2canvas) {
        doScreenshot().catch(handleScreenshotError);
      } else {
        // Inject html2canvas if not present
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("libs/html2canvas.min.js");
        script.onload = () => doScreenshot().catch(handleScreenshotError);
        script.onerror = () => handleScreenshotError(new Error("Could not load screenshot support."));
        document.head.appendChild(script);
      }
      return true; // Keep channel open for async response
    }
  });
})();
