//Adding `install` event listener
self.addEventListener('install', (event) => {
    console.info('Event: Install');
});

//Adding `fetch` event listener
self.addEventListener('fetch', (event) => {
    console.info('Event: Fetch');
});
