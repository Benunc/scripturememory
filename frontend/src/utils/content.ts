// Content management utilities for blog posts, changelog, and landing pages
import matter from 'gray-matter';

// Extend ImportMeta interface for Vite's glob functionality
declare global {
  interface ImportMeta {
    glob(pattern: string, options?: { 
      as?: string; 
      eager?: boolean;
      query?: string;
      import?: string;
    }): Record<string, any>;
  }
}

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  author: string;
  tags: string[];
  excerpt: string;
  content: string;
  readingTime?: number;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  features: string[];
  fixes: string[];
  content: string;
}

export interface LandingPage {
  slug: string;
  title: string;
  description: string;
  cta: string;
  content: string;
}

// Function to read blog posts from markdown files
async function loadBlogPosts(): Promise<BlogPost[]> {
  const posts: BlogPost[] = [];
  
  try {
    // Import markdown files at build time
    const blogFiles = import.meta.glob('../content/blog/*.md', { 
      query: '?raw',
      import: 'default',
      eager: true 
    });
    
    console.log('Found blog files:', Object.keys(blogFiles));
    
    for (const path in blogFiles) {
      console.log('Loading blog file:', path);
      const file = blogFiles[path];
      console.log('File type:', typeof file);
      console.log('File:', file);
      
      // Get the content directly (should be raw string with as: 'raw')
      const content = file as string;
      
      if (typeof content !== 'string') {
        console.error('Expected string content, got:', typeof content);
        continue;
      }
      
      console.log('Raw content:', content.substring(0, 200));
      
      const slug = path.replace('../content/blog/', '').replace('.md', '');
      
      // Simple frontmatter parser for browser compatibility
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      let data: any = {};
      let markdownContent = content;
      
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        markdownContent = frontmatterMatch[2];
        
        // Parse YAML frontmatter
        const lines = frontmatter.split('\n');
        let currentKey = '';
        let currentValue = '';
        let inArray = false;
        let arrayItems: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const colonIndex = line.indexOf(':');
          
          if (colonIndex > 0) {
            // Save previous key-value pair
            if (currentKey && currentValue) {
              if (inArray) {
                data[currentKey] = arrayItems;
                arrayItems = [];
                inArray = false;
              } else {
                data[currentKey] = currentValue;
              }
            }
            
            // Start new key-value pair
            currentKey = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            
            // Check if this starts an array
            if (value.startsWith('[')) {
              inArray = true;
              arrayItems = [];
              // Check if it's a single-line array
              if (value.endsWith(']')) {
                const arrayContent = value.slice(1, -1);
                if (arrayContent.trim()) {
                  data[currentKey] = arrayContent.split(',').map(v => v.trim().replace(/"/g, '').replace(/'/g, ''));
                } else {
                  data[currentKey] = [];
                }
                inArray = false;
                currentKey = '';
                currentValue = '';
              }
            } else {
              currentValue = value;
            }
          } else if (inArray && line.trim().startsWith('-')) {
            // Array item
            const item = line.trim().substring(1).trim();
            arrayItems.push(item.replace(/"/g, '').replace(/'/g, ''));
          } else if (inArray && line.trim() === ']') {
            // End of array
            data[currentKey] = arrayItems;
            arrayItems = [];
            inArray = false;
            currentKey = '';
            currentValue = '';
          } else if (inArray && line.trim()) {
            // Multi-line array item (without dash)
            const item = line.trim();
            if (item && !item.startsWith('[') && !item.startsWith(']')) {
              arrayItems.push(item.replace(/"/g, '').replace(/'/g, ''));
            }
          }
        }
        
        // Save the last key-value pair
        if (currentKey && currentValue) {
          if (inArray) {
            data[currentKey] = arrayItems;
          } else {
            data[currentKey] = currentValue;
          }
        }
      }
      console.log('Parsed data:', data);
      console.log('Content length:', markdownContent.length);
      console.log('Frontmatter match:', !!frontmatterMatch);
      console.log('Raw frontmatter:', frontmatterMatch ? frontmatterMatch[1] : 'No match');
      
      posts.push({
        slug,
        title: data.title || 'Untitled',
        date: data.date || new Date().toISOString().split('T')[0],
        author: data.author || 'Unknown',
        tags: data.tags || [],
        excerpt: data.excerpt || '',
        content: markdownContent,
        readingTime: calculateReadingTime(markdownContent)
      });
    }
    
    console.log('Loaded posts:', posts);
  } catch (error) {
    console.error('Error loading blog posts:', error);
    throw error; // Re-throw to handle in calling function
  }
  
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Cache for blog posts
let blogPostsCache: BlogPost[] | null = null;



// Sample landing pages
export const sampleLandingPages: LandingPage[] = [
  {
    slug: 'youth-groups',
    title: 'Youth Groups',
    description: 'Perfect for youth group scripture memory',
    cta: 'Get Started',
    content: `
# Scripture Memory for Youth Groups

Transform your youth group's scripture memory with our powerful, easy-to-use platform.

## Why Youth Groups Love Scripture Memory

### Easy Setup
- Create a group in minutes
- Invite students via email
- No complex setup required

### Engaging Features
- Gamification keeps students motivated
- Progress tracking for leaders
- Community features for accountability

### Proven Results
- Students actually memorize scripture
- Leaders can track progress
- Built-in encouragement system

## Getting Started

1. **Create Your Group**
   - Sign up as a leader
   - Create your youth group
   - Customize your settings

2. **Invite Students**
   - Send email invitations
   - Students join with one click
   - No passwords to remember

3. **Add Verse Sets**
   - Choose from our curated sets
   - Create custom sets
   - Import your own verses

4. **Start Memorizing**
   - Students practice individually
   - Leaders track progress
   - Celebrate achievements together

## What Leaders Are Saying

> "Our youth group engagement has increased dramatically since using Scripture Memory. Students are actually excited to memorize scripture!" - Sarah, Youth Pastor

> "The progress tracking helps me encourage students who are struggling and celebrate with those who are excelling." - Mike, Youth Leader

## Ready to Get Started?

Join hundreds of youth groups already using Scripture Memory to help their students hide God's Word in their hearts.
    `
  },
  {
    slug: 'church-groups',
    title: 'Church Groups',
    description: 'Perfect for church-wide scripture memory initiatives',
    cta: 'Get Started',
    content: `
# Scripture Memory for Church Groups

Empower your entire congregation to memorize scripture together with our church-focused platform.

## Why Churches Choose Scripture Memory

### Congregation-Wide Engagement
- Suitable for all ages
- Scalable from small groups to entire congregations
- Flexible group structures

### Leadership Tools
- Comprehensive progress tracking
- Encouragement and accountability features
- Easy communication tools

### Biblical Focus
- Designed specifically for scripture memory
- Encourages meditation on God's Word
- Community-driven approach

## Features for Churches

### Multiple Group Types
- Sunday School classes
- Small groups
- Ministry teams
- Entire congregation

### Flexible Administration
- Multiple leaders per group
- Hierarchical group structures
- Customizable permissions

### Engagement Tools
- Progress celebrations
- Encouragement notifications
- Community features

## Getting Started

1. **Plan Your Groups**
   - Identify your target groups
   - Choose your verse sets
   - Set your goals

2. **Set Up Groups**
   - Create groups for each ministry
   - Invite leaders and members
   - Customize settings

3. **Launch Your Initiative**
   - Introduce to your congregation
   - Provide training and support
   - Monitor and encourage progress

## Success Stories

> "Our entire church is now memorizing scripture together. The engagement has been incredible!" - Pastor David

> "The platform makes it easy for us to encourage our congregation in scripture memory." - Ministry Director Lisa

## Ready to Transform Your Church?

Join churches across the country using Scripture Memory to strengthen their congregations through God's Word.
    `
  }
];

// Utility functions
export async function getBlogPost(slug: string): Promise<BlogPost | undefined> {
  const posts = await getAllBlogPosts();
  return posts.find(post => post.slug === slug);
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  if (blogPostsCache) {
    return blogPostsCache;
  }
  
  try {
    blogPostsCache = await loadBlogPosts();
    return blogPostsCache;
  } catch (error) {
    console.error('Failed to load blog posts from markdown files:', error);
    return []; // Return empty array if loading fails
  }
}

// Cache for changelog entries
let changelogCache: ChangelogEntry[] | null = null;

// Function to load changelog entries from markdown files
async function loadChangelogEntries(): Promise<ChangelogEntry[]> {
  const entries: ChangelogEntry[] = [];
  
  try {
    // Import changelog markdown files at build time
    const changelogFiles = import.meta.glob('../content/changelog/*.md', { 
      query: '?raw',
      import: 'default',
      eager: true 
    });
    
    console.log('Found changelog files:', Object.keys(changelogFiles));
    
    for (const path in changelogFiles) {
      console.log('Loading changelog file:', path);
      const file = changelogFiles[path];
      console.log('File type:', typeof file);
      console.log('File:', file);
      
      // Get the content directly (should be raw string with as: 'raw')
      const content = file as string;
      
      if (typeof content !== 'string') {
        console.error('Expected string content, got:', typeof content);
        continue;
      }
      
      console.log('Raw changelog content:', content.substring(0, 200));
      
      const version = path.replace('../content/changelog/', '').replace('.md', '');
      
      // Simple frontmatter parser for browser compatibility
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      let data: any = {};
      let markdownContent = content;
      
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        markdownContent = frontmatterMatch[2];
        
        // Parse YAML frontmatter
        const lines = frontmatter.split('\n');
        let currentKey = '';
        let currentValue = '';
        let inArray = false;
        let arrayItems: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const colonIndex = line.indexOf(':');
          
          if (colonIndex > 0) {
            // Save previous key-value pair
            if (currentKey && currentValue) {
              if (inArray) {
                data[currentKey] = arrayItems;
                arrayItems = [];
                inArray = false;
              } else {
                data[currentKey] = currentValue;
              }
            }
            
            // Start new key-value pair
            currentKey = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            
            // Check if this starts an array
            if (value.startsWith('[')) {
              inArray = true;
              arrayItems = [];
              // Check if it's a single-line array
              if (value.endsWith(']')) {
                const arrayContent = value.slice(1, -1);
                if (arrayContent.trim()) {
                  data[currentKey] = arrayContent.split(',').map(v => v.trim().replace(/"/g, '').replace(/'/g, ''));
                } else {
                  data[currentKey] = [];
                }
                inArray = false;
                currentKey = '';
                currentValue = '';
              }
            } else {
              currentValue = value;
            }
          } else if (inArray && line.trim().startsWith('-')) {
            // Array item
            const item = line.trim().substring(1).trim();
            arrayItems.push(item.replace(/"/g, '').replace(/'/g, ''));
          } else if (inArray && line.trim() === ']') {
            // End of array
            data[currentKey] = arrayItems;
            arrayItems = [];
            inArray = false;
            currentKey = '';
            currentValue = '';
          } else if (inArray && line.trim()) {
            // Multi-line array item (without dash)
            const item = line.trim();
            if (item && !item.startsWith('[') && !item.startsWith(']')) {
              arrayItems.push(item.replace(/"/g, '').replace(/'/g, ''));
            }
          }
        }
        
        // Save the last key-value pair
        if (currentKey && currentValue) {
          if (inArray) {
            data[currentKey] = arrayItems;
          } else {
            data[currentKey] = currentValue;
          }
        }
      }
      console.log('Parsed changelog data:', data);
      console.log('Content length:', markdownContent.length);
      console.log('Changelog frontmatter match:', !!frontmatterMatch);
      console.log('Raw changelog frontmatter:', frontmatterMatch ? frontmatterMatch[1] : 'No match');
      
      entries.push({
        version,
        date: data.date || new Date().toISOString().split('T')[0],
        type: data.type || 'minor',
        features: data.features || [],
        fixes: data.fixes || [],
        content: markdownContent
      });
    }
    
    console.log('Loaded changelog entries:', entries);
  } catch (error) {
    console.error('Error loading changelog entries:', error);
    throw error;
  }
  
  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getChangelogEntry(version: string): Promise<ChangelogEntry | undefined> {
  const entries = await getAllChangelogEntries();
  return entries.find(entry => entry.version === version);
}

export async function getAllChangelogEntries(): Promise<ChangelogEntry[]> {
  if (changelogCache) {
    return changelogCache;
  }
  
  try {
    changelogCache = await loadChangelogEntries();
    return changelogCache;
  } catch (error) {
    console.error('Failed to load changelog entries from markdown files:', error);
    return []; // Return empty array if loading fails
  }
}

export function getLandingPage(slug: string): LandingPage | undefined {
  return sampleLandingPages.find(page => page.slug === slug);
}

export function getAllLandingPages(): LandingPage[] {
  return sampleLandingPages;
}

// Calculate reading time (rough estimate)
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

// Format date for display
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Get tags for filtering
export async function getAllTags(): Promise<string[]> {
  const posts = await getAllBlogPosts();
  const tags = new Set<string>();
  posts.forEach(post => {
    post.tags.forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
} 