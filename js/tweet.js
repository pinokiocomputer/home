var _currentPosts
var masonryContainer
var columns
var columnCount
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
    if (_currentPosts.length > 0) {
        tweetsContainer.innerHTML = `
            <div class="masonry-container">
                ${_currentPosts.map(tweetId => `
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

function loadTweets() {
  // Initialize masonry layout
  initMasonryColumns();
  loadTwitterWidget(() => {
      console.log('Loading', _currentPosts.length, 'tweets with sliding window (max 10 concurrent)');
      
      // Create all tweet containers first
      const tweetElements = _currentPosts.map(tweetId => {
          const tweetDiv = document.createElement('div');
          tweetDiv.className = 'tweet-item';
          tweetDiv.innerHTML = `
              <div class="loading-spinner">
                  <div class="spinner"></div>
                  <div class="loading-text">Loading...</div>
              </div>
          `;
//          tweetDiv.style.width = '300px';
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
          //loadNextTweet();
      }
      
      // Start the sliding window
      loadNextTweet();
  });
}

function addToMasonry(tweetElement) {
  console.log("addToMasonry", columnCount)
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
function initMasonryColumns() {
    const containerWidth = masonryContainer.offsetWidth;
    columnCount = Math.floor(containerWidth / 300); // 350px + 2px gap
    columns = Array(columnCount).fill(0); // Track height of each column
    
    // Clear and setup columns
    masonryContainer.innerHTML = '';
    for (let i = 0; i < columnCount; i++) {
        const column = document.createElement('div');
        column.className = 'masonry-column';
        column.style.cssText = `
            width: 300px;
            margin-right: ${i < columnCount - 1 ? '5px' : '0'};
            display: inline-block;
            vertical-align: top;
        `;
        masonryContainer.appendChild(column);
    }
}
        
// Render tweets using Twitter's embedded tweet widget
function renderTweets(el, posts) {
    _currentPosts = posts
    const tweetsContainer = el
    if (_currentPosts.length > 0) {
        // Clear container first
        tweetsContainer.innerHTML = '<div class="masonry-container"></div>';
        masonryContainer = tweetsContainer.querySelector('.masonry-container');
        // Initialize masonry layout variables
        columns = []
        columnCount = 0
        loadTweets()
    } else {
        tweetsContainer.innerHTML = `
            <div class="empty">
                Feed is Empty. Create a pinokio_meta.json file and add X.com links to the posts array, and the posts will show up here.
            </div>
        `;
    }
}
