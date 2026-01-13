import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker
// Using the UNPKG CDN aimed at the specific version installed by npm ensures compatibility without complex build config
export const parsePdf = async (file) => {
    try {
        // Initialize worker only when needed
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }
        return fullText;
    } catch (error) {
        console.error("PDF Parsing Error:", error);
        throw new Error("Failed to parse PDF file.");
    }
};

/**
 * Extracts text from a DOCX file.
 * @param {File} file 
 * @returns {Promise<string>}
 */
export const parseDocx = async (file) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    } catch (error) {
        console.error("DOCX Parsing Error:", error);
        throw new Error("Failed to parse DOCX file. Please ensure it is a valid .docx document.");
    }
};

/**
 * Reads text from a plain text file.
 * @param {File} file 
 * @returns {Promise<string>}
 */
export const parseTxt = async (file) => {
    return await file.text();
};
