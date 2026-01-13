import React from 'react';
import { X, ExternalLink, Puzzle, Download } from 'lucide-react';

const LinkedInGuideModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
                {/* Header */}
                <div className="bg-[#0077B5] px-6 py-4 flex justify-between items-center">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <span className="bg-white/20 p-1.5 rounded-lg">in</span>
                        Connect Professional Identity
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <p className="text-gray-600 text-sm">
                        Sync your Headline and Experience directly from LinkedIn using the Reflections Match Extension.
                    </p>

                    <div className="space-y-4">
                        {/* Step 1 */}
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0077B5] flex items-center justify-center font-bold shrink-0">
                                1
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-900 font-medium text-sm mb-1">Go to your LinkedIn Profile</p>
                                <p className="text-gray-500 text-xs">
                                    We will open your LinkedIn Profile in a new tab.
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0077B5] flex items-center justify-center font-bold shrink-0">
                                2
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-900 font-medium text-sm mb-1">Open the Extension</p>
                                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 flex items-center gap-3">
                                    <div className="bg-white p-1.5 rounded border border-gray-200 shadow-sm">
                                        <Puzzle size={16} className="text-gray-600" />
                                    </div>
                                    <span className="text-gray-500 text-xs">Click the extension icon in your browser toolbar.</span>
                                </div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0077B5] flex items-center justify-center font-bold shrink-0">
                                3
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-900 font-medium text-sm mb-1">Click "Sync Profile"</p>
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                                    <button className="bg-[#0077B5] text-white text-xs font-bold px-3 py-1.5 rounded shadow-sm pointer-events-none">
                                        Sync Profile to Reflections
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            window.open('https://www.linkedin.com/in/me/?reflections_sync=true', '_blank');
                            onClose();
                        }}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black transition-colors flex items-center gap-2"
                    >
                        Got it, I'm ready <ExternalLink size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LinkedInGuideModal;
