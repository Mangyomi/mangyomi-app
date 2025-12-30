import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import type { MangaExtension, ExtensionManifest } from './types';

const require = createRequire(import.meta.url);

const extensions: Map<string, MangaExtension> = new Map();

export async function loadExtensions(extensionsPath: string): Promise<void> {
    if (!fs.existsSync(extensionsPath)) {
        console.log('Extensions directory does not exist, creating:', extensionsPath);
        fs.mkdirSync(extensionsPath, { recursive: true });
        return;
    }

    const dirs = fs.readdirSync(extensionsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const dir of dirs) {
        const extPath = path.join(extensionsPath, dir);
        const manifestPath = path.join(extPath, 'manifest.json');
        const indexPath = path.join(extPath, 'index.js');

        if (!fs.existsSync(manifestPath) || !fs.existsSync(indexPath)) {
            console.warn(`Skipping ${dir}: missing manifest.json or index.js`);
            continue;
        }

        try {
            const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
            const manifest: ExtensionManifest = JSON.parse(manifestContent);

            const extModule = require(indexPath);

            const extension: MangaExtension = {
                ...manifest,
                getImageHeaders: extModule.getImageHeaders,
                getPopularManga: extModule.getPopularManga,
                getLatestManga: extModule.getLatestManga,
                searchManga: extModule.searchManga,
                getMangaDetails: extModule.getMangaDetails,
                getChapterList: extModule.getChapterList,
                getChapterPages: extModule.getChapterPages,
            };

            extensions.set(extension.id, extension);
            console.log(`Loaded extension: ${extension.name} v${extension.version}`);
        } catch (error) {
            console.error(`Failed to load extension ${dir}:`, error);
        }
    }

    console.log(`Loaded ${extensions.size} extension(s)`);
}

export function getExtension(id: string): MangaExtension | undefined {
    return extensions.get(id);
}

export function getAllExtensions(): MangaExtension[] {
    return Array.from(extensions.values());
}

export function hasExtension(id: string): boolean {
    return extensions.has(id);
}

export function unloadExtension(id: string): boolean {
    if (!extensions.has(id)) {
        return false;
    }
    extensions.delete(id);
    return true;
}

export function clearRequireCache(extensionsPath: string): void {
    Object.keys(require.cache).forEach(key => {
        if (key.includes(extensionsPath.replace(/\\/g, '/'))) {
            delete require.cache[key];
        }
    });
}

export async function reloadExtensions(extensionsPath: string): Promise<void> {
    extensions.clear();
    clearRequireCache(extensionsPath);
    await loadExtensions(extensionsPath);
}
