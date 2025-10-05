(async function() {
    if (!window.LanguageModel) {
        console.error("Spoiler Shield Error: The LanguageModel API is not available in this browser. Please ensure you are using a compatible version of Chrome (like Canary or Dev) with the necessary flags enabled.");
        return;
    }

    try {
        const modelAvailability = await window.LanguageModel.availability();
        if (modelAvailability !== 'readily') {
            console.error(`Spoiler Shield Error: AI model is not ready. Status: ${modelAvailability}. This may be due to the model still downloading, a lack of disk space, or a browser compatibility issue.`);
            return;
        }
    } catch (error) {
        console.error("Spoiler Shield Error: Could not determine AI model availability.", error);
        return;
    }

    chrome.storage.sync.get({ spoilers: [] }, async (data) => {
        const spoilerTopics = data.spoilers;

        if (spoilerTopics.length === 0) {
            return;
        }

        const model = await window.LanguageModel.fromDefault();

        async function processVideoElement(videoElement) {
            if (videoElement.dataset.spoilerChecked === 'true') return;
            videoElement.dataset.spoilerChecked = 'true';

            const titleElement = videoElement.querySelector('#video-title');
            if (!titleElement) return;

            const title = titleElement.textContent.trim();
            if (!title) return;

            const prompt = `Is the following video title strictly related to any of these topics: "${spoilerTopics.join(', ')}"? Please answer with only the single word "yes" or "no". Title: "${title}"`;

            try {
                const result = await model.prompt(prompt);

                if (result.toLowerCase().includes('yes')) {
                    console.log(`AI Spoiler DETECTED for title: ${title}`);
                    videoElement.style.filter = 'blur(15px)';
                    videoElement.style.transition = 'filter 0.2s ease';
                    videoElement.addEventListener('mouseenter', () => videoElement.style.filter = 'none');
                    videoElement.addEventListener('mouseleave', () => videoElement.style.filter = 'blur(15px)');
                }
            } catch (error) {
                console.error(`Spoiler Shield Error: The AI prompt failed for title "${title}".`, error);
            }
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.matches('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer')) {
                            processVideoElement(node);
                        }
                        const videos = node.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer');
                        videos.forEach(processVideoElement);
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer').forEach(processVideoElement);
    });
})();