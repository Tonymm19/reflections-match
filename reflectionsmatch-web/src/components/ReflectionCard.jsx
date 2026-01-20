import React, { useState } from 'react';
import { Quote, Sparkles, Trash2, Pencil, Check, X, ExternalLink, Zap, Compass, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ReflectionCard = ({ imageUrl, notes, timestamp, aiSummary, tags, isAnalyzing, onDelete, onUpdate, onUpdateNotes, sourceUrl, id, source, radarType, description, actionItem }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(aiSummary || "");

    const navigate = useNavigate();

    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [editedNotes, setEditedNotes] = useState(notes || "");

    // Format timestamp using seconds * 1000
    const dateStr = timestamp?.seconds
        ? new Date(timestamp.seconds * 1000).toLocaleDateString()
        : new Date().toLocaleDateString();

    const handleSave = () => {
        onUpdate(id, editedText);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedText(aiSummary || "");
        setIsEditing(false);
    };

    const handleEditClick = () => {
        setEditedText(aiSummary || "");
        setIsEditing(true);
    };

    const handleSaveNotes = () => {
        onUpdateNotes(id, editedNotes);
        setIsEditingNotes(false);
    };

    const handleCancelNotes = () => {
        setEditedNotes(notes || "");
        setIsEditingNotes(false);
    };

    const handleEditNotesClick = () => {
        setEditedNotes(notes || "");
        setIsEditingNotes(true);
    };

    if (source === 'radar') {
        let styleClass = "border-gray-200 border"; // Default border color
        let Icon = Sparkles;
        let badgeColor = "bg-gray-100 text-gray-600";

        if (radarType === 'Deep Dive') {
            styleClass = "border-blue-400 border-2 bg-gradient-to-br from-blue-50 to-white";
            Icon = Compass;
            badgeColor = "bg-blue-100 text-blue-700";
        } else if (radarType === 'Wildcard') {
            styleClass = "border-purple-400 border-2 bg-gradient-to-br from-purple-50 to-white";
            Icon = Zap;
            badgeColor = "bg-purple-100 text-purple-700";
        } else if (radarType === 'Spark') {
            styleClass = "border-orange-400 border-2 bg-gradient-to-br from-orange-50 to-white";
            Icon = Sparkles;
            badgeColor = "bg-orange-100 text-orange-700";
        }

        return (
            <div className={`rounded-xl shadow-md p-5 flex flex-col h-full hover:shadow-lg transition-all duration-300 relative group ${styleClass}`}>
                {/* Actions Container */}
                {/* Actions Container */}
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // Prevents bubbling
                            if (window.confirm("Delete this pursuit?")) {
                                onDelete(id);
                            }
                        }}
                        className="p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-gray-400 hover:text-red-500"
                        title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>

                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                        {radarType || "Radar"}
                    </span>
                    <Icon size={20} className="text-gray-400 opacity-50" />
                </div>

                {/* Title */}
                <h3
                    onClick={() => navigate('/radar')}
                    className="text-lg font-bold text-gray-900 mb-4 leading-snug cursor-pointer hover:text-brand transition-colors"
                >
                    {aiSummary || "Untitled Opportunity"}
                </h3>

                {/* Context Block */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Original Suggestion</p>
                    <p className="text-sm text-gray-600 italic leading-relaxed">
                        {description || actionItem || "No details provided."}
                    </p>
                </div>

                {/* User Notes */}
                <div className="flex-1 relative group/notes">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase">My Progress</h4>
                        {!isEditingNotes && (
                            <button
                                onClick={handleEditNotesClick}
                                className="text-gray-400 hover:text-brand opacity-0 group-hover/notes:opacity-100 transition-opacity"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {isEditingNotes ? (
                        <div className="relative z-0">
                            <textarea
                                value={editedNotes}
                                onChange={(e) => setEditedNotes(e.target.value)}
                                className="w-full p-2 text-sm text-gray-700 border border-brand/30 rounded focus:outline-none focus:border-brand bg-white min-h-[80px] resize-y"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={handleCancelNotes} className="p-1 hover:bg-gray-100 rounded text-red-500">
                                    <X className="w-4 h-4" />
                                </button>
                                <button onClick={handleSaveNotes} className="p-1 hover:bg-gray-100 rounded text-green-600">
                                    <Check className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-800 leading-relaxed min-h-[20px]">
                            {notes ? notes : <span className="text-gray-400 italic">No notes yet. Click pencil to add.</span>}
                        </p>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-[10px] text-gray-400">{dateStr}</span>
                    <button
                        onClick={() => navigate('/radar')}
                        className="text-indigo-600 font-medium text-xs hover:underline flex items-center gap-1"
                    >
                        View on Radar <ArrowUpRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 border border-gray-100 flex flex-col h-full group relative">
            {imageUrl && (
                <div className="w-full h-48 bg-gray-200 overflow-hidden relative">
                    {sourceUrl ? (
                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                            <img
                                src={imageUrl}
                                alt="Reflection"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        </a>
                    ) : (
                        <img
                            src={imageUrl}
                            alt="Reflection"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    )}
                    {isAnalyzing && (
                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 animate-pulse">
                            <Sparkles className="w-3 h-3 text-yellow-300" />
                            <span>Analyzing...</span>
                        </div>
                    )}
                </div>
            )}

            {/* Delete Button */}
            {!isEditing && (
                <button
                    onClick={() => onDelete(id)}
                    className="absolute top-2 right-2 bg-white/90 p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-50 text-gray-500 hover:text-red-500 z-10"
                    title="Delete Reflection"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}

            <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div className="inline-block bg-gray-100 rounded-full px-3 py-1 text-gray-600 text-xs font-medium self-start">
                        Captured: {dateStr}
                    </div>
                    {sourceUrl && (
                        <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-brand transition-colors p-1"
                            title="Open Source URL"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                </div>

                {/* User Notes Section */}
                {(notes || isEditingNotes) && (
                    <div className="mb-6 relative group/notes">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">My Thoughts</h4>

                        {isEditingNotes ? (
                            <div className="relative z-0">
                                <textarea
                                    value={editedNotes}
                                    onChange={(e) => setEditedNotes(e.target.value)}
                                    className="w-full p-2 text-sm text-gray-700 border border-brand/30 rounded focus:outline-none focus:border-brand bg-gray-50 min-h-[100px] resize-y border-b-4 border-b-gray-200 hover:border-b-brand/50 transition-colors"
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={handleCancelNotes} className="p-1 hover:bg-gray-100 rounded text-red-500" title="Cancel">
                                        <X className="w-5 h-5" />
                                    </button>
                                    <button onClick={handleSaveNotes} className="p-1 hover:bg-gray-100 rounded text-green-600" title="Save">
                                        <Check className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <p className="text-gray-700 text-sm leading-relaxed border-l-2 border-gray-200 pl-3 pr-6">
                                    {notes}
                                </p>
                                <button
                                    onClick={handleEditNotesClick}
                                    className="absolute -top-1 right-0 p-1 text-gray-400 hover:text-brand opacity-0 group-hover/notes:opacity-100 transition-opacity"
                                    title="Edit Notes"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* AI Summary Section (Editable) */}
                <div className="relative mb-4 flex-1">
                    <h4 className="text-xs font-bold text-brand uppercase mb-2 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI Analysis
                    </h4>

                    {isEditing ? (
                        <div className="relative z-0">
                            <textarea
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                className="w-full p-2 text-sm text-gray-700 border border-brand/30 rounded focus:outline-none focus:border-brand bg-gray-50 min-h-[150px] resize-y border-b-4 border-b-gray-200 hover:border-b-brand/50 transition-colors"
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={handleCancel} className="p-1 hover:bg-gray-100 rounded text-red-500" title="Cancel">
                                    <X className="w-5 h-5" />
                                </button>
                                <button onClick={handleSave} className="p-1 hover:bg-gray-100 rounded text-green-600" title="Save">
                                    <Check className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="group/edit relative min-h-[60px]">
                            <p className="text-gray-700 leading-relaxed text-sm italic pl-2 border-l-2 border-brand/30 pr-6">
                                {aiSummary || "Generating analysis..."}
                            </p>
                            {/* Edit Button */}
                            <button
                                onClick={handleEditClick}
                                className="absolute -top-1 right-0 p-1 text-gray-400 hover:text-brand opacity-0 group-hover/edit:opacity-100 transition-opacity"
                                title="Edit Summary"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {tags && tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-gray-100">
                        {tags.map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-50 text-brand text-xs rounded-full font-medium">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReflectionCard;
