let currentItem = null;
let currentLinks = [];
let currentPosts = [];

// Get URI parameter from URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Load featured items data
async function loadFeaturedData() {
    try {
        const response = await fetch(Config.featured);
        return await response.json();
    } catch (error) {
        console.error('Error loading featured data:', error);
        return [];
    }
}

// Fetch GitHub repository data
async function fetchGitHubRepo(owner, repo) {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching GitHub repo:', error);
        return null;
    }
}

// Fetch pinokio_meta.json for additional data
async function fetchPinokioMeta(repoFullName) {
    try {
        console.log('Fetching pinokio_meta.json for:', repoFullName);
        const response = await fetch(`https://raw.githubusercontent.com/${repoFullName}/main/pinokio_meta.json`);
        const meta = await response.json();
        console.log('Pinokio meta data:', meta);
        
        // Extract tweet IDs from posts
        if (meta.posts) {
            const tweetIds = [];
            for (const post of meta.posts) {
                // Reset regex for each iteration
                const tweetRegex = /.*(twitter|x)\.com\/.+\/([0-9]+)/i;
                const matches = post.match(tweetRegex);
                if (matches && matches.length > 2) {
                    tweetIds.push(matches[2]);
                    console.log('Found tweet ID:', matches[2], 'from:', post);
                }
            }
            currentPosts = tweetIds;
            console.log('Extracted tweet IDs:', tweetIds);
        }
        
        if (meta.links) {
            currentLinks = meta.links;
        }
        
        return meta;
    } catch (error) {
        console.error('Error fetching pinokio meta:', error);
        return null;
    }
}

// Create author section HTML
function createAuthorSection(item) {
  console.log("createAuthorSection", { item })
    if (item.author_username) {
        return `
            <div class="author">
                <img src="${item.author_avatar}" width="50" height="50" alt="Author" />
                <div class="text">
                    <div>Verified Script Publisher:</div>
                    <a target="_blank" href="${item.author_url}">
                        @${item.author_username} <i class="fas fa-up-right-from-square"></i>
                    </a>
                </div> 
            </div>
            ${createTipSection()}
        `;
    } else {
        return `
            <div class="author">
                <div class="icon">
                    <i class="fas fa-circle-question"></i>
                </div>
                <div class="text">
                    <div>Script Publisher:</div>
                    <div>Not Verified</div>
                </div> 
            </div>
            ${createTipSection()}
        `;
    }
}

// Create tip/donation section
function createTipSection() {
    if (!currentLinks || currentLinks.length === 0) {
        return '';
    }
    
    return `
        <div class="donation">
            ${currentLinks.map(link => {
                if (link.links) {
                    return `
                        <div class="linkgroup">
                            <div class="linktitle">${link.title || ''}</div>
                            ${createNestedLinks(link.links)}
                        </div>
                    `;
                } else if (link.type === 'bitcoin') {
                    return createBitcoinLink(link);
                } else {
                    return createRegularLink(link);
                }
            }).join('')}
        </div>
    `;
}

function createNestedLinks(links) {
    return links.map(link => {
        if (link.type === 'bitcoin') {
            return createBitcoinLink(link);
        } else {
            return createRegularLink(link);
        }
    }).join('');
}

function createBitcoinLink(item) {
    const title = item.title || 'Bitcoin donation';
    return `
        <div class="line">
            <button class="iconbtn" onclick="showBitcoinModal('${item.value}', '${title}')">
                <img src="images/bitcoin.png" width="30" height="30" alt="Bitcoin" />
                ${title}
                <i class="fas fa-up-right-from-square"></i>
            </button>
        </div>
    `;
}

function createRegularLink(item) {
    const url = item.value || item.url;
    const title = item.title || url;
    const favicon = getFaviconUrl(url);
    
    return `
        <div class="line">
            <a target="_blank" href="${url}" class="iconbtn">
                <img src="${favicon.primary}" alt="favicon" width="16" height="16" 
                     onerror="this.src='${favicon.fallback}'" />
                <div>${title}</div>
            </a>
        </div>
    `;
}

