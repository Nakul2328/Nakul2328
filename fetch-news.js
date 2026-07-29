const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');

const parser = new Parser();

// Initialize Supabase client using secrets
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Add or replace news feeds you want to collect
const FEEDS = [
  { name: 'TechCrunch', category: 'Tech', url: 'https://techcrunch.com/feed/' },
  { name: 'BBC Technology', category: 'Tech', url: 'http://feeds.bbci.co.uk/news/technology/rss.xml' },
  { name: 'The Verge', category: 'Tech', url: 'https://www.theverge.com/rss/index.xml' }
];

async function fetchAndSaveNews() {
  console.log('Starting automated news update...');

  for (const feed of FEEDS) {
    try {
      console.log(`Reading feed: ${feed.name}`);
      const parsedFeed = await parser.parseURL(feed.url);

      for (const item of parsedFeed.items) {
        if (!item.link || !item.title) continue;

        // Clean up summary snippet
        const rawSummary = item.contentSnippet || item.content || item.summary || '';
        const cleanSummary = rawSummary.replace(/<[^>]*>?/gm, '').trim().slice(0, 400);

        const article = {
          title: item.title,
          summary: cleanSummary ? cleanSummary + '...' : 'No summary provided.',
          category: feed.category,
          source_name: feed.name,
          source_url: item.link,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
        };

        // Upsert into Supabase (duplicates are ignored automatically because source_url is unique)
        const { error } = await supabase
          .from('articles')
          .upsert(article, { onConflict: 'source_url', ignoreDuplicates: true });

        if (error) {
          console.error(`Error saving "${item.title}":`, error.message);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${feed.name}:`, err.message);
    }
  }

  console.log('All feeds processed successfully!');
}

fetchAndSaveNews();
