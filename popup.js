document.addEventListener('DOMContentLoaded', () => {
    const addButton = document.getElementById('add-button');
    const spoilerInput = document.getElementById('spoiler-input');
    const spoilerList = document.getElementById('spoiler-list');

    // Function to render the list of spoilers
    function renderSpoilers(spoilers) {
        spoilerList.innerHTML = ''; // Clear the current list
        spoilers.forEach((spoiler, index) => {
            const li = document.createElement('li');
            li.textContent = spoiler;

            const removeButton = document.createElement('button');
            removeButton.textContent = 'x';
            removeButton.classList.add('remove-btn');
            removeButton.addEventListener('click', () => {
                removeSpoiler(index);
            });

            li.appendChild(removeButton);
            spoilerList.appendChild(li);
        });
    }

    // Function to add a new spoiler
    function addSpoiler() {
        const newSpoiler = spoilerInput.value.trim().toLowerCase();
        if (newSpoiler) {
            chrome.storage.sync.get({ spoilers: [] }, (data) => {
                const updatedSpoilers = [...data.spoilers, newSpoiler];
                chrome.storage.sync.set({ spoilers: updatedSpoilers }, () => {
                    renderSpoilers(updatedSpoilers);
                    spoilerInput.value = '';
                });
            });
        }
    }

    // Function to remove a spoiler by its index
    function removeSpoiler(indexToRemove) {
        chrome.storage.sync.get({ spoilers: [] }, (data) => {
            const updatedSpoilers = data.spoilers.filter((_, index) => index !== indexToRemove);
            chrome.storage.sync.set({ spoilers: updatedSpoilers }, () => {
                renderSpoilers(updatedSpoilers);
            });
        });
    }

    // Load initial spoilers from storage
    chrome.storage.sync.get({ spoilers: [] }, (data) => {
        renderSpoilers(data.spoilers);
    });

    // Event Listeners
    addButton.addEventListener('click', addSpoiler);
    spoilerInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addSpoiler();
        }
    });
});