function getFaviconUrl(url) {
    try {
        const parsed = new URL(url);
        const origin = parsed.origin;
        return {
            primary: `${origin}/favicon.ico`,
            fallback: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`
        };
    } catch {
        return { 
            primary: '', 
            fallback: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>' 
        };
    }
}

function showBitcoinModal(address, title) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="
            background: white;
            padding: 30px;
            border-radius: 8px;
            max-width: 400px;
            text-align: center;
        ">
            <h2>${title}</h2>
            <div id="qr-container" style="margin: 20px 0;">
                <div style="margin-bottom: 10px;">Loading QR code...</div>
            </div>
            <div style="font-family: monospace; margin: 20px 0; word-break: break-all; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 4px;">
                bitcoin:${address}
            </div>
            <button onclick="this.closest('.modal-overlay').remove()" style="
                padding: 10px 20px;
                background: #2647ad;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            ">Close</button>
        </div>
    `;
    
    // Close modal when clicking overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
    
    // Generate QR code
    generateBitcoinQR(`bitcoin:${address}`, 'qr-container');
}

function generateBitcoinQR(bitcoinUri, containerId) {
    // Use QR Server API to generate QR code
    const qrContainer = document.getElementById(containerId);
    const size = 200;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(bitcoinUri)}&margin=2`;
    
    qrContainer.innerHTML = `
        <img src="${qrUrl}" 
             alt="Bitcoin QR Code" 
             style="border: 2px solid #010599; border-radius: 8px; background: #FFBF60;"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <div style="display: none; padding: 20px; border: 2px dashed #ccc; border-radius: 8px;">
            QR code could not be generated
        </div>
    `;
}

// Render item profile
function renderItemProfile(item) {
    const profileSection = document.getElementById('profileSection');
    profileSection.innerHTML = `
        <div class="card">
            <div class="item">
                <img class="app_icon" src="${item.image}" width="100" height="100" alt="App Icon" />
                <div class="col">
                    <div class="title">${item.title}</div>
                    <a class="ln" target="_blank" href="${item.url}">${item.url} <i class="fas fa-up-right-from-square"></i></a>
                    <div class="description">${item.description}</div>
                    <a target="_blank" href="${item.downloadURL}" class="btn">
                        <i class="fas fa-download"></i> One-Click Install with Pinokio
                    </a>
                    <footer>
                        <span>Don't have Pinokio?</span> <a href="https://pinokio.computer" target="_blank">Download Pinokio</a> first.
                    </footer>
                </div>
                <div class="right">
                    ${createAuthorSection(item)}
                </div>
            </div>
        </div>
    `;
}

// Render tweets using Twitter's embedded tweet widget
function renderTweets() {
    const postsSection = document.getElementById('postsSection');
    const tweetsContainer = document.getElementById('tweetsContainer');

    console.log({ currentPosts })
    
    if (currentPosts.length > 0) {
        postsSection.style.display = 'block';
        
        // Clear container first
        tweetsContainer.innerHTML = '<div class="masonry-container"></div>';
        const masonryContainer = tweetsContainer.querySelector('.masonry-container');
        
        // Initialize masonry layout variables
        let columns = [];
        let columnCount = 0;
        
        function initMasonryColumns() {
            const containerWidth = masonryContainer.offsetWidth;
            columnCount = Math.floor(containerWidth / 355); // 350px + 2px gap
            columns = Array(columnCount).fill(0); // Track height of each column
            
            // Clear and setup columns
            masonryContainer.innerHTML = '';
            for (let i = 0; i < columnCount; i++) {
                const column = document.createElement('div');
                column.className = 'masonry-column';
                column.style.cssText = `
                    width: 350px;
                    margin-right: ${i < columnCount - 1 ? '5px' : '0'};
                    display: inline-block;
                    vertical-align: top;
                `;
                masonryContainer.appendChild(column);
            }
        }
        
        function addToMasonry(tweetElement) {
            if (columnCount === 0) return;
            
            // Find shortest column
            const shortestColumnIndex = columns.indexOf(Math.min(...columns));
            const targetColumn = masonryContainer.children[shortestColumnIndex];
            
            // Add tweet to shortest column
            tweetElement.style.marginBottom = '5px';
            targetColumn.appendChild(tweetElement);
            
            // Update column height (approximate)
            columns[shortestColumnIndex] += 200; // Estimate tweet height
        }
        
        // Initialize masonry layout
        initMasonryColumns();
        
        // Load Twitter widget script first, then use sliding window approach
        loadTwitterWidget(() => {
            console.log('Loading', currentPosts.length, 'tweets with sliding window (max 10 concurrent)');
            
            // Create all tweet containers first
            const tweetElements = currentPosts.map(tweetId => {
                const tweetDiv = document.createElement('div');
                tweetDiv.className = 'tweet-item';
                tweetDiv.innerHTML = `
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <div class="loading-text">Loading...</div>
                    </div>
                `;
                tweetDiv.style.width = '350px';
                addToMasonry(tweetDiv);
                return { tweetId, tweetDiv, loaded: false };
            });
            
            // Sliding window loader
            const MAX_CONCURRENT = 5;
            let currentIndex = 0;
            let loadingCount = 0;
            
            function loadNextTweet() {
                if (currentIndex >= tweetElements.length) {
                    console.log('All tweets queued for loading');
                    return;
                }
                
                if (loadingCount >= MAX_CONCURRENT) {
                    console.log('Max concurrent limit reached, waiting...');
                    return;
                }
                
                const { tweetId, tweetDiv, loaded } = tweetElements[currentIndex];
                if (loaded) {
                    currentIndex++;
                    loadNextTweet();
                    return;
                }
                
                console.log('Loading tweet:', tweetId, '(slot', loadingCount + 1, 'of', MAX_CONCURRENT, ')');
                loadingCount++;
                currentIndex++;
                
                function onTweetComplete() {
                    loadingCount--;
                    console.log('Tweet completed, loading count now:', loadingCount);
                    loadNextTweet(); // Try to load next tweet
                }
                
                // Set timeout for this tweet
                const timeoutId = setTimeout(() => {
                    if (!tweetElements.find(t => t.tweetId === tweetId).loaded) {
                        console.log('Tweet loading timeout for:', tweetId);
                        tweetDiv.innerHTML = '<div style="padding: 15px; border: 1px solid #ccc;">Tweet loading timed out</div>';
                        tweetElements.find(t => t.tweetId === tweetId).loaded = true;
                        onTweetComplete();
                    }
                }, 5000);
                
                if (window.twttr && window.twttr.widgets && window.twttr.widgets.createTweet) {
                    // Clear the placeholder and let createTweet populate the container
                    tweetDiv.innerHTML = '';
                    
                    window.twttr.widgets.createTweet(tweetId, tweetDiv, {
                        theme: 'light',
                        conversation: 'none',
                        cards: 'visible',
//                        width: 350
                    }).then((element) => {
                        clearTimeout(timeoutId);
                        tweetElements.find(t => t.tweetId === tweetId).loaded = true;
                        if (element) {
                            console.log('Tweet loaded and rendered successfully:', tweetId);
                        } else {
                            console.log('Tweet createTweet returned null for:', tweetId);
                            // Just show simple error message instead of fallback
                            tweetDiv.innerHTML = '<div style="padding: 15px; border: 1px solid #ccc;">Tweet could not be loaded</div>';
                        }
                        onTweetComplete();
                    }).catch((error) => {
                        clearTimeout(timeoutId);
                        tweetElements.find(t => t.tweetId === tweetId).loaded = true;
                        console.log('Tweet failed:', tweetId, error);
                        // Just show simple error message instead of fallback
                        tweetDiv.innerHTML = '<div style="padding: 15px; border: 1px solid #ccc;">Tweet could not be loaded</div>';
                        onTweetComplete();
                    });
                } else {
                    clearTimeout(timeoutId);
                    tweetElements.find(t => t.tweetId === tweetId).loaded = true;
                    console.log('Twitter widgets API not available');
                    tweetDiv.innerHTML = '<div style="padding: 15px; border: 1px solid #ccc;">Twitter widgets not available</div>';
                    onTweetComplete();
                }
                
                // Try to start loading the next tweet immediately
                loadNextTweet();
            }
            
            // Start the sliding window
            loadNextTweet();
        });
    } else {
        postsSection.style.display = 'block';
        tweetsContainer.innerHTML = `
            <div class="empty">
                Feed is Empty. Create a pinokio_meta.json file and add X.com links to the posts array, and the posts will show up here.
            </div>
        `;
    }
}

// Load Twitter widget script
function loadTwitterWidget(callback) {
    if (!window.twttr) {
        // Create script tag
        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.charset = 'utf-8';
        
        // Set up callback for when script loads
        script.onload = () => {
            console.log('Twitter widgets script loaded successfully');
            // Wait a bit for twttr to be fully available
            setTimeout(() => {
                if (window.twttr && window.twttr.widgets) {
                    console.log('Twitter widgets API available');
                    if (callback) callback();
                } else {
                    console.error('Twitter widgets API not available after script load');
                    fallbackToLinks();
                }
            }, 100);
        };
        
        script.onerror = () => {
            console.error('Failed to load Twitter widgets script');
            fallbackToLinks();
        };
        
        document.head.appendChild(script);
    } else {
        console.log('Twitter widgets already loaded');
        if (window.twttr.widgets) {
            if (callback) callback();
        } else {
            console.error('Twitter widgets object exists but widgets API not available');
            fallbackToLinks();
        }
    }
}

// Removed iframe fallback - only using official Twitter widgets

// Fallback function to show simple tweet links if embedding fails
function fallbackToLinks() {
    const tweetsContainer = document.getElementById('tweetsContainer');
    if (currentPosts.length > 0) {
        tweetsContainer.innerHTML = `
            <div class="masonry-container">
                ${currentPosts.map(tweetId => `
                    <div class="tweet-item">
                        <div style="border: 1px solid #ccc; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                            <p>📱 Tweet Preview</p>
                            <a href="https://twitter.com/i/web/status/${tweetId}" target="_blank" rel="noopener">
                                View Tweet →
                            </a>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

// Main function to load item details
async function loadItemDetails() {
    const uri = getQueryParam('uri');
    const display = getQueryParam('display');
    
    // Hide navigation if display mode is set
    if (display) {
        document.getElementById('navigation').style.display = 'none';
    }
    
    if (!uri) {
        document.getElementById('profileSection').innerHTML = `
            <div class="card" style="text-align: center;">
                <div class="title">No Item Selected</div>
                <div class="description">Please select an item from the home page.</div>
            </div>
        `;
        return;
    }
    
    // Reset state
    currentLinks = [];
    currentPosts = [];
    
    try {
        // Load featured data
        const featuredItems = await loadFeaturedData();
        console.log({ featuredItems })
        
        // Check if it's a GitHub URL
        const githubRegex = /github\.com\/(.+)\/(.+)/i;
        const match = githubRegex.exec(uri);
        
        let item = {};
        
        if (match && match.length > 0) {
            // It's a GitHub URL - fetch repo data
            const owner = match[1];
            const repo = match[2];
            const repoData = await fetchGitHubRepo(owner, repo);
            
            if (repoData) {
                item = {
                    title: repoData.name,
                    description: repoData.description,
                    image: repoData.owner.avatar_url,
                    url: repoData.html_url,
                    path: repoData.full_name,
                    download: repoData.html_url,
                    downloadURL: `pinokio://download?uri=${repoData.html_url}`,
                    id: repoData.full_name
                };
                
                // Fetch additional metadata
                await fetchPinokioMeta(repoData.full_name);
            }
        }
        
        // Check if this item is in featured list and override with featured data
        for (const featuredItem of featuredItems) {
            if (featuredItem.url.toLowerCase() === uri.toLowerCase() || 
                (item.url && featuredItem.url.toLowerCase() === item.url.toLowerCase())) {
                
                // Override with featured data
                if (featuredItem.title) item.title = featuredItem.title;
                if (featuredItem.image) item.image = featuredItem.image;
                if (featuredItem.url) item.url = featuredItem.url;
                if (featuredItem.path) item.path = featuredItem.path;
                if (featuredItem.description) item.description = featuredItem.description;
                if (featuredItem.download) item.download = featuredItem.download;
                if (featuredItem.version) item.version = featuredItem.version;
                if (featuredItem.branch) item.branch = featuredItem.branch;
                if (featuredItem.author_avatar) item.author_avatar = featuredItem.author_avatar;
                if (featuredItem.author_url) item.author_url = featuredItem.author_url;
                if (featuredItem.author_username) item.author_username = featuredItem.author_username;
                if (featuredItem.links && Array.isArray(featuredItem.links)) {
                    currentLinks = featuredItem.links;
                }
                
                // Update download URL
                item.downloadURL = `pinokio://download?uri=${item.download}`;
                if (item.branch) {
                    item.downloadURL += "&branch=" + item.branch;
                }
                break;
            }
        }
        
        // If no GitHub match, check featured items directly
        if (!match) {
            for (const featuredItem of featuredItems) {
                if (featuredItem.url.toLowerCase() === uri.toLowerCase()) {
                    item = { ...featuredItem };
                    item.downloadURL = `pinokio://download?uri=${item.download}`;
                    if (item.branch) {
                        item.downloadURL += "&branch=" + item.branch;
                    }
                    if (item.links && Array.isArray(item.links)) {
                        currentLinks = item.links;
                    }
                    break;
                }
            }
        }
        
        currentItem = item;
        
        // Render the UI based on display mode
        if (!display || display === 'profile') {
            renderItemProfile(item);
        }
        
        if (!display || display === 'feed') {
            console.log('Rendering tweets, currentPosts:', currentPosts);
            renderTweets();
        }
        
    } catch (error) {
        console.error('Error loading item details:', error);
        document.getElementById('profileSection').innerHTML = `
            <div class="card" style="text-align: center;">
                <div class="title">Error Loading Item</div>
                <div class="description">There was an error loading the item details.</div>
            </div>
        `;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', loadItemDetails);
