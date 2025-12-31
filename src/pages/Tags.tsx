import { useState, useEffect, useMemo } from 'react';
import { useAppStore, Tag, Manga } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import MangaCard from '../components/MangaCard/MangaCard';
import ConfirmModal from '../components/ConfirmModal/ConfirmModal';
import './Tags.css';

const TAG_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

function Tags() {
    const { tags, loadTags, createTag, updateTag, deleteTag, getMangaByTag, extensions } = useAppStore();
    const { hideNsfwInTags, hideNsfwCompletely } = useSettingsStore();

    useEffect(() => {
        loadTags();
    }, []);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
    const [isCreating, setIsCreating] = useState(false);

    // Edit state
    const [editingTag, setEditingTag] = useState<Tag | null>(null);

    // Confirmation Modal State
    const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    // Drill-down state
    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
    const [tagManga, setTagManga] = useState<Manga[]>([]);
    const [loadingManga, setLoadingManga] = useState(false);

    // Open create modal
    const openCreateModal = () => {
        setEditingTag(null);
        setNewTagName('');
        setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
        setIsCreating(true);
    };

    // Open edit modal
    const openEditModal = (tag: Tag, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingTag(tag);
        setNewTagName(tag.name);
        setNewTagColor(tag.color);
        setIsCreating(true);
    };

    const handleSaveTag = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagName.trim()) return;

        if (editingTag) {
            await updateTag(editingTag.id, newTagName.trim(), newTagColor);
        } else {
            await createTag(newTagName.trim(), newTagColor);
        }

        // Reset
        setNewTagName('');
        setNewTagColor(TAG_COLORS[0]);
        setIsCreating(false);
        setEditingTag(null);
    };

    const handleDeleteClick = (tag: Tag, e: React.MouseEvent) => {
        e.stopPropagation();
        setTagToDelete(tag);
        setShowConfirmDelete(true);
    };

    const confirmDelete = async () => {
        if (tagToDelete) {
            await deleteTag(tagToDelete.id);
            if (selectedTag?.id === tagToDelete.id) {
                setSelectedTag(null);
            }
            setShowConfirmDelete(false);
            setTagToDelete(null);
        }
    };

    const handleTagClick = async (tag: Tag) => {
        setSelectedTag(tag);
        setLoadingManga(true);
        try {
            const mangaList = await getMangaByTag(tag.id);
            setTagManga(mangaList);
        } catch (error) {
            console.error('Failed to load manga for tag', error);
        } finally {
            setLoadingManga(false);
        }
    };

    const handleBack = () => {
        setSelectedTag(null);
        setTagManga([]);
    };

    // Filter NSFW manga from tag results
    const filteredTagManga = useMemo(() => {
        if (!hideNsfwCompletely && !hideNsfwInTags) return tagManga;
        const nsfwExtensions = new Set(
            extensions.filter(ext => ext.nsfw).map(ext => ext.id)
        );
        return tagManga.filter(manga => !nsfwExtensions.has(manga.source_id));
    }, [tagManga, hideNsfwCompletely, hideNsfwInTags, extensions]);

    if (selectedTag) {
        return (
            <div className="tags-page">
                <div className="page-header">
                    <div className="header-left">
                        <button className="btn btn-ghost" onClick={handleBack}>
                            ← Back
                        </button>
                        <div>
                            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                    className="tag-dot-large"
                                    style={{ background: selectedTag.color, width: 16, height: 16, borderRadius: '50%', display: 'inline-block' }}
                                />
                                {selectedTag.name}
                            </h1>
                            <p className="page-subtitle">{tagManga.length} manga</p>
                        </div>
                    </div>
                </div>

                {loadingManga ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                    </div>
                ) : filteredTagManga.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📚</div>
                        <h2 className="empty-state-title">No manga with this tag</h2>
                        <p className="empty-state-description">
                            Add this tag to manga from their details page.
                        </p>
                    </div>
                ) : (
                    <div className="manga-grid">
                        {filteredTagManga.map(manga => (
                            <MangaCard
                                key={manga.id}
                                id={manga.source_manga_id}
                                title={manga.title}
                                coverUrl={manga.cover_url}
                                extensionId={manga.source_id}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="tags-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Tags</h1>
                    <p className="page-subtitle">Organize your manga collection</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={openCreateModal}
                >
                    + New Tag
                </button>
            </div>

            {/* Create/Edit Tag Modal */}
            {isCreating && (
                <div className="create-tag-modal">
                    <form className="create-tag-form" onSubmit={handleSaveTag}>
                        <h3 className="create-tag-title">
                            {editingTag ? 'Edit Tag' : 'Create New Tag'}
                        </h3>

                        <div className="form-group">
                            <label className="form-label">Name</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter tag name..."
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Color</label>
                            <div className="color-picker">
                                {TAG_COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`color-option ${newTagColor === color ? 'active' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setNewTagColor(color)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditingTag(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary">
                                {editingTag ? 'Save Changes' : 'Create Tag'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tags List */}
            {tags.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🏷️</div>
                    <h2 className="empty-state-title">No tags yet</h2>
                    <p className="empty-state-description">
                        Create tags to organize your manga collection
                    </p>
                </div>
            ) : (
                <div className="tags-grid">
                    {tags.map(tag => (
                        <div
                            key={tag.id}
                            className="tag-card clickable"
                            onClick={() => handleTagClick(tag)}
                        >
                            <div
                                className="tag-color"
                                style={{ backgroundColor: tag.color }}
                            />
                            <div className="tag-info">
                                <h3 className="tag-name">{tag.name}</h3>
                                <p className="tag-count">{tag.count || 0} manga</p>
                            </div>

                            <div className="tag-actions">
                                <button
                                    className="btn btn-ghost btn-icon tag-action-btn"
                                    title="Edit"
                                    onClick={(e) => openEditModal(tag, e)}
                                >
                                    ✎
                                </button>
                                <button
                                    className="btn btn-ghost btn-icon tag-action-btn delete"
                                    title="Delete"
                                    onClick={(e) => handleDeleteClick(tag, e)}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmModal
                isOpen={showConfirmDelete}
                title="Delete Tag"
                message={`Are you sure you want to delete the tag "${tagToDelete?.name}"?`}
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                onCancel={() => setShowConfirmDelete(false)}
                isDestructive={true}
            />
        </div>
    );
}

export default Tags;
