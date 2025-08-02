# Scripture Memory Marketing Site Plan

## Overview
A content management system integrated into the existing React app for blog posts, changelogs, and landing pages. This approach trades some separation for much simpler complexity while maintaining easy content updates.

## Proposed Architecture

### Domain & Structure
- **News Section**: `scripture.wpsteward.com/news`
- **Blog Posts**: `scripture.wpsteward.com/news/blog`
- **Changelog**: `scripture.wpsteward.com/news/changelog`
- **Landing Pages**: `scripture.wpsteward.com/youth-groups`, `scripture.wpsteward.com/church-groups`
- **Individual Posts**: `scripture.wpsteward.com/news/blog/[slug]`, `scripture.wpsteward.com/news/changelog/[version]`

### Technology Stack (Integrated Approach)

**Markdown + React Router + Content Collections**

**Why This Works:**
- Leverages existing React app infrastructure
- Markdown files for easy content management
- Type-safe content with TypeScript
- Same styling and branding as main app
- No additional deployment complexity
- Familiar development workflow

### Content Structure

```
frontend/
├── src/
│   ├── content/
│   │   ├── blog/
│   │   │   ├── 2024-08-02-new-features.md
│   │   │   ├── 2024-08-15-youth-group-guide.md
│   │   │   └── ...
│   │   ├── changelog/
│   │   │   ├── v1.2.0.md
│   │   │   ├── v1.1.0.md
│   │   │   └── ...
│   │   └── landing-pages/
│   │       ├── youth-groups.md
│   │       ├── church-groups.md
│   │       └── ...
│   ├── pages/
│   │   ├── News.tsx
│   │   ├── BlogPost.tsx
│   │   ├── Changelog.tsx
│   │   ├── YouthGroups.tsx
│   │   └── ChurchGroups.tsx
│   ├── components/
│   │   ├── BlogCard.tsx
│   │   ├── ChangelogEntry.tsx
│   │   └── ...
│   └── utils/
│       └── content.ts
```

## Implementation Strategy

### 1. Content Management System
- **Markdown files** with frontmatter for metadata
- **Content collections** for type safety
- **Automatic parsing** at build time
- **SEO optimization** with meta tags

### 2. Routing Structure
```typescript
// New routes to add to App.tsx
<Route path="/news" element={<News />} />
<Route path="/news/blog" element={<BlogList />} />
<Route path="/news/blog/:slug" element={<BlogPost />} />
<Route path="/news/changelog" element={<Changelog />} />
<Route path="/news/changelog/:version" element={<ChangelogEntry />} />
<Route path="/youth-groups" element={<YouthGroups />} />
<Route path="/church-groups" element={<ChurchGroups />} />
```

### 3. Content Types

**Blog Posts** (`/news/blog/[slug]`)
```markdown
---
title: "New Features for Youth Groups"
date: "2024-08-15"
author: "Ben Meredith"
tags: ["features", "youth-groups"]
excerpt: "Exciting new features to help youth groups..."
---
```

**Changelog Entries** (`/news/changelog/[version]`)
```markdown
---
version: "v1.2.0"
date: "2024-08-15"
type: "major"
features: ["Group management", "Progress tracking"]
fixes: ["Login issues", "Performance improvements"]
---
```

**Landing Pages** (`/youth-groups`, `/church-groups`)
```markdown
---
title: "Youth Groups"
description: "Perfect for youth group scripture memory"
cta: "Get Started"
---
```

## Content Workflow

### For Blog Posts
1. Create markdown file in `src/content/blog/`
2. Add frontmatter with title, date, tags, etc.
3. Write content in markdown
4. Push to repo
5. Automatic deployment (same as app)

### For Changelog Updates
1. Create version file in `src/content/changelog/`
2. Add version number, date, changes
3. Push to repo
4. Automatic deployment

### For Landing Pages
1. Create markdown file in `src/content/landing-pages/`
2. Add frontmatter with page metadata
3. Write content in markdown
4. Push to repo
5. Automatic deployment

## SEO & Performance Strategy

### SEO Features
- Automatic sitemap generation
- Meta tags from frontmatter
- Open Graph images
- Structured data (JSON-LD)
- Canonical URLs
- Robots.txt optimization

### Performance Features
- Static generation at build time
- Image optimization
- CSS/JS minification
- CDN delivery via Cloudflare
- Lighthouse scores >95

## Integration with Main App

### Cross-Linking Strategy
- News site links to app: `https://scripture.wpsteward.com`
- App links to news: `https://scripture.wpsteward.com/news`
- Consistent branding across all pages
- Shared analytics tracking

### Analytics & Tracking
- Google Analytics 4
- Cloudflare Web Analytics
- Conversion tracking for signups
- Performance monitoring

## Benefits of This Approach

### Simplicity
- Single codebase to maintain
- Same deployment pipeline
- Consistent styling and branding
- No additional infrastructure

### Content Management
- Markdown files for easy updates
- Git-based version control
- Type-safe content with TypeScript
- Automatic build-time processing

### SEO Benefits
- Same domain authority as main app
- Internal linking benefits
- Consistent user experience
- Faster page loads (no cross-domain requests)

## Potential Concerns & Solutions

### Concern: App Complexity
**Solution**: Modular content system, clear separation of concerns, reusable components.

### Concern: Build Time
**Solution**: Content is processed at build time, minimal runtime overhead.

### Concern: Content Management
**Solution**: Markdown files with frontmatter, familiar workflow for developers.

### Concern: SEO Competition
**Solution**: Different content types, clear URL structure, proper internal linking.

## Implementation Timeline

### Phase 1: Foundation (Week 1)
- Set up content management system
- Create basic news/blog structure
- Add routing for new pages
- First blog post

### Phase 2: Content Types (Week 2)
- Blog system with pagination
- Changelog system
- Landing page templates
- SEO optimization

### Phase 3: Landing Pages (Week 3)
- Youth groups landing page
- Church groups landing page
- Contact forms
- Analytics integration

### Phase 4: Polish (Week 4)
- Performance optimization
- Content migration
- Testing and refinement
- Launch

## Technical Implementation

### Content Parsing
```typescript
// utils/content.ts
export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  author: string;
  tags: string[];
  excerpt: string;
  content: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  features: string[];
  fixes: string[];
  content: string;
}
```

### Component Structure
```typescript
// pages/News.tsx
export function News() {
  const posts = useBlogPosts();
  return (
    <Container>
      <Heading>News & Updates</Heading>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }}>
        {posts.map(post => <BlogCard key={post.slug} post={post} />)}
      </SimpleGrid>
    </Container>
  );
}
```

## Success Metrics

### Performance
- Lighthouse score >95
- Page load time <2s
- Core Web Vitals compliance

### SEO
- Search engine indexing
- Organic traffic growth
- Keyword rankings

### Engagement
- Blog post views
- Landing page conversions
- Newsletter signups

### Business
- Youth group signups
- User acquisition
- Brand awareness

## Conclusion

This integrated approach provides the perfect balance of:
- **Simplicity**: Single codebase, familiar workflow
- **Performance**: Static generation, excellent SEO
- **Maintainability**: Markdown-based content management
- **Scalability**: Can grow with your needs
- **Cost-effectiveness**: No additional infrastructure

The path-based approach eliminates deployment complexity while maintaining all the benefits of a content management system. 