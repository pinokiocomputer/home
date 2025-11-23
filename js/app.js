// Hero highlight data
const heroHighlightItems = [
  {
    icon: "fa-solid fa-cloud-bolt",
    title: "All-in-One",
    description: "All-in-one environment ready to run any web app or AI server locally with Python, Node.js, Git, Conda, and more built in."
  },
  {
    icon: "fa-solid fa-infinity",
    title: "Universal Interface",
    description: "Browse web UIs, consoles, interactive terminals, and editors from one window."
  },
  {
    icon: "fa-solid fa-server",
    title: "CLI Server",
    description: "Run any CLI app as a web server with tabs, push alerts, remote access, and 1-click launchers."
  },
  {
    icon: "fa-solid fa-database",
    title: "Universal Agent Memory",
    description: "Flat-file logs for every terminal and agent so any AI can recall and collaborate."
  },
  {
    icon: "fa-solid fa-upload",
    title: "Publish to Localhost",
    description: "Package and share apps with auto-generated launchers and 1-click GitHub publish."
  },
  {
    icon: "fa-solid fa-border-all",
    title: "Cell",
    description: "Adaptive container elements that can become anything - AI, terminals, apps, remote machines."
  },
  {
    icon: "fa-solid fa-code-branch",
    title: "1-Click Version Control",
    description: "Jump across versions, commit, and publish to GitHub instantly."
  },
  {
    icon: "fa-solid fa-diagram-project",
    title: "LAN-Wide Web (LWW)",
    description: "Surf every machine on your LAN like the public web with automatic discovery."
  },
  {
    icon: "fa-solid fa-link",
    title: "Instant HTTPS Domains",
    description: "Get fixed .localhost HTTPS URLs for any local app or external server."
  },
  {
    icon: "fa-solid fa-key",
    title: "Login with Localhost",
    description: "Use Hugging Face, GitHub, X.com OAuth inside localhost apps."
  },
  {
    icon: "fa-solid fa-display",
    title: "Background Mode",
    description: "Run Pinokio as a menubar background service and open it in a browser."
  }
];

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function renderHeroHighlights() {
  const container = document.getElementById('heroHighlights');
  if (!container) return;

  heroHighlightItems.forEach(item => {
    const highlight = document.createElement('div');
    highlight.className = 'heroHighlight';

    const heading = document.createElement('div');
    heading.className = 'heroHighlightHeading';

    if (item.icon) {
      const icon = document.createElement('i');
      icon.className = `heroHighlightIcon ${item.icon}`;
      heading.appendChild(icon);
    }

    const title = document.createElement('div');
    title.className = 'heroHighlightTitle';
    title.textContent = item.title;
    heading.appendChild(title);

    const description = document.createElement('div');
    description.className = 'heroHighlightDescription';
    description.textContent = item.description;

    highlight.appendChild(heading);
    highlight.appendChild(description);
    container.appendChild(highlight);
  });
}

// Load featured items from featured.json
async function loadFeaturedItems() {
  try {
    const response = await fetch(Config.featured)
    const featuredItems = await response.json();
    return featuredItems;
  } catch (error) {
    console.error('Error loading featured items:', error);
    return [];
  }
}

// Load blacklist from blacklist.json
async function loadBlacklist() {
  try {
    const response = await fetch(Config.ban);
    const blacklist = await response.json();
    return blacklist;
  } catch (error) {
    console.error('Error loading blacklist:', error);
    return { accounts: [] };
  }
}

// Render featured items
async function renderFeaturedItems() {
  const featuredContainer = document.getElementById('featuredItems');
  featuredContainer.innerHTML = '';
  
  const featuredItems = await loadFeaturedItems();
  allFeaturedItems = featuredItems;
  filteredFeaturedItems = [...featuredItems];
  
  filteredFeaturedItems.forEach(item => {
    const itemElement = createItemElement(item, 'featured');
    featuredContainer.appendChild(itemElement);
  });
}

// Fetch and render latest items from GitHub API
async function fetchAndRenderLatestItems() {
  try {
    const response = await fetch("https://api.github.com/search/repositories?q=topic:pinokio&sort=updated&direction=desc&per_page=100");
    const data = await response.json();
    
    // Load blacklist
    const blacklist = await loadBlacklist();
    
    // Filter out blacklisted accounts
    const filteredItems = data.items.filter(item => {
      const ownerName = item.owner.login.toLowerCase();
      return !blacklist.accounts.map(a => a.toLowerCase()).includes(ownerName);
    });
    
    // Transform GitHub API data to our format
    const latestItems = filteredItems.map(item => ({
      title: item.name,
      description: item.description || "",
      image: item.owner.avatar_url,
      url: item.html_url,
      download: item.html_url
    }));
    renderLatestItems(latestItems);
  } catch (error) {
    console.error('Error fetching latest items:', error);
    // Show error message or fallback content
    document.getElementById('latestItems').innerHTML = '<div class="empty">Unable to load latest items</div>';
  }
}

// Render latest items
function renderLatestItems(items) {
  const latestContainer = document.getElementById('latestItems');
  latestContainer.innerHTML = '';

  allLatestItems = items
  filteredLatestItems = [...items];
  
  items.forEach(item => {
    const itemElement = createItemElement(item, 'latest');
    latestContainer.appendChild(itemElement);
  });
}

