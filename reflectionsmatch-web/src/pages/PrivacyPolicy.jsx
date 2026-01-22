import React from 'react';
import { Shield, Cookie, Lock, Database, Eye, Server, Mail } from 'lucide-react';

const PrivacyPolicy = () => {
    return (
        <div className="min-h-screen bg-white p-8 md:p-16">
            <div className="max-w-4xl mx-auto">
                <div className="mb-12 border-b pb-6">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        Privacy Policy & AI Disclosure
                    </h1>
                    <p className="text-gray-500">Last Updated: January 21, 2026</p>
                </div>

                <div className="prose prose-lg max-w-none text-gray-600 space-y-12">
                    <p className="lead text-xl">
                        Welcome to Reflections Match ("we," "our," or "us"). We are committed to protecting your privacy and ensuring transparency about how your data is processed, especially regarding our Artificial Intelligence (AI) features.
                    </p>
                    <p>
                        By using the Reflections Match Chrome Extension and Web Dashboard, you agree to the collection and use of information in accordance with this policy.
                    </p>

                    {/* Section 1 */}
                    <section className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <Database className="text-blue-600" size={28} />
                            <h2 className="text-2xl font-bold text-gray-900 m-0">1. Information We Collect</h2>
                        </div>
                        <p className="mb-4">We collect only the information necessary to provide our "Second Brain" and "Identity Engine" services:</p>
                        <ul className="list-disc pl-6 space-y-3">
                            <li><strong className="text-gray-900">Account Information:</strong> When you sign in via Google (Firebase Auth), we collect your email address and profile photo to manage your identity.</li>
                            <li><strong className="text-gray-900">Reflections (User Content):</strong> We store the text, images, and URLs you explicitly capture using our Chrome Extension or upload via the Dashboard.</li>
                            <li><strong className="text-gray-900">Professional Data:</strong> If you choose to sync your LinkedIn profile or upload a Resume, we store this data to build your "North Star" career context.</li>
                        </ul>
                    </section>

                    {/* Section 2 */}
                    <section className="bg-indigo-50 rounded-2xl p-8 border border-indigo-100">
                        <div className="flex items-center gap-3 mb-6">
                            <Shield className="text-indigo-600" size={28} />
                            <h2 className="text-2xl font-bold text-gray-900 m-0">2. AI Processing Disclosure (Gemini 2.0 Flash)</h2>
                        </div>
                        <p className="mb-4">Reflections Match utilizes advanced AI (Google Gemini 2.0 Flash) to synthesize your reflections and generate "Radar" discovery cards. We adhere to strict data boundaries:</p>
                        <ul className="list-disc pl-6 space-y-3">
                            <li className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm"><strong className="text-indigo-900">No Training on User Data:</strong> Your personal reflections, notes, and professional data are NEVER used to train or improve the underlying AI models. Your data remains yours.</li>
                            <li className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm"><strong className="text-indigo-900">Confidential Processing:</strong> All AI analysis is performed within a gated, secure environment. Your identity remains anonymous to the AI engine during processing.</li>
                            <li className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm"><strong className="text-indigo-900">Context-Aware Analysis:</strong> The AI accesses your data only to provide specific services to you, such as generating your Weekly Radar or answering Chat queries.</li>
                        </ul>
                    </section>

                    {/* Section 3 */}
                    <section className="bg-purple-50 rounded-2xl p-8 border border-purple-100">
                        <div className="flex items-center gap-3 mb-6">
                            <Eye className="text-purple-600" size={28} />
                            <h2 className="text-2xl font-bold text-gray-900 m-0">3. Contextual Advertising (Privacy-First)</h2>
                        </div>
                        <p className="mb-4">To support our free tier, we serve "Contextual Ads." We believe in advertising that respects your privacy:</p>
                        <ul className="list-disc pl-6 space-y-3">
                            <li><strong className="text-gray-900">No Behavioral Tracking:</strong> We do not use third-party cookies to build a profile of your behavior across other websites.</li>
                            <li><strong className="text-gray-900">Content-Only Targeting:</strong> Our system analyzes keywords in your current Radar briefing to select a relevant ad in real-time (e.g., if your topic is "Product Management," you may see an ad for a product tool).</li>
                            <li><strong className="text-gray-900">No Data Sale:</strong> We never sell, rent, or share your personal information (name, email, or private notes) with advertisers.</li>
                        </ul>
                    </section>

                    {/* Section 4 */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <Server className="text-gray-700" size={24} />
                            <h2 className="text-xl font-bold text-gray-900 m-0">4. Third-Party Services & Data Sharing</h2>
                        </div>
                        <p className="mb-4">We use trusted third-party infrastructure to power our service. Your data may pass through:</p>
                        <ul className="list-disc pl-6 space-y-2 text-base">
                            <li><strong>Google Firebase:</strong> For secure database hosting (Firestore), authentication, and file storage.</li>
                            <li><strong>Resend:</strong> To deliver your "Reflections Radar" email briefings. We share only your email address and the specific email content with Resend for delivery purposes.</li>
                            <li><strong>YouTube Data API:</strong> We use this API to suggest relevant video content based on your interests. We do not share your private reflection data with YouTube.</li>
                        </ul>
                    </section>

                    {/* Section 5 */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <Lock className="text-gray-700" size={24} />
                            <h2 className="text-xl font-bold text-gray-900 m-0">5. Data Security</h2>
                        </div>
                        <p className="mb-4">We implement industry-standard security measures to protect your data:</p>
                        <ul className="list-disc pl-6 space-y-2 text-base">
                            <li><strong>Encryption:</strong> All data is encrypted in transit and at rest via Google Cloud infrastructure.</li>
                            <li><strong>Secret Management:</strong> Sensitive API keys are stored in Google Cloud Secret Manager to prevent unauthorized access.</li>
                        </ul>
                    </section>

                    {/* Section 6 */}
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">6. Your Rights & Choices</h2>
                        <ul className="list-disc pl-6 space-y-2 text-base">
                            <li><strong>Opt-Out:</strong> You may opt out of AI processing or email communications at any time via the "Settings" toggle in your Profile.</li>
                            <li><strong>Unsubscribe:</strong> Every email we send includes a mandatory "Unsubscribe" link in the footer.</li>
                            <li><strong>Data Deletion:</strong> You may delete individual reflections or request full account deletion by contacting support.</li>
                        </ul>
                    </section>

                    {/* Section 7 */}
                    <section className="bg-gray-100 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Mail className="text-gray-700" size={24} />
                            <h2 className="text-xl font-bold text-gray-900 m-0">7. Contact Us</h2>
                        </div>
                        <p className="mb-2">If you have any questions about this Privacy Policy, please contact us at:</p>
                        <ul className="list-none space-y-1">
                            <li><strong>Email:</strong> info@ignitia-ai.com</li>
                            <li><strong>Entity:</strong> Ignitia-AI</li>
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
