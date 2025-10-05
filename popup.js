document.addEventListener('DOMContentLoaded', () => {
    const spoilerInput = document.getElementById('spoiler-input');
    const addSpoilerBtn = document.getElementById('add-spoiler');
    const spoilerList = document.getElementById('spoiler-list');

    // Load existing spoilers from storage
    chrome.storage.local.get({ spoilerTopics: [] }, (data) => {
        renderList(data.spoilerTopics);
    });

    const addSpoiler = () => {
        const topic = spoilerInput.value.trim();
        if (topic) {
            chrome.storage.local.get({ spoilerTopics: [] }, (data) => {
                const topics = data.spoilerTopics;
                if (!topics.includes(topic)) {
                    topics.push(topic);
                    chrome.storage.local.set({ spoilerTopics: topics }, () => {
                        renderList(topics);
                        spoilerInput.value = '';
                    });
                }
            });
        }
    };

    addSpoilerBtn.addEventListener('click', addSpoiler);
    spoilerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addSpoiler();
        }
    });

    function renderList(topics) {
        spoilerList.innerHTML = '';
        topics.forEach((topic, index) => {
            const li = document.createElement('li');
            li.textContent = topic;
            const removeBtn = document.createElement('span');
            removeBtn.textContent = 'X';
            removeBtn.className = 'remove-btn';
            removeBtn.addEventListener('click', () => {
                topics.splice(index, 1);
                chrome.storage.local.set({ spoilerTopics: topics }, () => {
                    renderList(topics);
                });
            });
            li.appendChild(removeBtn);
            spoilerList.appendChild(li);
        });
    }
});