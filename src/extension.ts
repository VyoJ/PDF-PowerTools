import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { PDFDocument } from "pdf-lib";
import { PdfService } from "./pdfService";
import { PdfFilesProvider, PdfOperationsProvider } from "./pdfExplorer";

export function activate(context: vscode.ExtensionContext) {
  const pdfService = new PdfService();

  // Create and register the PDF files tree view provider
  const pdfFilesProvider = new PdfFilesProvider(context);
  const pdfFilesTreeView = vscode.window.createTreeView("pdf-files", {
    treeDataProvider: pdfFilesProvider,
    showCollapseAll: false,
  });

  // Create and register the PDF operations tree view provider
  const pdfOperationsProvider = new PdfOperationsProvider();
  const pdfOperationsTreeView = vscode.window.createTreeView("pdf-operations", {
    treeDataProvider: pdfOperationsProvider,
    showCollapseAll: false,
  });

  // Register commands for the side panel
  const addPdfFilesCommand = vscode.commands.registerCommand(
    "pdf-powertools.addPdfFiles",
    async () => {
      try {
        // Ask user to select PDF files
        const pdfUris = await vscode.window.showOpenDialog({
          canSelectMany: true,
          filters: { "PDF Files": ["pdf"] },
          title: "Select PDFs to Add",
        });

        if (!pdfUris || pdfUris.length === 0) {
          return;
        }

        // Add selected PDFs to the tree view
        pdfUris.forEach((uri) => pdfFilesProvider.addPdfFile(uri.fsPath));

        vscode.window.showInformationMessage(
          `Added ${pdfUris.length} PDF file(s) to the workspace.`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error adding PDF files: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  );

  const refreshPdfFilesCommand = vscode.commands.registerCommand(
    "pdf-powertools.refreshPdfFiles",
    () => {
      pdfFilesProvider.refresh();
    }
  );

  const removePdfFileCommand = vscode.commands.registerCommand(
    "pdf-powertools.removePdfFile",
    (item) => {
      if (item && item.filePath) {
        pdfFilesProvider.removePdfFile(item.filePath);
        vscode.window.showInformationMessage(
          `Removed PDF file: ${path.basename(item.filePath)}`
        );
      }
    }
  );

  // Simple command to preview PDF file using system PDF viewer
  const previewPdfFileCommand = vscode.commands.registerCommand(
    "pdf-powertools.previewPdfFile",
    (filePath) => {
      // If filePath is a string, it's coming directly from a command
      // If it's an object, it's coming from the tree item
      const pdfPath =
        typeof filePath === "string" ? filePath : filePath.filePath;

      if (fs.existsSync(pdfPath)) {
        // Open the PDF in the system's default PDF viewer
        vscode.env.openExternal(vscode.Uri.file(pdfPath));
      } else {
        vscode.window.showErrorMessage(`File not found: ${pdfPath}`);
      }
    }
  );

  // Merge PDFs command
  const mergeDisposable = vscode.commands.registerCommand(
    "pdf-powertools.mergePdfs",
    async () => {
      try {
        // Get files from the explorer or prompt if none
        let pdfPaths = pdfFilesProvider.getPdfFiles();

        if (pdfPaths.length < 2) {
          // If not enough files in the explorer, show open dialog
          const pdfUris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: { "PDF Files": ["pdf"] },
            title: "Select PDFs to Merge",
          });

          if (!pdfUris || pdfUris.length < 2) {
            vscode.window.showInformationMessage(
              "Please select at least two PDF files to merge."
            );
            return;
          }

          pdfPaths = pdfUris.map((uri) => uri.fsPath);
        }

        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Merging PDFs",
            cancellable: false,
          },
          async (progress) => {
            progress.report({ increment: 0 });

            // Merge the PDFs
            const outputPath = await pdfService.mergePdfs(pdfPaths);

            progress.report({ increment: 100 });

            const openButton = "Open";
            const result = await vscode.window.showInformationMessage(
              `PDFs merged successfully! Output saved to: ${path.basename(
                outputPath
              )}`,
              openButton
            );

            if (result === openButton) {
              // Open the merged PDF with the default system application
              vscode.env.openExternal(vscode.Uri.file(outputPath));
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error merging PDFs: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  );

  // Split PDF command
  const splitDisposable = vscode.commands.registerCommand(
    "pdf-powertools.splitPdf",
    async () => {
      try {
        // Get first file from the explorer or prompt if none
        const explorerFiles = pdfFilesProvider.getPdfFiles();
        let pdfPath = "";

        if (explorerFiles.length === 0) {
          // If no files in the explorer, show open dialog
          const pdfUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { "PDF Files": ["pdf"] },
            title: "Select PDF to Split",
          });

          if (!pdfUris || pdfUris.length === 0) {
            return;
          }

          pdfPath = pdfUris[0].fsPath;
        } else {
          // If there are files in the explorer, let the user choose one
          if (explorerFiles.length === 1) {
            pdfPath = explorerFiles[0];
          } else {
            // If multiple files, let the user pick one
            const fileNames = explorerFiles.map((file) => path.basename(file));
            const selectedFileName = await vscode.window.showQuickPick(
              fileNames,
              {
                placeHolder: "Select a PDF file to split",
              }
            );

            if (!selectedFileName) {
              return;
            }

            pdfPath = explorerFiles[fileNames.indexOf(selectedFileName)];
          }
        }

        // Load the PDF to get page count before asking for ranges
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Loading PDF",
            cancellable: false,
          },
          async (progress) => {
            try {
              // Read the PDF file and get page count
              const pdfBytes = await fs.promises.readFile(pdfPath);
              if (pdfBytes.length > 100 * 1024 * 1024) {
                // For PDFs > 100MB
                vscode.window.showWarningMessage(
                  "Processing large PDF file. This may take some time."
                );
              }

              const pdfDoc = await PDFDocument.load(pdfBytes);
              const pageCount = pdfDoc.getPageCount();

              if (pageCount > 5000) {
                vscode.window.showWarningMessage(
                  "Processing PDFs with many pages may be slow"
                );
              }

              // Ask user for page ranges with validation
              const rangeInput = await vscode.window.showInputBox({
                prompt: `Enter page ranges to split (e.g., "1-3, 4-6") - PDF has ${pageCount} pages`,
                placeHolder: "1-3, 4-6, 7-10",
                validateInput: (input) => {
                  // Format validation
                  if (!/^(\d+-\d+)(,\s*\d+-\d+)*$/.test(input)) {
                    return 'Please use the format "1-3, 4-6, 7-10"';
                  }

                  // Page range validation
                  const ranges = input.split(",");
                  for (const range of ranges) {
                    const [start, end] = range.trim().split("-").map(Number);
                    if (start < 1 || end > pageCount) {
                      return `Page range ${start}-${end} is invalid. PDF has pages 1-${pageCount}`;
                    }
                    if (start > end) {
                      return `Invalid range: ${start}-${end}. Start page must be less than or equal to end page`;
                    }
                  }

                  return null;
                },
              });

              if (!rangeInput) {
                return;
              }

              // Parse the page ranges
              const pageRanges = rangeInput.split(",").map((range) => {
                const [start, end] = range.trim().split("-").map(Number);
                return { start, end };
              });

              // Process the split operation
              progress.report({ message: "Splitting PDF...", increment: 0 });

              // Split the PDF
              const outputPaths = await pdfService.splitPdf(
                pdfPath,
                pageRanges
              );

              progress.report({ increment: 100 });

              // Add the newly created PDFs to the tree view
              outputPaths.forEach((path) => pdfFilesProvider.addPdfFile(path));

              const openFolderButton = "Open Folder";
              const openFilesButton = "Open PDFs";
              const result = await vscode.window.showInformationMessage(
                `PDF split successfully into ${outputPaths.length} files!`,
                openFolderButton,
                openFilesButton
              );

              if (result === openFolderButton) {
                // Open the folder containing the split PDFs
                vscode.env.openExternal(
                  vscode.Uri.file(path.dirname(outputPaths[0]))
                );
              } else if (result === openFilesButton) {
                // Open each split PDF file
                outputPaths.forEach((filePath) => {
                  vscode.env.openExternal(vscode.Uri.file(filePath));
                });
              }
            } catch (error) {
              vscode.window.showErrorMessage(
                `Error processing PDF: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error splitting PDF: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  );

  // Simple preview command that opens files in system PDF viewer
  const previewDisposable = vscode.commands.registerCommand(
    "pdf-powertools.openPdfPreview",
    async () => {
      try {
        // Get files from the explorer or prompt if none
        let pdfPaths = pdfFilesProvider.getPdfFiles();

        if (pdfPaths.length === 0) {
          // If no files in the explorer, show open dialog
          const pdfUris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: { "PDF Files": ["pdf"] },
            title: "Select PDFs to Preview",
          });

          if (!pdfUris || pdfUris.length === 0) {
            return;
          }

          pdfPaths = pdfUris.map((uri) => uri.fsPath);

          // Add these files to the explorer for future use
          pdfUris.forEach((uri) => pdfFilesProvider.addPdfFile(uri.fsPath));
        }

        // Open each PDF with the system's default PDF viewer
        pdfPaths.forEach((pdfPath) => {
          vscode.env.openExternal(vscode.Uri.file(pdfPath));
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error opening PDF files: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  );

  // Register all commands and views
  context.subscriptions.push(
    pdfFilesTreeView,
    pdfOperationsTreeView,
    addPdfFilesCommand,
    refreshPdfFilesCommand,
    removePdfFileCommand,
    previewPdfFileCommand,
    vscode.commands.registerCommand("pdf-powertools.hello", () => {
      vscode.window.showInformationMessage("Hello from PDF PowerTools!");
    }),
    mergeDisposable,
    splitDisposable,
    previewDisposable
  );
}

export function deactivate() {}
