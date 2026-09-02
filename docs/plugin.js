(function () {
  "use strict";

  var THEME_KEY = "pinokio-docs-theme";
  var TARGET_QUERY = "id";
  var bindingsReady = false;
  var scrollRequest = 0;
  var cancelScrollSync = null;
  var sidebarUpdateFrame = 0;
  var openSidebarSection = null;
  var navigationTargetId = null;

  function readStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (error) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // Theme selection still works for this page view when storage is unavailable.
    }
  }

  function updateThemeControl() {
    var button = document.getElementById("docs-theme-toggle");
    if (!button) return;

    var isDark = document.documentElement.dataset.theme === "dark";
    var icon = button.querySelector("i");
    button.setAttribute("aria-label", isDark ? "Use light theme" : "Use dark theme");
    button.setAttribute("aria-pressed", isDark ? "true" : "false");
    if (icon) {
      icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }
  }

  function setTheme(theme, persist) {
    document.documentElement.dataset.theme = theme;
    if (persist) storeTheme(theme);
    updateThemeControl();
  }

  function headingIdFromHash(hash) {
    var queryIndex = hash.indexOf("?");
    if (queryIndex === -1) return null;

    var params = new URLSearchParams(hash.slice(queryIndex + 1));
    return params.get(TARGET_QUERY);
  }

  function requestedHeadingId() {
    return headingIdFromHash(window.location.hash || "");
  }

  function alignRequestedHeading(id) {
    if (!id) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    var heading = document.getElementById(id);
    if (heading) {
      var topbar = document.querySelector(".docs-topbar");
      var topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;
      var targetTop =
        window.scrollY + heading.getBoundingClientRect().top - topbarHeight - 28;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
    }
  }

  function activateSidebarTarget(id) {
    if (!id) return;
    var nav = document.querySelector(".sidebar-nav");
    if (!nav) return;

    var targetLink = Array.prototype.find.call(
      nav.querySelectorAll("a.section-link"),
      function (link) {
        return headingIdFromHash(link.hash || "") === id;
      }
    );
    if (!targetLink) return;

    nav.querySelectorAll("li.active").forEach(function (item) {
      item.classList.remove("active");
    });
    var targetItem = targetLink.closest("li");
    if (targetItem) targetItem.classList.add("active");
    updateSidebarDisclosure();
  }

  function stabilizeRequestedScroll() {
    var request = ++scrollRequest;
    var id = requestedHeadingId();

    if (cancelScrollSync) {
      cancelScrollSync();
      cancelScrollSync = null;
    }

    if (!id) {
      alignRequestedHeading(null);
      return;
    }

    var heading = document.getElementById(id);
    var article = document.querySelector(".markdown-section");
    if (!heading || !article) return;

    navigationTargetId = id;
    var stopped = false;
    var quietTimer = 0;
    var deadlineTimer = 0;
    var observer = null;

    function finish() {
      if (stopped) return;
      stopped = true;
      if (cancelScrollSync === finish) cancelScrollSync = null;
      window.clearTimeout(quietTimer);
      window.clearTimeout(deadlineTimer);
      if (observer) observer.disconnect();
      if (request === scrollRequest) {
        alignRequestedHeading(id);
        activateSidebarTarget(id);
        navigationTargetId = null;
        window.requestAnimationFrame(scheduleSidebarDisclosure);
      }
    }

    function align() {
      if (stopped || request !== scrollRequest) return;
      alignRequestedHeading(id);
      activateSidebarTarget(id);
      window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(finish, 900);
    }

    cancelScrollSync = finish;
    align();

    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(align);
      observer.observe(article);
    }

    deadlineTimer = window.setTimeout(finish, 4000);
  }

  function scheduleRequestedScroll() {
    window.requestAnimationFrame(function () {
      window.setTimeout(stabilizeRequestedScroll, 40);
    });
  }

  function updateTableScrollState() {
    document.querySelectorAll(".docs-table-scroll").forEach(function (wrapper) {
      var isScrollable = wrapper.scrollWidth > wrapper.clientWidth + 1;
      if (isScrollable) {
        wrapper.setAttribute("tabindex", "0");
        wrapper.setAttribute("role", "region");
        wrapper.setAttribute("aria-label", "Scrollable table");
      } else {
        wrapper.removeAttribute("tabindex");
        wrapper.removeAttribute("role");
        wrapper.removeAttribute("aria-label");
      }
    });
  }

  function addMediaLoadingHints(html) {
    var template = document.createElement("template");
    template.innerHTML = html;

    var images = template.content.querySelectorAll("img");
    images.forEach(function (image, index) {
      image.setAttribute("decoding", "async");
      if (index === 0) {
        image.setAttribute("fetchpriority", "high");
      } else {
        image.setAttribute("loading", "lazy");
      }
    });

    template.content.querySelectorAll("video").forEach(function (video) {
      var docsPoster = video.getAttribute("data-docs-poster");
      if (docsPoster) video.setAttribute("poster", docsPoster);
      if (!video.hasAttribute("preload")) {
        video.setAttribute("preload", "metadata");
      }
    });

    template.content.querySelectorAll("source[data-docs-src]").forEach(function (source) {
      source.setAttribute("src", source.getAttribute("data-docs-src"));
    });

    return template.innerHTML;
  }

  function wrapCodeBlocks() {
    document.querySelectorAll(".markdown-section pre").forEach(function (pre) {
      if (pre.parentElement && pre.parentElement.classList.contains("code-block-wrapper")) {
        return;
      }

      var code = pre.querySelector("code");
      if (!code) return;

      var wrapper = document.createElement("div");
      wrapper.className = "code-block-wrapper";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      var button = document.createElement("button");
      button.type = "button";
      button.className = "code-copy-button";
      button.setAttribute("aria-label", "Copy code");
      button.innerHTML =
        '<i class="fa-regular fa-copy" aria-hidden="true"></i>' +
        '<span>Copy</span>';
      wrapper.appendChild(button);
    });
  }

  function headingAtOrBefore(selector, threshold) {
    var headings = document.querySelectorAll(selector);
    if (!headings.length) return null;

    var low = 0;
    var high = headings.length - 1;
    var match = headings[0];
    while (low <= high) {
      var middle = Math.floor((low + high) / 2);
      var heading = headings[middle];
      if (heading.getBoundingClientRect().top <= threshold) {
        match = heading;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return match;
  }

  function updateSidebarDisclosure() {
    sidebarUpdateFrame = 0;
    var nav = document.querySelector(".sidebar-nav");
    if (!nav) return;

    var sectionLists = nav.querySelectorAll(".docs-nav-section-list");
    var subsectionLists = nav.querySelectorAll(".docs-nav-subsection-list");
    var topbar = document.querySelector(".docs-topbar");
    var sectionThreshold = (topbar ? topbar.getBoundingClientRect().height : 0) + 40;
    var currentHeading = headingAtOrBefore(
      ".markdown-section h1, .markdown-section h2, .markdown-section h3, .markdown-section h4",
      sectionThreshold
    );
    var currentSection = headingAtOrBefore(
      ".markdown-section h1",
      sectionThreshold
    );
    var currentHeadingId = currentHeading && currentHeading.id;
    var currentSectionId = currentSection && currentSection.id;

    var effectiveHeadingId = navigationTargetId || currentHeadingId;
    var currentLink = Array.prototype.find.call(
      nav.querySelectorAll("a.section-link"),
      function (link) {
        return headingIdFromHash(link.hash || "") === effectiveHeadingId;
      }
    );
    var activeItem = currentLink && currentLink.closest("li");
    var previousActiveItems = nav.querySelectorAll("li.active");
    previousActiveItems.forEach(function (item) {
      if (item !== activeItem) item.classList.remove("active");
    });
    if (activeItem && !activeItem.classList.contains("active")) {
      activeItem.classList.add("active");
    }
    var previousCurrentLink = nav.querySelector('a[aria-current="location"]');
    if (previousCurrentLink !== currentLink) {
      if (previousCurrentLink) previousCurrentLink.removeAttribute("aria-current");
      if (currentLink) currentLink.setAttribute("aria-current", "location");
    }

    var currentSectionItem = null;
    if (navigationTargetId && currentLink) {
      currentSectionItem = currentLink.closest(".docs-nav-section");
      if (!currentSectionItem) {
        var targetSectionList = currentLink.closest(".docs-nav-section-list");
        if (targetSectionList) {
          currentSectionItem = targetSectionList.previousElementSibling;
        }
      }
    }
    if (!currentSectionItem) {
      currentSectionItem = Array.prototype.find.call(
        nav.querySelectorAll(".docs-nav-section"),
        function (item) {
          var link = item.querySelector(":scope > a.section-link");
          return link && headingIdFromHash(link.hash || "") === currentSectionId;
        }
      );
    }
    var activeSection = currentSectionItem && currentSectionItem.nextElementSibling;
    if (!activeSection) activeSection = sectionLists[0] || null;

    var previousSectionItem = nav.querySelector(".docs-nav-section.is-current-section");
    if (previousSectionItem !== currentSectionItem) {
      if (previousSectionItem) {
        previousSectionItem.classList.remove("is-current-section");
      }
      if (currentSectionItem) {
        currentSectionItem.classList.add("is-current-section");
      }
    }

    sectionLists.forEach(function (list) {
      var shouldHide = list !== activeSection;
      if (list.hidden !== shouldHide) list.hidden = shouldHide;
    });

    var activeItemSection = activeItem && activeItem.closest(".docs-nav-section-list");
    var activeSubsection = activeItem && activeItem.closest(".docs-nav-subsection-list");
    if (activeItem && activeItemSection !== activeSection) {
      activeSubsection = null;
    }
    if (
      !activeSubsection &&
      activeItem &&
      activeItemSection === activeSection &&
      activeItem.classList.contains("docs-nav-subsection") &&
      activeItem.nextElementSibling &&
      activeItem.nextElementSibling.classList.contains("docs-nav-subsection-list")
    ) {
      activeSubsection = activeItem.nextElementSibling;
    }

    subsectionLists.forEach(function (list) {
      var shouldHide = list !== activeSubsection;
      if (list.hidden !== shouldHide) list.hidden = shouldHide;
    });

    var nextOpenSection = activeSection && activeSection.dataset.sectionId;
    var itemToReveal = currentSectionItem || activeItem;
    if (nextOpenSection && nextOpenSection !== openSidebarSection) {
      openSidebarSection = nextOpenSection;
      if (navigationTargetId || !itemToReveal) return;
      window.requestAnimationFrame(function () {
        var sidebar = document.querySelector(".sidebar");
        if (!sidebar || !itemToReveal.isConnected) return;
        var itemRect = itemToReveal.getBoundingClientRect();
        var sidebarRect = sidebar.getBoundingClientRect();
        if (itemRect.top < sidebarRect.top + 120) {
          sidebar.scrollTop += itemRect.top - sidebarRect.top - 120;
        } else if (itemRect.bottom > sidebarRect.bottom - 24) {
          sidebar.scrollTop += itemRect.bottom - sidebarRect.bottom + 24;
        }
      });
    }
  }

  function scheduleSidebarDisclosure() {
    if (sidebarUpdateFrame) return;
    sidebarUpdateFrame = window.requestAnimationFrame(updateSidebarDisclosure);
  }

  function organizeSidebarNavigation() {
    var nav = document.querySelector(".sidebar-nav");
    var rootList = nav && nav.querySelector(":scope > ul");
    if (!rootList) return;

    rootList.classList.add("docs-nav-root");
    Array.prototype.forEach.call(rootList.children, function (child) {
      if (child.tagName !== "LI") return;
      var link = child.querySelector(":scope > a.section-link");
      if (!link) return;
      var id = headingIdFromHash(link.hash || "");
      var heading = id && document.getElementById(id);
      if (!heading || heading.tagName !== "H1") return;

      child.classList.add("docs-nav-section");
      var sectionList = child.nextElementSibling;
      if (!sectionList || sectionList.tagName !== "UL") return;
      sectionList.classList.add("docs-nav-section-list");
      sectionList.dataset.sectionId = id;

      Array.prototype.forEach.call(sectionList.children, function (sectionChild) {
        if (sectionChild.tagName !== "LI") return;
        var sectionLink = sectionChild.querySelector(":scope > a.section-link");
        if (!sectionLink) return;
        var sectionHeadingId = headingIdFromHash(sectionLink.hash || "");
        var sectionHeading = sectionHeadingId && document.getElementById(sectionHeadingId);
        if (!sectionHeading || sectionHeading.tagName !== "H2") return;

        sectionChild.classList.add("docs-nav-subsection");
        var subsectionList = sectionChild.nextElementSibling;
        if (!subsectionList || subsectionList.tagName !== "UL") return;
        subsectionList.classList.add("docs-nav-subsection-list");
        subsectionList.dataset.subsectionId = sectionHeadingId;
      });
    });

    updateSidebarDisclosure();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand("copy");
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        textarea.remove();
      }
    });
  }

  function enhanceRenderedPage() {
    var article = document.querySelector(".markdown-section");
    if (article) {
      article.id = "main-content";
      article.setAttribute("tabindex", "-1");
    }

    var sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      sidebar.setAttribute("aria-label", "Manual navigation");
    }

    var searchInput = document.querySelector(".sidebar .search input");
    if (searchInput) {
      searchInput.setAttribute("aria-label", "Search the Pinokio manual");
      searchInput.setAttribute("autocomplete", "off");
      searchInput.setAttribute("spellcheck", "false");
    }

    document.querySelectorAll('a[target="_blank"]').forEach(function (link) {
      link.setAttribute("rel", "noopener");
    });

    var companionPages = window.PINOKIO_DOC_COMPANION_PAGES || {};
    document.querySelectorAll(".markdown-section a[href], .sidebar a[href]").forEach(function (link) {
      var explicitRoute = link.getAttribute("data-docs-route");
      if (explicitRoute && companionPages[explicitRoute]) {
        link.setAttribute("href", companionPages[explicitRoute]);
        return;
      }

      if (link.classList.contains("docs-manual-back-link")) {
        var manualHref = link.getAttribute("data-docs-href");
        if (manualHref) link.setAttribute("href", manualHref);
        return;
      }

      var href = link.getAttribute("href") || "";
      var hashStart = href.indexOf("#/");
      if (hashStart < 0) return;

      var hashRoute = href.slice(hashStart + 1);
      var route = hashRoute.split("?")[0];
      var cleanUrl = companionPages[route];
      if (cleanUrl) {
        var query = hashRoute.indexOf("?") >= 0
          ? hashRoute.slice(hashRoute.indexOf("?") + 1)
          : "";
        link.setAttribute("href", cleanUrl + (query ? "#/?" + query : ""));
      }
    });

    var cleanCompanionUrl = Object.keys(companionPages).map(function (route) {
      return companionPages[route];
    }).find(function (cleanUrl) {
      return new URL(cleanUrl, window.location.origin).pathname === window.location.pathname;
    });
    if (cleanCompanionUrl && window.location.hash === "#/") {
      window.history.replaceState(window.history.state, "", cleanCompanionUrl);
    }

    document.querySelectorAll(".markdown-section p").forEach(function (paragraph) {
      if (paragraph.children.length !== 1 || paragraph.textContent.trim()) return;

      var child = paragraph.firstElementChild;
      var media = child && child.matches("img, video")
        ? child
        : child && child.matches("a") && child.children.length === 1
          ? child.firstElementChild
          : null;

      if (media && media.matches("img, video")) {
        paragraph.classList.add("docs-media-block");
      }
    });

    document.querySelectorAll(".markdown-section table").forEach(function (table) {
      if (table.parentElement.classList.contains("docs-table-scroll")) return;

      var wrapper = document.createElement("div");
      wrapper.className = "docs-table-scroll";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    window.requestAnimationFrame(updateTableScrollState);

    wrapCodeBlocks();
    organizeSidebarNavigation();

  }

  function bindPersistentControls() {
    if (bindingsReady) return;
    bindingsReady = true;

    var themeButton = document.getElementById("docs-theme-toggle");
    if (themeButton) {
      themeButton.addEventListener("click", function () {
        var nextTheme =
          document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        setTheme(nextTheme, true);
      });
    }
    updateThemeControl();

    if (window.matchMedia) {
      var colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
      var handleColorSchemeChange = function (event) {
        if (!readStoredTheme()) {
          setTheme(event.matches ? "dark" : "light", false);
        }
      };
      if (colorScheme.addEventListener) {
        colorScheme.addEventListener("change", handleColorSchemeChange);
      } else if (colorScheme.addListener) {
        colorScheme.addListener(handleColorSchemeChange);
      }
    }

    document.addEventListener("click", function (event) {
      var requestedLink = event.target.closest(".sidebar a.section-link");
      var requestedId =
        requestedLink && headingIdFromHash(requestedLink.hash || "");
      if (requestedId) {
        navigationTargetId = requestedId;
        activateSidebarTarget(requestedId);
      }
    }, true);

    document.addEventListener("click", function (event) {
      var copyButton = event.target.closest(".code-copy-button");
      if (copyButton) {
        var wrapper = copyButton.closest(".code-block-wrapper");
        var code = wrapper && wrapper.querySelector("code");
        if (!code) return;

        copyText(code.innerText).then(function () {
          var label = copyButton.querySelector("span");
          var icon = copyButton.querySelector("i");
          copyButton.classList.add("is-copied");
          copyButton.setAttribute("aria-label", "Code copied");
          if (label) label.textContent = "Copied";
          if (icon) icon.className = "fa-solid fa-check";

          window.setTimeout(function () {
            copyButton.classList.remove("is-copied");
            copyButton.setAttribute("aria-label", "Copy code");
            if (label) label.textContent = "Copy";
            if (icon) icon.className = "fa-regular fa-copy";
          }, 1800);
        });
        return;
      }

      var sidebarLink = event.target.closest(".sidebar a.section-link");
      if (sidebarLink && window.innerWidth <= 768) {
        window.setTimeout(function () {
          document.body.classList.remove("close");
        }, 40);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.target.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      var input = document.querySelector(".sidebar .search input");
      if (input) {
        event.preventDefault();
        if (window.innerWidth <= 768) {
          document.body.classList.add("close");
        }
        input.focus();
      }
    });

    var toTop = document.getElementById("docs-to-top");
    if (toTop) {
      var updateToTop = function () {
        toTop.hidden = window.scrollY < 720;
      };
      toTop.addEventListener("click", function () {
        var reducedMotion =
          window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({
          top: 0,
          behavior: reducedMotion ? "auto" : "smooth"
        });
      });
      window.addEventListener("scroll", updateToTop, { passive: true });
      window.addEventListener("scroll", scheduleSidebarDisclosure, { passive: true });
      updateToTop();
    }

    window.addEventListener("hashchange", function () {
      scheduleRequestedScroll();
    });
    window.addEventListener("resize", updateTableScrollState, { passive: true });
  }

  function createPlugin() {
    return function (hook) {
      hook.afterEach(function (html, next) {
        next(addMediaLoadingHints(html));
      });

      hook.doneEach(function () {
        bindPersistentControls();
        enhanceRenderedPage();
        scheduleRequestedScroll();
      });
    };
  }

  if (typeof window.$docsify === "object") {
    window.$docsify.plugins = []
      .concat(createPlugin(), window.$docsify.plugins || []);
  }
})();
