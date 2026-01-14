const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");
const { Resend } = require("resend");

admin.initializeApp();
const db = admin.firestore();

// Define Secrets
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const youtubeApiKey = defineSecret("YOUTUBE_API_KEY");
const resendApiKey = defineSecret("RESEND_API_KEY");

/**
 * Fetch reflections from the last 7 days for a user.
 */
async function fetchRecentReflections(uid) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const snapshot = await db.collection("reflections")
        .where("userId", "==", uid)
        .where("timestamp", ">=", sevenDaysAgo)
        .orderBy("timestamp", "desc")
        .get();

    return snapshot.docs.map(doc => doc.data());
}

/**
 * Search YouTube for videos based on keywords.
 */
async function searchYouTube(keywords, apiKey) {
    if (!apiKey) {
        console.warn("YouTube API Key missing.");
        return [];
    }

    const youtube = google.youtube({
        version: "v3",
        auth: apiKey,
    });

    const videos = [];
    // Take top 2 keywords to avoid quota limits
    const topKeywords = keywords.slice(0, 2);

    for (const { keyword, reason } of topKeywords) {
        try {
            const response = await youtube.search.list({
                part: "snippet",
                q: keyword,
                maxResults: 1,
                order: "viewCount",
                type: "video",
                publishedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
            });

            if (response.data.items.length > 0) {
                const item = response.data.items[0];
                videos.push({
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.high.url,
                    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                    reason: reason // Contextual reasoning from Gemini
                });
            }
        } catch (error) {
            console.error(`YouTube Search Error for ${keyword}:`, error);
        }
    }
    return videos;
}

/**
 * Generate Radar Content using Gemini.
 */
