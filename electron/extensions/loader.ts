import path from 'path';
import fs from 'fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import type { MangaExtension, ExtensionManifest } from './types';

const appRequire = createRequire(import.meta.url);

const extensions: Map<string, MangaExtension> = new Map();

// Helper to load extension in a sandboxed-like environment with injected dependencies
function loadExtensionModule(indexPath: string) {
    const code = fs.readFileSync(indexPath, 'utf-8');

    // Create a custom require function that intercepts 'jsdom'
    const customRequire = (id: string) => {
        if (id === 'jsdom') {
            // Dynamically require jsdom using the app's require context
            return appRequire('jsdom');
        }
        // Allows the extension to require standard node modules if needed, 
        // though typically they should be self-contained or use injected deps.
        // We resolve relative to the extension file.
        const extRequire = createRequire(indexPath);
        return extRequire(id);
    };

    // Create a mock module context
    const module = { exports: {} };
    const exports = module.exports;
    const __filename = indexPath;
    const __dirname = path.dirname(indexPath);

    // Wrap the code in a function similar to Node's internal module wrapper
    const wrapper = `(function (exports, require, module, __filename, __dirname) { ${code} \n});`;

    const script = new vm.Script(wrapper, {
        filename: indexPath,
    });

    const compiledWrapper = script.runInThisContext();

    // Execute the wrapper with our custom context
    compiledWrapper.call(module.exports, exports, customRequire, module, __filename, __dirname);

    return module.exports;
}

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

            // Use our custom loader instead of standard require
            const extModule: any = loadExtensionModule(indexPath);

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

// wrap in async
export async function reloadExtensions(extensionsPath: string): Promise<void> {
    extensions.clear();
    // No need to clear require cache as we are reading file content manually
    await loadExtensions(extensionsPath);
}
