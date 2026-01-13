import React, { useState } from 'react';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";

const LandingPage = () => {
    const [isLogin, setIsLogin] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const auth = getAuth();
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
            }
        } catch (err) {
            setError(err.message.replace("Firebase:", "").trim());
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-gray-900 font-sans selection:bg-blue-100">

            {/* NAVIGATION BAR */}
            <nav className="fixed top-0 w-full bg-transparent backdrop-blur-lg z-50">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 hover:opacity-80 transition cursor-pointer">
                        <div className="h-10 w-10 rounded-full overflow-hidden border border-white/20 shadow-sm relative">
                            <img
                                src="/logo-final.jpg"
                                alt="Reflections Match"
                                className="absolute inset-0 h-full w-full object-cover scale-150"
                            />
                        </div>
                        <span className="font-bold text-gray-700 tracking-tight hidden md:block">Reflections Match</span>
                    </div>
                    <div className="hidden md:flex gap-8 text-sm font-semibold text-gray-600">
                        <a href="#how-it-works" className="hover:text-blue-600 transition">How It Works</a>
                        <a href="#vision" className="hover:text-blue-600 transition">Vision</a>
                        <a href="mailto:support@reflectionsmatch.ai" className="hover:text-blue-600 transition">Contact Us</a>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION - Three Column Grid */}
            <div className="w-full max-w-[1400px] mx-auto px-6 pt-32 pb-24">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">

                    {/* COLUMN 1: Prominent Logo (Approx 3/12 width) */}
                    <div className="lg:col-span-3 flex justify-center lg:justify-start">
                        <img
                            src="/logo-final.jpg"
                            alt="Reflections Match Logo"
                            className="w-[260px] h-auto object-contain rounded-xl shadow-2xl ring-1 ring-gray-900/5 transition-transform hover:scale-105"
                        />
                    </div>

                    {/* COLUMN 2: Headline & Copy (Approx 5/12 width) */}
                    <div className="lg:col-span-5 text-center lg:text-left space-y-6 px-4">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-slate-900 tracking-tight">
                            The Internet is Noise. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 italic">Capture the Signal.</span>
                        </h1>

                        <p className="text-lg text-gray-600 leading-relaxed font-medium">
                            Most of what you browse is temporary. But sometimes, you find a <strong>Reflection</strong> of your interests or your future. Build a Digital Twin that mirrors who you actually are.
                        </p>
                    </div>

                    {/* COLUMN 3: Auth Card (Approx 4/12 width) */}
                    <div className="lg:col-span-4 flex justify-center lg:justify-end">
                        <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/50 ring-1 ring-gray-100">
                            <h2 className="text-xl font-bold mb-4 text-gray-800 tracking-tight">{isLogin ? "Welcome Back" : "Start Reflecting"}</h2>
                            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium">{error}</div>}
                            <form onSubmit={handleAuth} className="space-y-3">
                                {!isLogin && (
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 placeholder-gray-400 font-medium"
                                        placeholder="Your Name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                )}
                                <input
                                    type="email"
                                    required
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 placeholder-gray-400 font-medium"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <input
                                    type="password"
                                    required
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 placeholder-gray-400 font-medium"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button disabled={loading} className="w-full py-3 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-[0.98]">
                                    {loading ? "Processing..." : (isLogin ? "Log In" : "Unlock Your Free Account")}
                                </button>
                            </form>
                            <p className="text-center mt-4 text-sm text-gray-500 font-medium">
                                {isLogin ? "New here? " : "Already have a twin? "}
                                <button onClick={() => setIsLogin(!isLogin)} className="text-blue-600 font-bold hover:underline">
                                    {isLogin ? "Create Account" : "Log In"}
                                </button>
                            </p>
                        </div>
                    </div>

                </div>
            </div>

            {/* PHILOSOPHY BANNER - Dark Anchor */}
            <div id="how-it-works" className="bg-[#1a1b1e] text-white py-24 relative z-10">
                <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12">
                    <h2 className="text-2xl md:text-3xl font-bold italic w-full md:w-1/3 text-gray-400">
                        What is a Reflection?
                    </h2>
                    <div className="w-full md:w-2/3 space-y-8">
                        <p className="text-2xl md:text-3xl font-light leading-relaxed text-gray-200">
                            "A <strong className="text-white font-semibold">Reflection</strong> is something that matches you. Combined they form a powerful tool that can help you build your <span className="text-blue-400 font-bold">Knowledge, Interests, and Career.</span>"
                        </p>

                        <div id="vision" className="pt-12 border-t border-gray-800">
                            <h3 className="text-xl font-bold mb-2 text-white">"Your Network Should Be a Reflection of You."</h3>
                            <p className="text-gray-500 font-medium text-lg italic">Traditional networking matches job titles. We match minds.</p>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="py-8 text-center text-gray-500 text-xs font-semibold bg-[#1a1b1e] border-t border-gray-800">
                &copy; 2026 Reflections Match. Built for the modern mind.
            </footer>
        </div>
    );
};

export default LandingPage;
