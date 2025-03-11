import * as vscode from 'vscode';
import * as path from 'path';
import { PdfService } from './pdfService';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "pdf-powertools" is now active!');

    const pdfService = new PdfService();

    // Hello command (original)
    const helloDisposable = vscode.commands.registerCommand('pdf-powertools.hello', () => {
        vscode.window.showInformationMessage('Hello from PDF PowerTools!');
    });

    // Merge PDFs command
    const mergeDisposable = vscode.commands.registerCommand('pdf-powertools.mergePdfs', async () => {
        try {
            // Ask user to select multiple PDF files
            const pdfUris = await vscode.window.showOpenDialog({
                canSelectMany: true,
                filters: { 'PDF Files': ['pdf'] },
                title: 'Select PDFs to Merge'
            });

            if (!pdfUris || pdfUris.length < 2) {
                vscode.window.showInformationMessage('Please select at least two PDF files to merge.');
                return;
            }

            // Get file paths
            const pdfPaths = pdfUris.map(uri => uri.fsPath);

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Merging PDFs',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                
                // Merge the PDFs
                const outputPath = await pdfService.mergePdfs(pdfPaths);
                
                progress.report({ increment: 100 });
                
                const openButton = 'Open';
                const result = await vscode.window.showInformationMessage(
                    `PDFs merged successfully! Output saved to: ${path.basename(outputPath)}`, 
                    openButton
                );
                
                if (result === openButton) {
                    // Open the merged PDF with the default application
                    const uri = vscode.Uri.file(outputPath);
                    vscode.env.openExternal(uri);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error merging PDFs: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    // Split PDF command
    const splitDisposable = vscode.commands.registerCommand('pdf-powertools.splitPdf', async () => {
        try {
            // Ask user to select a PDF file
            const pdfUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'PDF Files': ['pdf'] },
                title: 'Select PDF to Split'
            });

            if (!pdfUris || pdfUris.length === 0) {
                return;
            }

            const pdfPath = pdfUris[0].fsPath;

            // Ask user for page ranges
            const rangeInput = await vscode.window.showInputBox({
                prompt: 'Enter page ranges to split (e.g., "1-3, 4-6" or "1-1, 2-2" for single pages)',
                placeHolder: '1-3, 4-6, 7-10',
                validateInput: (input) => {
                    // Simple validation for the format
                    if (!/^(\d+-\d+)(,\s*\d+-\d+)*$/.test(input)) {
                        return 'Please use the format "1-3, 4-6, 7-10"';
                    }
                    return null;
                }
            });

            if (!rangeInput) {
                return;
            }

            // Parse the page ranges
            const pageRanges = rangeInput.split(',').map(range => {
                const [start, end] = range.trim().split('-').map(Number);
                return { start, end };
            });

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Splitting PDF',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                
                // Split the PDF
                const outputPaths = await pdfService.splitPdf(pdfPath, pageRanges);
                
                progress.report({ increment: 100 });
                
                const openFolderButton = 'Open Folder';
                const result = await vscode.window.showInformationMessage(
                    `PDF split successfully into ${outputPaths.length} files!`,
                    openFolderButton
                );
                
                if (result === openFolderButton) {
                    // Open the folder containing the split PDFs
                    const folderUri = vscode.Uri.file(path.dirname(outputPaths[0]));
                    vscode.env.openExternal(folderUri);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error splitting PDF: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(helloDisposable, mergeDisposable, splitDisposable);
}

export function deactivate() {}