async function generateRadarContent(reflections, userTraits, apiKey) {
    if (reflections.length === 0) {
        throw new Error("No reflections found for analysis.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const reflectionText = reflections.map(r => `Date: ${r.timestamp.toDate().toDateString()}\nNotes: ${r.userNotes}\nSummary: ${r.aiSummary}`).join("\n\n");

    const prompt = `
    You are an advanced AI providing a weekly strategic briefing called "Reflections Radar".
    User Traits: ${userTraits}
    
    Reflections from past week:
    ${reflectionText}

    Task:
    1. Generate 3 distinct Radar Cards:
       - **Deep Dive**: A strategic analysis of the week's dominant theme.
       - **Wildcard**: An unexpected connection or latent pattern.
       - **Spark**: A creative idea or action for next week.
    2. Extract 3 Search Keywords for YouTube discovery based on high-interest topics.
    3. For each keyword, provide a 1-sentence "Contextual Reason" explaining why this specific topic matters to the user based on their traits (e.g., "This topic supports your [Trait] background").

    Output valid JSON:
    {
      "deepDive": { "title": "...", "content": "..." },
      "wildcard": { "title": "...", "content": "..." },
      "spark": { "title": "...", "content": "..." },
      "youtube": [
        { "keyword": "...", "reason": "..." },
        { "keyword": "...", "reason": "..." },
        { "keyword": "...", "reason": "..." }
      ]
    }
  `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // Cleanup markdown if present
    const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonText);
}

/**
 * Manual Trigger for Testing
 */
/**
 * Manual Trigger for Testing - REWRITTEN FOR STABILITY
 */
exports.triggerRadarManual = onCall({ secrets: [geminiApiKey, youtubeApiKey, resendApiKey] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const GEMINI_API_KEY = geminiApiKey.value();
    const YOUTUBE_API_KEY = youtubeApiKey.value();
    const RESEND_API_KEY = resendApiKey.value();

    const uid = request.auth.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();
    const userTraits = userData.aiPersona ? JSON.stringify(userData.aiPersona.traits) : "General User";

    try {
        console.log("Radar Step 1: Fetching reflections...");
        const reflections = await fetchRecentReflections(uid);
        if (reflections.length < 1) {
            return { status: "no-data", message: "Not enough reflections (need at least 1)." };
        }

        console.log("Radar Step 2: Synthesizing with Gemini...");
        const radarData = await generateRadarContent(reflections, userTraits, GEMINI_API_KEY);

        console.log("Radar Step 3: Searching YouTube...");
        const youtubeVideos = await searchYouTube(radarData.youtube, YOUTUBE_API_KEY);

        const radarEntry = {
            userId: uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            cards: {
                deepDive: radarData.deepDive,
                wildcard: radarData.wildcard,
                spark: radarData.spark
            },
            videos: youtubeVideos,
            type: "weekly_radar"
        };

        const docRef = await db.collection("weekly_radars").add(radarEntry);

        // --- PRODUCTION EMAIL LOGIC ---
        if (RESEND_API_KEY) {
            console.log("Radar Step 4: Initializing Resend...");
            const resend = new Resend(RESEND_API_KEY);

            const recipientEmail = request.auth.token.email;

            console.log(`Radar Step 5: Sending Production Email to ${recipientEmail}`);

            // WE ARE NOW USING YOUR VERIFIED DOMAIN
            const { data, error } = await resend.emails.send({
                from: 'Reflections Radar <radar@reflectionsmatch.com>', // MUST MATCH VERIFIED DOMAIN
                to: recipientEmail,
                subject: '🚀 Your Reflections Radar Briefing',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                        <h1 style="color: #4F46E5;">Reflections Radar</h1>
                        <h2 style="border-bottom: 2px solid #E5E7EB; padding-bottom: 10px;">${radarData.deepDive.title}</h2>
                        <p style="line-height: 1.6;">${radarData.deepDive.content}</p>
                        
                        <h2 style="border-bottom: 2px solid #E5E7EB; padding-bottom: 10px;">${radarData.wildcard.title}</h2>
                        <p style="line-height: 1.6;">${radarData.wildcard.content}</p>
                        
                        <h2 style="border-bottom: 2px solid #E5E7EB; padding-bottom: 10px;">${radarData.spark.title}</h2>
                        <p style="line-height: 1.6;">${radarData.spark.content}</p>
                        
                        <h3 style="margin-top: 30px; color: #6B7280;">Global Pulse Discovery</h3>
                        ${youtubeVideos.map(v => `
                            <div style="margin-bottom: 30px; border: 1px solid #F3F4F6; padding: 15px; border-radius: 12px;">
                                <a href="${v.url}"><img src="${v.thumbnail}" width="100%" style="border-radius: 8px;"/></a>
                                <p style="font-weight: bold; margin-top: 10px;">${v.title}</p>
                                <p style="font-size: 0.9em; color: #4B5563;"><i>AI Insight: ${v.reason}</i></p>
                            </div>
                        `).join('')}
                    </div>
                `
            });

            if (error) {
                console.error("RESEND PRODUCTION ERROR:", JSON.stringify(error));
            } else {
                console.log("RESEND PRODUCTION SUCCESS! ID:", data.id);
            }
        }
        return { status: "success", radarId: docRef.id, data: radarEntry };

        // ... existing code ...
    } catch (error) {
        console.error("CRITICAL RADAR ERROR:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * AI Goal Coaching Engine
 * Handles Roadmap Generation and Coaching Feedback
 */

const SYSTEM_INSTRUCTION = `
You are the Reflections Match AI, a "Context-Aware Accountability Partner."
*** CORE DIRECTIVE: THE TRUTH PROTOCOL *** You must strictly distinguish between USER FACTS (what is explicitly in the database) and AI SUGGESTIONS (your world knowledge and advice).

*** YOUR TWO MODES OF OPERATION ***

MODE 1: THE COURT REPORTER (Retrieval)

Trigger: When the user asks about their own history.

Rule: You must cite specific evidence from the provided context.

The "Silence" Clause: If the answer is not in the context, you MUST state: "I don't see a record of that in your reflections." Do NOT invent, guess, or hallucinate a memory.

MODE 2: THE STRATEGIC COACH (Synthesis)

Trigger: When the user asks for advice, ideas, or analysis.

Rule: Use user data as the ANCHOR, but use your general intelligence to build the BRIDGE.

Phrasing Requirement: Explicitly separate evidence from inference.

GOOD: "You mentioned X (Evidence). This suggests Y (Inference)."

BAD: "You are stuck because of Y." (Assumption).

*** TONE *** Empathetic but precise. You are a partner, not a sycophant. `;

exports.getGoalCoaching = onCall({ secrets: [geminiApiKey] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { type, pursuitId, goalTitle, goalDescription, updateText, existingRoadmap, isStuck, targetDate } = request.data;
    const apiKey = geminiApiKey.value();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: SYSTEM_INSTRUCTION
    });

    try {
        if (type === "INITIAL_PLAN") {
            const prompt = `
                CONTEXT DATA:
                Goal Title: "${goalTitle}"
                Goal Description: "${goalDescription}"
                ${targetDate ? `Target Date: ${targetDate}` : ""}

                TASK:
                You are an AI skills coach. Using the CONTEXT DATA above, help the user achieve this goal.
                Provide a structured JSON response containing:
                1. Quick Assessment
                2. Getting Started Checklist
                3. Learning Path
                4. First 2-Hour Sprint

                OUTPUT FORMAT (JSON ONLY, NO MARKDOWN):
                {
                    "assessment": "Brief assessment of why this matters and key challenges.",
                    "phases": [
                        { "phase": "1. Getting Started Checklist", "items": ["Critical setup step 1", "Critical setup step 2"] },
                        { "phase": "2. Strategic Learning Path", "items": ["Key Concept 1", "Key Resource 2"] },
                        { "phase": "3. The First 2-Hour Sprint", "items": ["0-30m: ...", "30-90m: ...", "90-120m: ..."] }
                    ]
                }
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();

            return { status: "success", data: JSON.parse(cleanJson) };
        }

        else if (type === "UPDATE_GOAL") {
            const prompt = `
                CONTEXT DATA:
                Goal Title: "${goalTitle}"
                User Update: "${updateText}"
                Is Stuck: ${isStuck}
                
                CURRENT ROADMAP CONTEXT:
                ${JSON.stringify(existingRoadmap || "No roadmap yet")}

                TASK:
                Acknowledge progress, solve blockers if stuck, and provide 2-3 immediate next steps.
                Keep it encouraging but disciplined.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const feedback = response.text();

            return { status: "success", data: { feedback } };
        }

        else {
            throw new HttpsError("invalid-argument", "Unknown action type.");
        }

    } catch (error) {
        console.error("Coaching Error:", error);
        throw new HttpsError("internal", error.message);
    }
});