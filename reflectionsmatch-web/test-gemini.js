// Simple script to test the Gemini API Key
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = 'AIzaSyBGy5jRU5ic7kYJVJT3Hc5cLr9nLAkRrFA';
const genAI = new GoogleGenerativeAI(API_KEY, { apiVersion: 'v1' });

async function testConnection() {
    console.log("Testing API Key:", API_KEY.substring(0, 10) + "...");

    try {
        console.log("Getting model gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        console.log("Generating content...");
        const result = await model.generateContent("Hello, can you hear me? Respond in JSON.");
        const response = await result.response;
        const text = response.text();
        console.log("Success! Response:", text);
    } catch (e) {
        console.error("Generation failed:", e.message);
        if (e.response) {
            // e.response might be a fetch Response in some SDK versions, or parsing error
            console.error("Error details:", e.response);
        }
    }
}

testConnection();
