// Dynamic text animation
const dynamicTextItems = [
  "AI apps",
  "Terminal apps", 
  "Bots",
  "Servers",
  "Databases",
  "ANYTHING."
];

let currentIndex = 0;
const dynamicTextElement = document.getElementById('dynamicText');

function updateDynamicText() {
  dynamicTextElement.textContent = dynamicTextItems[currentIndex];
  currentIndex = (currentIndex + 1) % dynamicTextItems.length;
}

// Start the animation
setInterval(updateDynamicText, 1500);

// Load featured items from featured.json
async function loadFeaturedItems() {
  try {
    const response = await fetch(Config.featured)
    const featuredItems = await response.json();
    console.log('Loaded featured items:', featuredItems.length);
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
  
  featuredItems.forEach(item => {
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
  
  items.forEach(item => {
    const itemElement = createItemElement(item, 'latest');
    latestContainer.appendChild(itemElement);
  });
}

// Create item element
function createItemElement(item, type) {
  const link = document.createElement('a');
  link.href = `item.html?uri=${encodeURIComponent(item.download)}`;
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

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  renderFeaturedItems();
  fetchAndRenderLatestItems();
});
