import { useState, useEffect, useRef } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Icon from './Icon';
import {
    ANGLES,
    CATEGORY_LABELS,
    buildInstagramPrompt,
    getNextArticle,
    getNextAngle,
    getPreviousCaptions,
    parseClaudeResponse,
    extractArticleImages,
} from '../utils/instagramGenerator';

export default function InstagramModal({ show, onClose, articles, db, appId }) {
    // Firestore refs — built lazily to avoid crashing when db is not ready
    function getMetaRef() { return doc(db, 'artifacts', appId, 'instagram', 'meta'); }
    function getPostsCol() { return collection(db, 'artifacts', appId, 'instagramPosts'); }

    // State
    const [meta, setMeta] = useState({ currentCycle: 1, usedInCurrentCycle: [], totalPostsCount: 0 });
    const [postHistory, setPostHistory] = useState([]);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [articleImages, setArticleImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedAngle, setSelectedAngle] = useState('review');
    const [captionText, setCaptionText] = useState('');
    const [hashtagsText, setHashtagsText] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [copyFeedback, setCopyFeedback] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [publishResult, setPublishResult] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [tokenWarning, setTokenWarning] = useState(null);
    const [tokenExpired, setTokenExpired] = useState(false);
    const [renewingToken, setRenewingToken] = useState(false);

    const modalRef = useFocusTrap(show);
    const captionRef = useRef(null);

    // Load history & meta when modal opens
    useEffect(() => {
        if (!show) return;
        loadData();
        checkToken();
    }, [show]);

    async function loadData() {
        try {
            const metaSnap = await getDoc(getMetaRef());
            if (metaSnap.exists()) setMeta(metaSnap.data());

            const q = query(getPostsCol(), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPostHistory(posts);
        } catch (err) {
            console.error('Failed to load Instagram data:', err);
        }
    }

    async function checkToken() {
        try {
            const res = await fetch('/api/instagram/token-status');
            if (res.ok) {
                const data = await res.json();
                if (!data.isValid) {
                    setTokenWarning('Token Instagram invalide ou expiré.');
                    setTokenExpired(true);
                } else if (data.expiresAt) {
                    const daysLeft = Math.floor((data.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
                    if (daysLeft < 7) {
                        setTokenWarning(`Token Instagram expire dans ${daysLeft} jour(s) !`);
                        if (daysLeft < 1) setTokenExpired(true);
                    }
                }
            }
        } catch {
            // Server not running or endpoint not available — ignore
        }
    }

    async function handleRenewToken() {
        setRenewingToken(true);
        try {
            const res = await fetch('/api/instagram/renew-token', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Échec du renouvellement');
            setTokenWarning(null);
            setTokenExpired(false);
            showCopyFeedback(`Token renouvelé pour ${data.expiresInDays} jours !`);
        } catch (err) {
            setTokenWarning(`Renouvellement échoué : ${err.message}`);
        } finally {
            setRenewingToken(false);
        }
    }

    // Auto-suggest angle + extract images when article changes
    useEffect(() => {
        if (selectedArticle) {
            setSelectedAngle(getNextAngle(selectedArticle.id, postHistory));
            setCaptionText('');
            setHashtagsText('');
            setPublishResult(null);
            const images = extractArticleImages(selectedArticle);
            setArticleImages(images);
            setSelectedImage(images[0] || null);
        }
    }, [selectedArticle]);

    // Filtered articles
    const filteredArticles = filterCategory === 'ALL'
        ? articles
        : articles.filter(a => a.category === filterCategory);

    const unusedCount = articles.filter(a => !meta.usedInCurrentCycle.includes(a.id)).length;

    // Handlers
    function handlePickRandom() {
        let picked = getNextArticle(articles, meta.usedInCurrentCycle);
        if (!picked) {
            // All used — start new cycle
            const newMeta = { currentCycle: meta.currentCycle + 1, usedInCurrentCycle: [], totalPostsCount: meta.totalPostsCount };
            setMeta(newMeta);
            picked = getNextArticle(articles, []);
        }
        setSelectedArticle(picked);
    }

    async function handleCopyPrompt() {
        if (!selectedArticle) return;
        const previous = getPreviousCaptions(selectedArticle.id, postHistory);
        // Pass selected image info to enrich the prompt
        const articleWithImage = {
            ...selectedArticle,
            imageAlt: selectedImage?.alt || selectedArticle.imageAlt,
        };
        const prompt = buildInstagramPrompt(articleWithImage, selectedAngle, previous);
        await navigator.clipboard.writeText(prompt);
        showCopyFeedback('Prompt copié !');
    }

    function handlePasteResponse() {
        // Parse pasted text if it contains the LEGENDE/HASHTAGS format
        const fullText = captionText;
        if (fullText.includes('LEGENDE:') || fullText.includes('HASHTAGS:')) {
            const parsed = parseClaudeResponse(fullText);
            setCaptionText(parsed.caption);
            setHashtagsText(parsed.hashtags);
        }
    }

    async function handleCopyCaption() {
        const full = hashtagsText ? `${captionText}\n\n${hashtagsText}` : captionText;
        await navigator.clipboard.writeText(full);
        showCopyFeedback('Légende copiée !');
    }

    async function handleCopyHashtags() {
        await navigator.clipboard.writeText(hashtagsText);
        showCopyFeedback('Hashtags copiés !');
    }

    function handleDownloadImage() {
        if (!selectedImage) return;
        const link = document.createElement('a');
        link.href = selectedImage.url;
        link.download = selectedImage.url.split('/').pop();
        link.click();
    }

    async function handlePublish() {
        if (!selectedArticle || !captionText.trim()) return;
        setPublishing(true);
        setPublishResult(null);

        const fullCaption = hashtagsText ? `${captionText}\n\n${hashtagsText}` : captionText;
        const imgUrl = selectedImage?.url || selectedArticle.imageUrl;
        const publicImageUrl = imgUrl.startsWith('http') ? imgUrl : `https://lechoixdeclara.fr/${imgUrl}`;

        try {
            const res = await fetch('/api/instagram/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: publicImageUrl, caption: fullCaption }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Publication échouée');
            }

            const result = await res.json();

            // Save to Firestore
            await addDoc(getPostsCol(), {
                articleId: selectedArticle.id,
                articleTitle: selectedArticle.title,
                imageUrl: selectedImage?.url || selectedArticle.imageUrl,
                category: selectedArticle.category,
                caption: captionText,
                hashtags: hashtagsText,
                angle: selectedAngle,
                cycle: meta.currentCycle,
                createdAt: Date.now(),
                posted: true,
                postedAt: Date.now(),
                instagramMediaId: result.id || null,
            });

            // Update meta
            const newMeta = {
                ...meta,
                usedInCurrentCycle: [...meta.usedInCurrentCycle, selectedArticle.id],
                totalPostsCount: (meta.totalPostsCount || 0) + 1,
            };
            await setDoc(getMetaRef(), newMeta);
            setMeta(newMeta);

            setPublishResult({ success: true, permalink: result.permalink });
            await loadData(); // Refresh history
        } catch (err) {
            setPublishResult({ success: false, error: err.message });
        } finally {
            setPublishing(false);
        }
    }

    async function handleSaveDraft() {
        if (!selectedArticle || !captionText.trim()) return;

        await addDoc(getPostsCol(), {
            articleId: selectedArticle.id,
            articleTitle: selectedArticle.title,
            imageUrl: selectedImage?.url || selectedArticle.imageUrl,
            category: selectedArticle.category,
            caption: captionText,
            hashtags: hashtagsText,
            angle: selectedAngle,
            cycle: meta.currentCycle,
            createdAt: Date.now(),
            posted: false,
            postedAt: null,
            instagramMediaId: null,
        });

        showCopyFeedback('Brouillon sauvegardé !');
        await loadData();
    }

    async function handleClearHistory() {
        if (!window.confirm('Effacer tout l\'historique Instagram ? Cette action est irréversible.')) return;
        try {
            const q = query(getPostsCol());
            const snap = await getDocs(q);
            const { deleteDoc } = await import('firebase/firestore');
            const deletes = snap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletes);
            // Reset meta
            await setDoc(getMetaRef(), { currentCycle: 1, usedInCurrentCycle: [], totalPostsCount: 0 });
            setMeta({ currentCycle: 1, usedInCurrentCycle: [], totalPostsCount: 0 });
            setPostHistory([]);
            showCopyFeedback('Historique effacé !');
        } catch (err) {
            showCopyFeedback(`Erreur : ${err.message}`);
        }
    }

    function showCopyFeedback(msg) {
        setCopyFeedback(msg);
        setTimeout(() => setCopyFeedback(''), 2000);
    }

    const totalChars = (captionText + '\n\n' + hashtagsText).length;

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 md:p-6 backdrop-blur-md fade-in">
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="insta-modal-title"
                className="bg-white rounded-3xl w-full h-full max-w-7xl flex flex-col shadow-2xl overflow-hidden scale-in"
            >
                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white">
                    <div className="flex items-center gap-3">
                        <Icon name="Camera" size={24} />
                        <h3 id="insta-modal-title" className="font-bold text-xl">Générateur Instagram</h3>
                        <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                            Cycle {meta.currentCycle} — {unusedCount} article{unusedCount > 1 ? 's' : ''} restant{unusedCount > 1 ? 's' : ''}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition"
                        aria-label="Fermer"
                    >
                        <Icon name="X" size={24} />
                    </button>
                </div>

                {/* Token warning */}
                {tokenWarning && (
                    <div className={`px-5 py-3 border-b text-sm flex items-center gap-3 ${
                        tokenExpired ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                        <Icon name="AlertTriangle" size={16} />
                        <span className="flex-1">{tokenWarning}</span>
                        <button
                            onClick={handleRenewToken}
                            disabled={renewingToken}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                                tokenExpired
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-amber-600 text-white hover:bg-amber-700'
                            } disabled:opacity-50`}
                        >
                            {renewingToken ? 'Renouvellement...' : 'Renouveler le token'}
                        </button>
                    </div>
                )}

                {/* Copy feedback toast */}
                {copyFeedback && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50 text-sm font-bold animate-bounce">
                        {copyFeedback}
                    </div>
                )}

                {/* Content */}
                <div className="flex-grow flex overflow-hidden">
                    {/* LEFT — Article picker */}
                    <div className="w-2/5 border-r flex flex-col bg-gray-50">
                        <div className="p-4 border-b bg-white">
                            <div className="flex gap-2 items-center">
                                <select
                                    value={filterCategory}
                                    onChange={e => setFilterCategory(e.target.value)}
                                    className="flex-1 p-2 border rounded-xl text-sm outline-none bg-gray-50"
                                >
                                    <option value="ALL">Toutes catégories</option>
                                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handlePickRandom}
                                    className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition flex items-center gap-1 whitespace-nowrap"
                                >
                                    <Icon name="Shuffle" size={14} /> Au hasard
                                </button>
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-3 space-y-2">
                            {filteredArticles.map(article => {
                                const isUsed = meta.usedInCurrentCycle.includes(article.id);
                                const isSelected = selectedArticle?.id === article.id;
                                return (
                                    <button
                                        key={article.id}
                                        onClick={() => setSelectedArticle(article)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition text-left ${
                                            isSelected
                                                ? 'bg-purple-100 border-2 border-purple-400'
                                                : 'bg-white border border-gray-100 hover:border-purple-200'
                                        }`}
                                    >
                                        <img
                                            src={article.imageUrl}
                                            alt={article.imageAlt || article.title}
                                            className="w-14 h-14 object-cover rounded-xl flex-shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate">{article.title}</p>
                                            <p className="text-xs text-gray-500">{CATEGORY_LABELS[article.category] || article.category}</p>
                                        </div>
                                        {isUsed && (
                                            <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-1 rounded-full flex-shrink-0">
                                                déjà
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT — Generation zone */}
                    <div className="w-3/5 flex flex-col overflow-y-auto">
                        {!selectedArticle ? (
                            <div className="flex-grow flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <Icon name="ImagePlus" size={48} className="mx-auto mb-4 opacity-50" />
                                    <p className="font-bold">Sélectionne une photo</p>
                                    <p className="text-sm">ou clique "Au hasard" pour commencer</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 space-y-5">
                                {/* Article info + image selector */}
                                <div>
                                    <h4 className="font-bold text-lg mb-1">{selectedArticle.title}</h4>
                                    <p className="text-sm text-gray-500 mb-3">{selectedArticle.excerpt}</p>
                                </div>

                                {/* Image selector */}
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-2">
                                        Photo a publier ({articleImages.length} disponible{articleImages.length > 1 ? 's' : ''})
                                    </label>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {articleImages.map((img, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedImage(img)}
                                                className={`relative flex-shrink-0 rounded-xl overflow-hidden transition ${
                                                    selectedImage?.url === img.url
                                                        ? 'ring-3 ring-purple-500 ring-offset-2'
                                                        : 'opacity-70 hover:opacity-100'
                                                }`}
                                            >
                                                <img
                                                    src={img.url}
                                                    alt={img.alt}
                                                    className="w-24 h-24 object-cover"
                                                />
                                                {img.isHero && (
                                                    <span className="absolute top-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                                                        Hero
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Selected image preview + angle */}
                                <div className="flex gap-5">
                                    {selectedImage && (
                                        <img
                                            src={selectedImage.url}
                                            alt={selectedImage.alt}
                                            className="w-48 h-48 object-cover rounded-2xl shadow-md flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 flex flex-col justify-end">
                                        <div className="flex items-center gap-3">
                                            <label className="text-xs font-bold uppercase text-gray-500">Angle :</label>
                                            <select
                                                value={selectedAngle}
                                                onChange={e => setSelectedAngle(e.target.value)}
                                                className="p-2 border rounded-xl text-sm outline-none bg-gray-50 flex-1"
                                            >
                                                {ANGLES.map(a => {
                                                    const used = postHistory.some(p => p.articleId === selectedArticle.id && p.angle === a.id);
                                                    return (
                                                        <option key={a.id} value={a.id}>
                                                            {a.label}{used ? ' ✓' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 1: Copy prompt */}
                                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-purple-800 flex items-center gap-2">
                                            <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                            Copier le prompt
                                        </span>
                                        <button
                                            onClick={handleCopyPrompt}
                                            className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 transition flex items-center gap-2"
                                        >
                                            <Icon name="Copy" size={14} /> Copier dans le presse-papier
                                        </button>
                                    </div>
                                    <p className="text-xs text-purple-600">Colle ce prompt dans Claude.ai pour générer la légende</p>
                                </div>

                                {/* Step 2: Paste response */}
                                <div className="space-y-3">
                                    <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <span className="bg-pink-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                        Coller la réponse de Claude
                                    </span>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-1">
                                            Légende
                                        </label>
                                        <textarea
                                            ref={captionRef}
                                            value={captionText}
                                            onChange={e => setCaptionText(e.target.value)}
                                            onBlur={handlePasteResponse}
                                            placeholder="Colle ici la réponse complète de Claude (ou juste la légende)..."
                                            className="w-full p-4 border rounded-xl outline-none focus:ring-2 ring-purple-200 bg-gray-50 resize-y"
                                            rows={5}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-1">
                                            Hashtags
                                        </label>
                                        <textarea
                                            value={hashtagsText}
                                            onChange={e => setHashtagsText(e.target.value)}
                                            placeholder="#lechoixdeclara #mode #lifestyle ..."
                                            className="w-full p-4 border rounded-xl outline-none focus:ring-2 ring-purple-200 bg-gray-50 resize-y"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>{totalChars} / 2200 caractères</span>
                                        <span className="text-purple-500 font-bold">
                                            Conseil : publie Mar/Jeu entre 11h-13h ou 18h-20h
                                        </span>
                                    </div>
                                </div>

                                {/* Step 3: Actions */}
                                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                                    <span className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-3">
                                        <span className="bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                        Publier
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={handlePublish}
                                            disabled={publishing || !captionText.trim() || tokenExpired}
                                            className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white px-5 py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                                            title={tokenExpired ? 'Renouvelez le token avant de publier' : ''}
                                        >
                                            <Icon name="Send" size={16} />
                                            {publishing ? 'Publication...' : tokenExpired ? 'Token expiré' : 'Poster sur Instagram'}
                                        </button>
                                        <button
                                            onClick={handleSaveDraft}
                                            disabled={!captionText.trim()}
                                            className="bg-white border border-gray-200 text-gray-700 px-4 py-3 rounded-xl font-bold hover:border-gray-400 transition disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Icon name="Save" size={16} /> Brouillon
                                        </button>
                                        <button
                                            onClick={handleCopyCaption}
                                            disabled={!captionText.trim()}
                                            className="bg-white border border-gray-200 text-gray-700 px-4 py-3 rounded-xl font-bold hover:border-gray-400 transition disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Icon name="Copy" size={16} /> Copier légende
                                        </button>
                                        <button
                                            onClick={handleCopyHashtags}
                                            disabled={!hashtagsText.trim()}
                                            className="bg-white border border-gray-200 text-gray-700 px-4 py-3 rounded-xl font-bold hover:border-gray-400 transition disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Icon name="Hash" size={16} /> Copier #
                                        </button>
                                        <button
                                            onClick={handleDownloadImage}
                                            className="bg-white border border-gray-200 text-gray-700 px-4 py-3 rounded-xl font-bold hover:border-gray-400 transition flex items-center gap-2"
                                        >
                                            <Icon name="Download" size={16} /> Image
                                        </button>
                                    </div>
                                </div>

                                {/* Publish result */}
                                {publishResult && (
                                    <div className={`p-4 rounded-2xl text-sm font-bold ${
                                        publishResult.success
                                            ? 'bg-green-50 text-green-700 border border-green-200'
                                            : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                        {publishResult.success ? (
                                            <span className="flex items-center gap-2">
                                                <Icon name="CheckCircle" size={16} />
                                                Publié avec succès !
                                                {publishResult.permalink && (
                                                    <a
                                                        href={publishResult.permalink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="underline ml-2"
                                                    >
                                                        Voir le post →
                                                    </a>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <Icon name="XCircle" size={16} />
                                                Erreur : {publishResult.error}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer — History */}
                <div className="border-t bg-gray-50">
                    <div className="flex items-center">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="flex-1 px-5 py-3 text-sm font-bold text-gray-600 hover:text-gray-900 transition flex items-center gap-2"
                        >
                            <Icon name={showHistory ? 'ChevronDown' : 'ChevronRight'} size={14} />
                            Historique ({postHistory.length} post{postHistory.length > 1 ? 's' : ''})
                        </button>
                        {postHistory.length > 0 && (
                            <button
                                onClick={handleClearHistory}
                                className="px-4 py-1.5 mr-4 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition"
                            >
                                <Icon name="Trash2" size={12} className="inline mr-1" />
                                Effacer
                            </button>
                        )}
                    </div>
                    {showHistory && postHistory.length > 0 && (
                        <div className="px-5 pb-4 max-h-48 overflow-y-auto">
                            <div className="space-y-2">
                                {postHistory.slice(0, 20).map(post => (
                                    <div key={post.id} className="flex items-center gap-3 text-sm bg-white p-3 rounded-xl border border-gray-100">
                                        <img src={post.imageUrl} alt="" className="w-10 h-10 object-cover rounded-lg" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold truncate">{post.articleTitle}</p>
                                            <p className="text-xs text-gray-500">
                                                {ANGLES.find(a => a.id === post.angle)?.label || post.angle}
                                                {' · '}
                                                {new Date(post.createdAt).toLocaleDateString('fr-FR')}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                                            post.posted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {post.posted ? 'Publié' : 'Brouillon'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
