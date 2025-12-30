# Mangyomi 📖

A Tachiyomi-style manga reader desktop application built with Electron and React.

![Mangyomi Screenshot](./docs/screenshot.png)

## Features

- 📚 **Library Management** - Organize your manga collection with tags and categories
- 🔍 **Browse Sources** - Search and discover manga from multiple sources via extensions
- 📖 **Chapter Reader** - Smooth reading experience with vertical scroll and page modes
- 📜 **Reading History** - Track your reading progress across all manga
- 🏷️ **Tags** - Organize manga with custom colored tags
- 🔌 **Extension System** - Install extensions directly from GitHub repositories
- ⚙️ **Settings** - Customize theme, prefetch behavior, and more

## Installing Extensions

Mangyomi supports installing extensions directly from GitHub:

1. Go to **Extensions** in the sidebar
2. Enter a GitHub repository URL (e.g., `github.com/username/mangyomi-extensions`)
3. Click **Browse** to see available extensions
4. Click **Install** on any extension you want
5. Toggle extensions on/off or uninstall as needed

### Extension Repository Format

Extension repositories should contain folders, each with:
- `manifest.json` - Extension metadata
- `index.js` - Extension implementation

```
my-extensions-repo/
├── extension-one/
│   ├── manifest.json
│   └── index.js
├── extension-two/
│   ├── manifest.json
│   └── index.js
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Development

```bash
git clone https://github.com/Mangyomi/mangyomi-app.git
cd mangyomi
npm install
npm run dev
```

### Building

```bash
npm run electron:build
```

## Extension Development

### manifest.json

```json
{
  "id": "your-extension",
  "name": "Your Extension",
  "version": "1.0.0",
  "baseUrl": "https://example.com",
  "language": "en",
  "nsfw": false
}
```

### Extension API

```javascript
module.exports = {
  getImageHeaders() {
    return { 'Referer': 'https://example.com/' };
  },

  async getPopularManga(page) {
    return { manga: [...], hasNextPage: true };
  },

  async getLatestManga(page) {
    return { manga: [...], hasNextPage: true };
  },

  async searchManga(query, page) {
    return { manga: [...], hasNextPage: true };
  },

  async getMangaDetails(mangaId) {
    return { id, title, coverUrl, author, description, status, genres };
  },

  async getChapterList(mangaId) {
    return [{ id, title, chapterNumber, url }];
  },

  async getChapterPages(chapterId) {
    return ['https://...'];
  }
};
```

## Tech Stack

- **Electron** - Desktop framework
- **React 18** - UI library
- **Vite** - Build tool
- **SQLite** - Local database
- **Zustand** - State management

## License

Apache 2.0

## Acknowledgments

- Inspired by [Tachiyomi](https://tachiyomi.org/)
- Built with [Electron](https://www.electronjs.org/) and [React](https://reactjs.org/)

