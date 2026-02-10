const axios = require('axios');
const Parser = require('rss-parser');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');

const parser = new Parser();
const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache

const WAYLAND_POST_URL = 'https://www.waylandpost.org';
const WESTON_OBSERVER_URL = 'https://westonobserver.org';

/**
 * Check if article should be excluded (obituaries, newsletters, print editions)
 */
function shouldExcludeArticle(article) {
  const title = (article.headline || '').toLowerCase();
  const category = (article.category || '').toLowerCase();
  const url = (article.url || '').toLowerCase();
  const text = `${title} ${category} ${url}`;
  
  // Obituary keywords
  const obituaryKeywords = [
    'obituary', 'died', 'passed away', 'death', 'memorial', 'funeral',
    'remembering', 'in memory', 'in memoriam'
  ];
  
  // Newsletter/print edition keywords
  const excludedKeywords = [
    'newsletter', 'print edition', 'print issue', 'subscribe',
    'sign up', 'epaper', 'e-paper', 'digital edition'
  ];
  
  // Check for obituaries
  for (const keyword of obituaryKeywords) {
    if (text.includes(keyword)) {
      return true;
    }
  }
  
  // Check for newsletters/print editions
  for (const keyword of excludedKeywords) {
    if (text.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get priority score for article (1 = highest, 3 = lowest)
 */
function getPriority(article) {
  const title = (article.headline || '').toLowerCase();
  const category = (article.category || '').toLowerCase();
  const content = (article.content || '').toLowerCase();
  const categories = (article.categories || []).map(c => c.toLowerCase()).join(' ');
  const text = `${title} ${category} ${categories} ${content}`;
  
  // Priority 1: Weather, environment, public safety, public awareness
  const priority1Keywords = [
    'weather', 'storm', 'snow', 'rain', 'flood', 'environment', 'climate',
    'safety', 'police', 'fire', 'emergency', 'alert', 'warning', 'evacuation',
    'power outage', 'road closure', 'traffic', 'accident', 'crash', 'hazard',
    'advisory', 'watch', 'warning', 'severe weather', 'extreme weather'
  ];
  
  // Priority 2: Events, schools, community
  const priority2Keywords = [
    'event', 'school', 'community', 'festival', 'meeting', 'concert',
    'library', 'park', 'recreation', 'sports', 'athletic', 'program',
    'workshop', 'class', 'education'
  ];
  
  // Priority 3: Politics, taxes, budget
  const priority3Keywords = [
    'tax', 'budget', 'election', 'vote', 'political', 'town meeting',
    'select board', 'zoning', 'development', 'planning board', 'finance',
    'appropriation', 'warrant', 'article'
  ];
  
  for (const keyword of priority1Keywords) {
    if (text.includes(keyword)) return 1;
  }
  
  for (const keyword of priority3Keywords) {
    if (text.includes(keyword)) return 3;
  }
  
  for (const keyword of priority2Keywords) {
    if (text.includes(keyword)) return 2;
  }
  
  return 2; // default to secondary priority
}

/**
 * Fetch featured image from article page
 */
async function fetchArticleImage(articleUrl) {
  try {
    const response = await axios.get(articleUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TempestWeather/1.0)'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Try multiple image sources in order of preference
    let img = $('meta[property="og:image"]').attr('content') ||
              $('meta[name="twitter:image"]').attr('content') ||
              $('.wp-post-image').attr('src') ||
              $('.featured-image img').attr('src') ||
              $('article img').first().attr('src') ||
              $('.entry-content img').first().attr('src');
    
    if (img) {
      return img.startsWith('http') ? img : null;
    }
    return null;
  } catch (error) {
    // Silently fail - image fetching is optional
    return null;
  }
}

/**
 * Fetch articles from Wayland Post RSS feed
 */
async function fetchWaylandPostRSS() {
  try {
    const feed = await parser.parseURL(`${WAYLAND_POST_URL}/feed`);
    const articles = [];
    
    for (const item of feed.items.slice(0, 30)) {
      // Extract categories - RSS feeds may have categories array or single category
      const categories = Array.isArray(item.categories) ? item.categories : (item.categories ? [item.categories] : []);
      const category = categories[0] || item.category || '';
      
      // Extract content snippet for better filtering
      const content = (item.contentSnippet || item.content || item.description || '').toLowerCase();
      
      // Extract image from multiple sources
      let imageUrl = null;
      if (item.enclosure?.url) imageUrl = item.enclosure.url;
      else if (item['media:content']?.['$']?.url) imageUrl = item['media:content']['$'].url;
      else if (item.itunes?.image) imageUrl = item.itunes.image;
      else if (item.content) {
        // Try to extract image from HTML content
        const $ = cheerio.load(item.content);
        const img = $('img').first().attr('src');
        if (img) imageUrl = img.startsWith('http') ? img : `${WAYLAND_POST_URL}${img}`;
      }
      
      // If no image found, try fetching from article page (only for first few articles to avoid rate limiting)
      if (!imageUrl && item.link && articles.length < 10) {
        imageUrl = await fetchArticleImage(item.link);
      }
      
      // Parse timestamp more robustly
      let timestamp = Date.now() / 1000;
      if (item.isoDate) {
        // isoDate is usually more reliable (ISO 8601 format)
        const parsed = new Date(item.isoDate);
        if (!isNaN(parsed.getTime())) {
          timestamp = parsed.getTime() / 1000;
        }
      } else if (item.pubDate) {
        // Try parsing pubDate (RSS format like "Mon, 23 Jan 2026 12:00:00 +0000")
        const parsed = new Date(item.pubDate);
        if (!isNaN(parsed.getTime())) {
          timestamp = parsed.getTime() / 1000;
        }
      }
      
      articles.push({
        headline: item.title || '',
        url: item.link || '',
        timestamp: timestamp,
        imageUrl: imageUrl,
        category: category,
        categories: categories,
        content: content,
        source: 'Wayland Post'
      });
    }
    
    return articles;
  } catch (error) {
    console.error('Wayland Post RSS fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch articles from Wayland Post via HTML scraping
 */
async function fetchWaylandPostHTML() {
  try {
    const response = await axios.get(WAYLAND_POST_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TempestWeather/1.0)'
      }
    });
    
    const $ = cheerio.load(response.data);
    const articles = [];
    
    // Try to find article links on homepage
    $('article, .post, .entry').slice(0, 20).each((i, elem) => {
      const $elem = $(elem);
      const title = $elem.find('h2 a, h3 a, .entry-title a').first().text().trim();
      const link = $elem.find('h2 a, h3 a, .entry-title a').first().attr('href');
      
      // Try multiple image sources
      let img = $elem.find('img').first().attr('src') || 
                $elem.find('img').first().attr('data-src') ||
                $elem.find('img').first().attr('data-lazy-src') ||
                $elem.find('.wp-post-image').attr('src') ||
                $elem.find('[style*="background-image"]').attr('style')?.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1];
      
      const dateText = $elem.find('.date, .published, time, .entry-date').first().text().trim() ||
                       $elem.find('time').attr('datetime') ||
                       $elem.find('[datetime]').attr('datetime');
      
      if (title && link) {
        let timestamp = Date.now() / 1000;
        if (dateText) {
          // Try parsing as ISO date first, then as text
          const date = new Date(dateText);
          if (!isNaN(date.getTime())) {
            timestamp = date.getTime() / 1000;
          }
        }
        
        // Normalize image URL
        let imageUrl = null;
        if (img) {
          imageUrl = img.startsWith('http') ? img : `${WAYLAND_POST_URL}${img}`;
        }
        
        articles.push({
          headline: title,
          url: link.startsWith('http') ? link : `${WAYLAND_POST_URL}${link}`,
          timestamp,
          imageUrl: imageUrl,
          category: '',
          categories: [],
          content: '',
          source: 'Wayland Post'
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error('Wayland Post HTML fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch articles from Weston Observer RSS feed
 */
async function fetchWestonObserverRSS() {
  try {
    const feed = await parser.parseURL(`${WESTON_OBSERVER_URL}/feed`);
    const articles = [];
    
    for (const item of feed.items.slice(0, 30)) {
      // Extract categories
      const categories = Array.isArray(item.categories) ? item.categories : (item.categories ? [item.categories] : []);
      const category = categories[0] || item.category || '';
      
      // Extract content snippet for better filtering
      const content = (item.contentSnippet || item.content || item.description || '').toLowerCase();
      
      // Extract image from multiple sources
      let imageUrl = null;
      if (item.enclosure?.url) imageUrl = item.enclosure.url;
      else if (item['media:content']?.['$']?.url) imageUrl = item['media:content']['$'].url;
      else if (item.itunes?.image) imageUrl = item.itunes.image;
      else if (item.content) {
        // Try to extract image from HTML content
        const $ = cheerio.load(item.content);
        const img = $('img').first().attr('src');
        if (img) imageUrl = img.startsWith('http') ? img : `${WESTON_OBSERVER_URL}${img}`;
      }
      
      // If no image found, try fetching from article page (only for first few articles to avoid rate limiting)
      if (!imageUrl && item.link && articles.length < 10) {
        imageUrl = await fetchArticleImage(item.link);
      }
      
      // Parse timestamp more robustly
      let timestamp = Date.now() / 1000;
      if (item.isoDate) {
        // isoDate is usually more reliable (ISO 8601 format)
        const parsed = new Date(item.isoDate);
        if (!isNaN(parsed.getTime())) {
          timestamp = parsed.getTime() / 1000;
        }
      } else if (item.pubDate) {
        // Try parsing pubDate (RSS format like "Mon, 23 Jan 2026 12:00:00 +0000")
        const parsed = new Date(item.pubDate);
        if (!isNaN(parsed.getTime())) {
          timestamp = parsed.getTime() / 1000;
        }
      }
      
      articles.push({
        headline: item.title || '',
        url: item.link || '',
        timestamp: timestamp,
        imageUrl: imageUrl,
        category: category,
        categories: categories,
        content: content,
        source: 'Weston Observer'
      });
    }
    
    return articles;
  } catch (error) {
    console.error('Weston Observer RSS fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch articles from Weston Observer via HTML scraping
 */
async function fetchWestonObserverHTML() {
  try {
    const response = await axios.get(WESTON_OBSERVER_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TempestWeather/1.0)'
      }
    });
    
    const $ = cheerio.load(response.data);
    const articles = [];
    
    // Try to find article links on homepage
    $('article, .post, .entry, .news-item').slice(0, 20).each((i, elem) => {
      const $elem = $(elem);
      const title = $elem.find('h2 a, h3 a, .entry-title a, .title a').first().text().trim();
      const link = $elem.find('h2 a, h3 a, .entry-title a, .title a').first().attr('href');
      
      // Try multiple image sources
      let img = $elem.find('img').first().attr('src') || 
                $elem.find('img').first().attr('data-src') ||
                $elem.find('img').first().attr('data-lazy-src') ||
                $elem.find('.wp-post-image').attr('src') ||
                $elem.find('[style*="background-image"]').attr('style')?.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1];
      
      const dateText = $elem.find('.date, .published, time, .meta, .entry-date').first().text().trim() ||
                       $elem.find('time').attr('datetime') ||
                       $elem.find('[datetime]').attr('datetime');
      
      if (title && link) {
        let timestamp = Date.now() / 1000;
        if (dateText) {
          // Try parsing as ISO date first, then as text
          const date = new Date(dateText);
          if (!isNaN(date.getTime())) {
            timestamp = date.getTime() / 1000;
          }
        }
        
        // Normalize image URL
        let imageUrl = null;
        if (img) {
          imageUrl = img.startsWith('http') ? img : `${WESTON_OBSERVER_URL}${img}`;
        }
        
        articles.push({
          headline: title,
          url: link.startsWith('http') ? link : `${WESTON_OBSERVER_URL}${link}`,
          timestamp,
          imageUrl: imageUrl,
          category: '',
          categories: [],
          content: '',
          source: 'Weston Observer'
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error('Weston Observer HTML fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch articles from a source (RSS preferred, HTML fallback)
 */
async function fetchSource(sourceName, rssFn, htmlFn) {
  try {
    const rssArticles = await rssFn();
    if (rssArticles.length > 0) {
      return rssArticles;
    }
    return await htmlFn();
  } catch (error) {
    console.error(`${sourceName} fetch error:`, error.message);
    return [];
  }
}

/**
 * Intersperse articles from two sources
 */
function intersperseArticles(articles1, articles2) {
  const result = [];
  const maxLength = Math.max(articles1.length, articles2.length);
  
  for (let i = 0; i < maxLength; i++) {
    if (i < articles1.length) {
      result.push(articles1[i]);
    }
    if (i < articles2.length) {
      result.push(articles2[i]);
    }
  }
  
  return result;
}

/**
 * Get prioritized and filtered news articles
 */
async function getNewsArticles(skipCache = false) {
  const cacheKey = 'news_articles';
  
  // Check cache first
  if (!skipCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }
  
  try {
    // Fetch from both sources in parallel
    const [waylandArticles, westonArticles] = await Promise.all([
      fetchSource('Wayland Post', fetchWaylandPostRSS, fetchWaylandPostHTML),
      fetchSource('Weston Observer', fetchWestonObserverRSS, fetchWestonObserverHTML)
    ]);
    
    // Filter out obituaries, newsletters, and print editions
    const filteredWayland = waylandArticles.filter(article => !shouldExcludeArticle(article));
    const filteredWeston = westonArticles.filter(article => !shouldExcludeArticle(article));
    
    // Add priority scores
    filteredWayland.forEach(article => {
      article.priority = getPriority(article);
    });
    filteredWeston.forEach(article => {
      article.priority = getPriority(article);
    });
    
    // Sort by priority (1 = highest), then by timestamp (newest first)
    filteredWayland.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.timestamp - a.timestamp;
    });
    
    filteredWeston.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.timestamp - a.timestamp;
    });
    
    // Intersperse articles from both sources
    const interspersed = intersperseArticles(filteredWayland, filteredWeston);
    
    // Limit to top 20 articles
    const result = interspersed.slice(0, 20);
    
    // Cache the result
    cache.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching news articles:', error);
    // Return cached data if available, even if stale
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    return [];
  }
}

module.exports = {
  getNewsArticles
};
