# AGENT.md - Claim Finder Agent Development Guide

## Build/Test Commands
- `pnpm dev` - Start Next.js frontend development server
- `pnpm build` - Build frontend for production
- `pnpm lint` - Run ESLint on frontend code
- `pnpm type-check` - TypeScript type checking (no emit)
- `cd backend && npm run dev` - Start backend development server with watch
- `cd backend && npm run build` - Build backend TypeScript to JavaScript
- `cd backend && npm test` - Run backend collector tests
- `tsx scripts/test-collectors.ts` - Test individual collectors from root

## Architecture
- **Frontend**: Next.js app with TypeScript, Tailwind CSS, deployed on Vercel
- **Backend**: Node.js service with Express, Bull queues, deployed separately
- **Database**: PostgreSQL (Supabase) for cases and sources storage
- **AI Services**: Google Gemini for content extraction, Exa for web search
- **Web Scraping**: Playwright for complex sites, Cheerio for HTML parsing

## Code Style
- **Imports**: ES6 with type imports (`import type`), path aliasing `@/*`
- **Naming**: camelCase for variables/functions, PascalCase for classes/types, kebab-case for files
- **Error Handling**: Custom error classes extending Error, comprehensive try-catch with context
- **Types**: Zod schemas alongside TypeScript interfaces for runtime validation
- **Async**: Use async/await consistently, no Promise chains
- **Classes**: Abstract base classes for shared functionality, dependency injection
- **Files**: Feature-based structure (`lib/collectors/`, `lib/ai/`), centralized types in `types/`
