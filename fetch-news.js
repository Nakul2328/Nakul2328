const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');

const parser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail']
  }
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const FEEDS = [
  { name: 'TechCrunch', category: 'Tech', url: 'https://techcrunch.com/feed/' },
  { name: 'BBC Technology', category: 'Tech', url: 'http://feeds.bbci.co.uk/news/technology/rss.xml' },
  { name: 'The Verge', category: 'Tech', url: 'https://www.theverge.com/rss/index.xml' }
];

function extractImageUrl(item, rawContent) {
  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
    return item['media:content'].$.url;
  }
  if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
    return item['media:thumbnail'].$.url;
  }
  const imgMatch = rawContent.match(/<img [^>]*src=["']([^"']+)["']/);
  if (imgMatch) {
    return imgMatch[1];
  }
  return 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80';
}

async function fetchAndSaveNews() {
  console.log('Starting automated news update...');

  for (const feed of FEEDS) {
    try {
      console.log(`Reading feed: ${feed.name}`);
      const parsedFeed = await parser.parseURL(feed.url);

      for (const item of parsedFeed.items) {
        if (!item.link || !item.title) continue;

        const rawContent = item.content || item.summary || item['content:encoded'] || '';
        const cleanSummary = (item.contentSnippet || rawContent.replace(/<[^>]*>/gm, '')).trim().slice(0, 300);
        const imageUrl = extractImageUrl(item, rawContent);

        const article = {
          title: item.title,
          summary: cleanSummary ? cleanSummary + '...' : 'No summary provided.',
          category: feed.category,
          source_name: feed.name,
          source_url: item.link,
          image_url: imageUrl,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
        };

        await supabase.from('articles').upsert(article, { onConflict: 'source_url' });
      }
    } catch (err) {
      console.error(`Error fetching feed ${feed.name}:`, err.message);
    }
  }
}

fetchAndSaveNews();
