import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

export class PdfService {
    /**
     * Merges multiple PDF files into a single file
     * @param pdfPaths Array of paths to PDF files
     * @returns Path to the merged PDF
     */
    public async mergePdfs(pdfPaths: string[]): Promise<string> {
        try {
            // Create a new PDF document
            const mergedPdf = await PDFDocument.create();
            
            // For each PDF path
            for (const pdfPath of pdfPaths) {
                // Read the PDF file
                const pdfBytes = await fs.promises.readFile(pdfPath);
                
                // Load the PDF document
                const pdfDoc = await PDFDocument.load(pdfBytes);
                
                // Copy all pages from the document
                const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                
                // Add each page to the merged document
                copiedPages.forEach(page => {
                    mergedPdf.addPage(page);
                });
            }
            
            // Save the merged PDF
            const mergedPdfBytes = await mergedPdf.save();
            
            // Generate output filename based on the first PDF name with "_merged" suffix
            const baseDir = path.dirname(pdfPaths[0]);
            const baseName = path.basename(pdfPaths[0], '.pdf');
            const outputPath = path.join(baseDir, `${baseName}_merged.pdf`);
            
            // Write the merged PDF to disk
            await fs.promises.writeFile(outputPath, mergedPdfBytes);
            
            return outputPath;
        } catch (error) {
            console.error("Error merging PDFs:", error);
            throw new Error(`Failed to merge PDFs: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Splits a PDF file into multiple PDFs based on page ranges
     * @param pdfPath Path to the PDF file to split
     * @param pageRanges Array of page ranges like [{ start: 1, end: 3 }]
     * @returns Array of paths to split PDFs
     */
    public async splitPdf(pdfPath: string, pageRanges: { start: number; end: number; }[]): Promise<string[]> {
        try {
            // Read the PDF file
            const pdfBytes = await fs.promises.readFile(pdfPath);
            
            // Load the PDF document
            const pdfDoc = await PDFDocument.load(pdfBytes);
            
            const outputPaths: string[] = [];
            
            // For each page range
            for (let i = 0; i < pageRanges.length; i++) {
                const range = pageRanges[i];
                
                // Create a new PDF document for this range
                const newPdf = await PDFDocument.create();
                
                // Ensure page indexes are zero-based
                const zeroBasedStart = range.start - 1;
                const zeroBasedEnd = range.end - 1;
                
                // Copy the pages in the range
                const pages = [];
                for (let j = zeroBasedStart; j <= zeroBasedEnd; j++) {
                    if (j >= 0 && j < pdfDoc.getPageCount()) {
                        pages.push(j);
                    }
                }
                
                // Copy the pages from the original document
                const copiedPages = await newPdf.copyPages(pdfDoc, pages);
                
                // Add each page to the new document
                copiedPages.forEach(page => {
                    newPdf.addPage(page);
                });
                
                // Save the new PDF
                const newPdfBytes = await newPdf.save();
                
                // Generate output filename
                const baseDir = path.dirname(pdfPath);
                const baseName = path.basename(pdfPath, '.pdf');
                const outputPath = path.join(baseDir, `${baseName}_${range.start}-${range.end}.pdf`);
                
                // Write the new PDF to disk
                await fs.promises.writeFile(outputPath, newPdfBytes);
                
                outputPaths.push(outputPath);
            }
            
            return outputPaths;
        } catch (error) {
            console.error("Error splitting PDF:", error);
            throw new Error(`Failed to split PDF: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}