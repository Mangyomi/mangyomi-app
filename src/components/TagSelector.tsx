import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import './TagSelector.css';

interface TagSelectorProps {
    mangaId: string;
    onClose: () => void;
}

function TagSelector({ mangaId, onClose }: TagSelectorProps) {
    const { tags, loadTags, createTag, addTagToManga, removeTagFromManga } = useAppStore();
    const [newTagName, setNewTagName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTagIds, setActiveTagIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        loadTags();

        const fetchMangaTags = async () => {
            try {
                const tags = await window.electronAPI.db.getTagsForManga(mangaId);
                setActiveTagIds(new Set(tags.map(t => t.id)));
            } catch (e) {
                console.error("Failed to load manga tags", e);
            }
        };
        fetchMangaTags();
    }, []);

    const filteredTags = tags.filter(tag =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;
        const color = '#' + Math.floor(Math.random() * 16777215).toString(16);
        await createTag(newTagName, color);
        setNewTagName('');
    };

    const toggleTag = async (tagId: number) => {
        if (activeTagIds.has(tagId)) {
            await removeTagFromManga(mangaId, tagId);
            const newSet = new Set(activeTagIds);
            newSet.delete(tagId);
            setActiveTagIds(newSet);
        } else {
            await addTagToManga(mangaId, tagId);
            const newSet = new Set(activeTagIds);
            newSet.add(tagId);
            setActiveTagIds(newSet);
        }
    };

    return (
        <div className="tag-selector-overlay" onClick={onClose}>
            <div className="tag-selector-modal" onClick={e => e.stopPropagation()}>
                <div className="tag-selector-header">
                    <h3>Manage Tags</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="tag-creation">
                    <input
                        type="text"
                        placeholder="New tag name..."
                        value={newTagName}
                        onChange={e => setNewTagName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                    />
                    <button onClick={handleCreateTag} disabled={!newTagName.trim()}>Add</button>
                </div>

                <div className="tag-search">
                    <input
                        type="text"
                        placeholder="Search tags..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="tag-list">
                    {filteredTags.map(tag => (
                        <div
                            key={tag.id}
                            className={`tag-item ${activeTagIds.has(tag.id) ? 'active' : ''}`}
                            onClick={() => toggleTag(tag.id)}
                        >
                            <span className="tag-color" style={{ background: tag.color }}></span>
                            <span className="tag-name">{tag.name}</span>
                            {activeTagIds.has(tag.id) && <span className="check-mark">✓</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default TagSelector;
