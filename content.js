// --- CONFIGURATION ---

const BLUR_CLASS_NAME = 'yt-extension-blurred-item-v10';
const AI_PROMPT_TEMPLATE = `
  You are a YouTube content filter. Your job is to check if a video title is related to a user's list of blocked topics.
  The user's blocked topics are: "{BLOCKED_TOPICS}".
  The video's title is: "{VIDEO_TITLE}".

  Is this video title related to any of the user's blocked topics?
  Answer with the single word "Yes" or the single word "No".
`;
const VIDEO_CONTAINER_SELECTORS = [
  'ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-grid-video-renderer',
  'ytd-compact-video-renderer', 'ytd-playlist-panel-video-renderer',
  'ytd-reel-item-renderer', 'ytd-item-section-renderer'
];

// --- STATE MANAGEMENT ---

let aiSession = null;
let blockedTopics = [];
const aiQueue = new Set();
const titleDecisionCache = new Map();
let noTitleFailureCount = 0;
let hasShownNoTitleWarning = false;
const NO_TITLE_FAILURE_THRESHOLD = 8; // Show warning after this many failures.

// =================================================================================
// SECTION 1: THE AI ENGINE
// =================================================================================

async function processOneItemFromQueue() {
  if (!aiSession || aiQueue.size === 0) {
    setTimeout(processOneItemFromQueue, 1000);
    return;
  }

  const element = aiQueue.values().next().value;
  aiQueue.delete(element);

  const titleElement = element.querySelector('#video-title');
  const videoTitle = titleElement ? titleElement.textContent.trim() : null;

  if (!videoTitle) {
    element.dataset.aiStatus = 'processed-no-title';
    noTitleFailureCount++;
    if (noTitleFailureCount > NO_TITLE_FAILURE_THRESHOLD && !hasShownNoTitleWarning) {
      showNoTitleWarning();
    }
    setTimeout(processOneItemFromQueue, 50);
    return;
  }

  noTitleFailureCount = 0;
  console.log(`Processing video: "${videoTitle}"`);

  if (blockedTopics.length === 0) {
    console.log(`-> Block list is empty. Unblurring.`);
    element.classList.remove(BLUR_CLASS_NAME);
    element.dataset.aiStatus = 'processed';
    setTimeout(processOneItemFromQueue, 500);
    return;
  }

  if (titleDecisionCache.has(videoTitle)) {
    const isSpoiler = titleDecisionCache.get(videoTitle);
    if (!isSpoiler) {
        element.classList.remove(BLUR_CLASS_NAME);
    }
    element.dataset.aiStatus = 'processed';
    setTimeout(processOneItemFromQueue, 500);
    return;
  }

  console.log(`-> Asking AI if title is related to [${blockedTopics.join(', ')}]`);
  let decisionIsSpoiler = false;
  try {
    const prompt = AI_PROMPT_TEMPLATE
      .replace("{BLOCKED_TOPICS}", blockedTopics.join(', '))
      .replace("{VIDEO_TITLE}", videoTitle);

    const response = await aiSession.prompt(prompt);
    if (response.trim().toLowerCase().includes('yes')) {
      decisionIsSpoiler = true;
    }
  } catch (error) {
    console.error("AI prompt failed:", error);
  }

  titleDecisionCache.set(videoTitle, decisionIsSpoiler);

  if (decisionIsSpoiler) {
    console.log(`%c-> AI determined this IS a spoiler. Video will remain blurred.`, 'color: #dc3545; font-weight: bold;');
  } else {
    console.log(`%c-> AI determined this is NOT a spoiler. Unblurring video.`, 'color: #28a745; font-weight: bold;');
    element.classList.remove(BLUR_CLASS_NAME);
  }

  element.dataset.aiStatus = 'processed';
  setTimeout(processOneItemFromQueue, 1000);
}

async function initializeAi() {
  if (!self.LanguageModel) {
    console.error("LanguageModel API not available.");
    return;
  }
  try {
    const storageResult = await chrome.storage.local.get({ spoilerTopics: [] });
    blockedTopics = storageResult.spoilerTopics;

    aiSession = await self.LanguageModel.create({ outputLanguage: 'en' });
    console.log("AI Engine Ready. Blocked topics:", blockedTopics);
    processOneItemFromQueue();

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.spoilerTopics) {
        blockedTopics = changes.spoilerTopics.newValue;
        titleDecisionCache.clear();
        console.log("Block list updated. Re-scanning page.", blockedTopics);
        document.querySelectorAll(VIDEO_CONTAINER_SELECTORS.join(', ')).forEach(el => {
            el.removeAttribute('data-ai-status');
            el.classList.add(BLUR_CLASS_NAME);
            if (!aiQueue.has(el)) {
                aiQueue.add(el);
            }
        });
      }
    });
  } catch (error) {
    console.error("Could not initialize LanguageModel session:", error);
  }
}

// =================================================================================
// SECTION 2: THE BLURRING ENGINE
// =================================================================================

function injectCss() {
  if (document.getElementById('yt-blur-extension-style-v10')) return;
  const style = document.createElement('style');
  style.id = 'yt-blur-extension-style-v10';
  style.textContent = `.${BLUR_CLASS_NAME} { filter: blur(12px) !important; opacity: 0.5 !important; transition: all 0.3s ease !important; }`;
  document.head.appendChild(style);
}

function scanAndQueueVideos() {
    const elements = document.querySelectorAll(VIDEO_CONTAINER_SELECTORS.join(', '));
    for (const element of elements) {
        if (!element.dataset.aiStatus) {
            element.classList.add(BLUR_CLASS_NAME);
            aiQueue.add(element);
            element.dataset.aiStatus = 'queued';
        }
    }
}

function startBlurringEngine() {
  console.log("Blurring Engine: Starting...");
  injectCss();

  const observer = new MutationObserver(scanAndQueueVideos);
  observer.observe(document.body, { childList: true, subtree: true });

  scanAndQueueVideos();
  console.log("Blurring Engine: Active and watching for videos.");
}

// =================================================================================
// SECTION 3: UI HELPER FUNCTIONS
// =================================================================================
function showNoTitleWarning() {
    hasShownNoTitleWarning = true;

    const warningDiv = document.createElement('div');
    warningDiv.id = 'yt-spoiler-blocker-warning';
    warningDiv.style.backgroundColor = '#282828';
    warningDiv.style.color = '#fff';
    warningDiv.style.padding = '10px 20px';
    warningDiv.style.textAlign = 'center';
    warningDiv.style.fontSize = '14px';
    warningDiv.style.borderBottom = '1px solid #444';
    warningDiv.style.position = 'relative';
    warningDiv.style.zIndex = '9999';

    warningDiv.innerHTML = `
        <strong>Spoiler Blocker Notice:</strong> YouTube's landing page and sidebar contents are automatically blurred. Search for the videos you want for a spoiler-free experience.
        <span id="yt-spoiler-blocker-dismiss" style="cursor: pointer; font-weight: bold; margin-left: 20px; color: #aaa;">&times;</span>
    `;

    const contentArea = document.querySelector('#content.ytd-app');
    if (contentArea) {
        contentArea.prepend(warningDiv);
    }

    document.getElementById('yt-spoiler-blocker-dismiss').addEventListener('click', () => {
        warningDiv.style.display = 'none';
    });
}


// =================================================================================
// SCRIPT EXECUTION
// =================================================================================
startBlurringEngine();
initializeAi();