import React from 'react';

const FeatureCard = ({ emoji, title, description }) => (
    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
        <div className="text-4xl mb-4 text-center">{emoji}</div>
        <h3 className="text-xl font-bold text-slate-900 mb-2 text-center">{title}</h3>
        <div className="text-slate-600 leading-relaxed flex-1">{description}</div>
    </div>
);

const About = () => {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Hero Section */}
            <section className="max-w-5xl mx-auto px-6 py-12 text-center">
                <h1 className="text-5xl font-black tracking-tight text-slate-900 mb-4">
                    Your Identity is an <span className="text-teal-600">Asset.</span>
                </h1>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                    Reflections Match is a private space where your daily thoughts evolve into a professional compass.
                </p>
            </section>

            {/* The Flywheel Section */}
            <section className="max-w-6xl mx-auto px-6 py-8">
                <div className="grid md:grid-cols-3 gap-8">
                    <FeatureCard
                        emoji="🧠"
                        title="1. Reflect"
                        description={
                            <ul className="list-disc pl-5 space-y-2 mt-2">
                                <li><strong>Zero-UI Capture:</strong> Save insights from anywhere with one click.</li>
                                <li><strong>Pattern Recognition:</strong> AI connects the dots between your scattered notes.</li>
                            </ul>
                        }
                    />
                    <FeatureCard
                        emoji="📡"
                        title="2. Radar"
                        description={
                            <ul className="list-disc pl-5 space-y-2 mt-2">
                                <li><strong>Contextual Intelligence:</strong> Recommendations based on your active goals, not just history.</li>
                                <li><strong>Multimodal Scan:</strong> We analyze video, audio, and code to find the best resources.</li>
                            </ul>
                        }
                    />
                    <FeatureCard
                        emoji="🎯"
                        title="3. Pursue"
                        description={
                            <ul className="list-disc pl-5 space-y-2 mt-2">
                                <li><strong>Momentum Sprints:</strong> Broken down into 2-hour actionable tasks.</li>
                                <li><strong>Adaptive Persona:</strong> A coach that adjusts its tone to your current mood.</li>
                            </ul>
                        }
                    />
                </div>
            </section>

            {/* The Science of Growth Section */}
            <section className="max-w-4xl mx-auto px-6 py-12 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">The 60/40 Partnership</h2>
                <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
                    We believe AI should be an engine, not a replacement. Our system handles the heavy lifting of data synthesis, pattern recognition, and resource curation (the 60%), freeing you to focus entirely on the creative decision-making, deep learning, and strategic execution (the 40%) that machines cannot replicate.
                </p>
            </section>

            {/* Privacy Section */}
            <section className="max-w-5xl mx-auto px-6 py-12">
                <div className="bg-teal-900 text-white rounded-3xl p-10 md:p-12 shadow-xl">
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Privacy by Design</h2>
                            <p className="opacity-80 text-lg">Your data is your own.</p>
                        </div>
                        <div className="space-y-6 opacity-90 text-sm md:text-base bg-white/5 p-6 rounded-xl border border-white/10">
                            <p><strong>Contextual Ads:</strong> Free tier ads are based on the topic you view, never your personal identity. Premium members enjoy an ad-free experience.</p>
                            <p><strong>Secure Processing:</strong> Powered by Gemini 2.0 Flash. Your private notes are never used to train base models.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default About;