// Create item element
function createItemElement(item, type) {
  const link = document.createElement('a');
  if (page === "app") {
    link.href = `app_item.html?uri=${encodeURIComponent(item.download)}&parent_frame=${document.referrer}`;
  } else {
    link.href = `item.html?uri=${encodeURIComponent(item.download)}&parent_frame=${document.referrer}`;
  }
  const theme = document.querySelector("body").getAttribute("data-theme")
  if (theme) {
    link.href += `&theme=${theme}`
  }
  link.className = 'card';
  
  const itemDiv = document.createElement('div');
  itemDiv.className = 'item';
  
  const colDiv = document.createElement('div');
  colDiv.className = 'col';
  
  const titleDiv = document.createElement('div');
  titleDiv.className = 'title';
  titleDiv.textContent = item.title;
  
  const descDiv = document.createElement('div');
  descDiv.className = 'description';
  descDiv.textContent = item.description;
  
  const img = document.createElement('img');
  img.src = item.image;
  img.alt = 'image';
  img.width = type === 'featured' ? 100 : 50;
  img.height = type === 'featured' ? 100 : 50;
  
  colDiv.appendChild(titleDiv);
  colDiv.appendChild(descDiv);
  itemDiv.appendChild(colDiv);
  itemDiv.appendChild(img);
  link.appendChild(itemDiv);
  
  return link;
}

function updateTheme() {
  const theme = getQueryParam('theme');
  if (theme) {
    document.querySelector("body").classList.add(theme)
    document.querySelector("body").setAttribute("data-theme", theme)
  }
}

// Tab selection function
function selectTab(tab) {
  currentTab = tab;
  // Update tab buttons
  document.getElementById('verifiedTab').classList.toggle('selected', tab === 'verified');
  document.getElementById('communityTab').classList.toggle('selected', tab === 'community');
  
  // Update sections
  const verifiedSection = document.getElementById('verifiedSection');
  const communitySection = document.getElementById('communitySection');
  
  if (tab === 'verified') {
    verifiedSection.classList.remove('hidden');
    communitySection.classList.add('hidden');
  } else {
    verifiedSection.classList.add('hidden');
    communitySection.classList.remove('hidden');
  }
  
  // Focus search input for verified tab
  setTimeout(() => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.focus();
  }, 100);
}

// Search function
function searchItems() {
  let selector = (currentTab === "verified" ? "featuredItems" : "latestItems")
  const searchValue = document.getElementById('searchInput').value.trim().toLowerCase();
  const container = document.getElementById(selector)
  
  if (currentTab === "verified") {
    if (!searchValue) {
      filteredFeaturedItems = [...allFeaturedItems];
    } else {
      filteredFeaturedItems = allFeaturedItems.filter(item => {
        return item.title.toLowerCase().includes(searchValue) ||
              item.description.toLowerCase().includes(searchValue) ||
              item.url.toLowerCase().includes(searchValue);
      });
    }
  } else {
    if (!searchValue) {
      filteredLatestItems = [...allLatestItems];
    } else {
      filteredLatestItems = allLatestItems.filter(item => {
        return item.title.toLowerCase().includes(searchValue) ||
              item.description.toLowerCase().includes(searchValue) ||
              item.url.toLowerCase().includes(searchValue);
      });
    }
  }

  if (currentTab === "verified") {
    container.innerHTML = '';
    filteredFeaturedItems.forEach(item => {
      const itemElement = createItemElement(item, 'featured');
      container.appendChild(itemElement);
    });
  } else {
    container.innerHTML = '';
    filteredLatestItems.forEach(item => {
      const itemElement = createItemElement(item, 'latest');
      container.appendChild(itemElement);
    });
    
  }
}

// Toggle download section visibility
function toggleDownloadSection() {
  const downloadSection = document.getElementById('downloadSection');
  const toggleBtn = document.getElementById('toggleDownloadBtn');
  
  if (downloadSection.classList.contains('hidden')) {
    downloadSection.classList.remove('hidden');
    toggleBtn.classList.add('hidden');
    // Focus on the input field
    setTimeout(() => {
      document.getElementById('downloadUrl').focus();
    }, 100);
  } else {
    downloadSection.classList.add('hidden');
    toggleBtn.classList.remove('hidden');
    // Clear the input field
    document.getElementById('downloadUrl').value = '';
  }
}


// Load news/tweets
async function loadNews() {
  try {
    const response = await fetch(Config.news || 'news.json');
    const newsIds = await response.json();
    return newsIds;
  } catch (error) {
    console.error('Error loading news:', error);
    return [];
  }
}

// Render news using Twitter's official widget
async function renderNews() {
  const newsIds = await loadNews();
  const container = document.getElementById('newsContainer');
  if (newsIds.length === 0) {
    const placeholder = '<div class="tweet-placeholder">No news available</div>';
    if (container) container.innerHTML = placeholder;
    return;
  }
  renderTweets(container, newsIds)
  
}

function refreshClone() {
  let git = document.querySelector("#downloadUrl").value
  let branch = document.querySelector("#branch").value
  let app = document.referrer
  let downloadURL
  if (app) {
    if (branch && branch.length > 0) {
      downloadURL = `${app}?mode=download&uri=${git}&branch=${branch}`
    } else {
      downloadURL = `${app}?mode=download&uri=${git}`
    }
  } else {
    if (branch && branch.length > 0) {
      downloadURL = `pinokio://download?uri=${git}&branch=${branch}`
    } else {
      downloadURL = `pinokio://download?uri=${git}`
    }
  }
  document.querySelector("#clone-url").href = downloadURL
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  updateTheme()
  // renderHeroHighlights();
  renderFeaturedItems();
  fetchAndRenderLatestItems();
  renderNews();
  
  // Attach event listeners
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', searchItems);
  }
  const downloadUrlInput = document.querySelector("#downloadUrl");
  const branchInput = document.querySelector("#branch");
  if (downloadUrlInput) {
    downloadUrlInput.addEventListener("input", () => {
      refreshClone()
    })
  }
  if (branchInput) {
    branchInput.addEventListener("input", () => {
      refreshClone()
    })
  }
});
