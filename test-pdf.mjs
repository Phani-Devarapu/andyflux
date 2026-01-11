// Quick test to see what text is extracted from sample.pdf
import * as pdfjsLib from 'pdfjs-dist';
import * as fs from 'fs';

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

async function testPDF() {
    const data = new Uint8Array(fs.readFileSync('sample.pdf'));
    const doc = await pdfjsLib.getDocument({ data }).promise;

    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(' ');
        fullText += pageText + '\n';
    }

    console.log('=== EXTRACTED TEXT (first 2000 chars) ===');
    console.log(fullText.substring(0, 2000));
    console.log('\n=== LOOKING FOR TRANSACTION PATTERNS ===');

    // Test NBC pattern
    const nbcPattern = /(\d{2})\s+(\d{2})\s+\|\s+[A-Z0-9]+\s+\|\s+(\d{2})\s+(\d{2})\s+\|\s+(.+?)\s+\|\s+([\d,]+\.\d{2})/g;
    const matches = fullText.match(nbcPattern);
    console.log('NBC pattern matches:', matches ? matches.length : 0);

    if (matches) {
        console.log('First match:', matches[0]);
    }
}

testPDF().catch(console.error);
