import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { PdfService } from "./pdfService";
import { PdfFilesProvider, PdfOperationsProvider } from "./pdfExplorer";

// Add this class to handle the webview
class PdfPreviewPanel {
  public static currentPanel: PdfPreviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private _disposables: vscode.Disposable[] = [];
  private _pdfService: PdfService;
  private _pdfPaths: string[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionPath: string,
    pdfPaths: string[]
  ) {
    this._panel = panel;
    this._extensionPath = extensionPath;
    this._pdfPaths = pdfPaths;
    this._pdfService = new PdfService();

    // Set initial content
    this._update();

    // Listen for panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "merge":
            try {
              const selectedPaths = message.pdfPaths;
              if (selectedPaths.length < 2) {
                vscode.window.showErrorMessage(
                  "Please select at least two PDFs to merge."
                );
                return;
              }

              const outputPath = await this._pdfService.mergePdfs(
                selectedPaths
              );

              const openButton = "Open";
              const result = await vscode.window.showInformationMessage(
                `PDFs merged successfully! Output saved to: ${path.basename(
                  outputPath
                )}`,
                openButton
              );

              if (result === openButton) {
                vscode.env.openExternal(vscode.Uri.file(outputPath));
              }
            } catch (error) {
              vscode.window.showErrorMessage(
                `Error merging PDFs: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
            break;

          case "split":
            try {
              const pdfPath = message.pdfPath;
              const pageRanges = message.pageRanges;

              const outputPaths = await this._pdfService.splitPdf(
                pdfPath,
                pageRanges
              );

              const openFolderButton = "Open Folder";
              const result = await vscode.window.showInformationMessage(
                `PDF split successfully into ${outputPaths.length} files!`,
                openFolderButton
              );

              if (result === openFolderButton) {
                vscode.env.openExternal(
                  vscode.Uri.file(path.dirname(outputPaths[0]))
                );
              }
            } catch (error) {
              vscode.window.showErrorMessage(
                `Error splitting PDF: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(extensionPath: string, pdfPaths: string[]) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (PdfPreviewPanel.currentPanel) {
      PdfPreviewPanel.currentPanel._panel.reveal(column);
      PdfPreviewPanel.currentPanel._pdfPaths = pdfPaths;
      PdfPreviewPanel.currentPanel._update();
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      "pdfPreview",
      "PDF Preview",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionPath, "media")),
        ],
        retainContextWhenHidden: true,
      }
    );

    PdfPreviewPanel.currentPanel = new PdfPreviewPanel(
      panel,
      extensionPath,
      pdfPaths
    );
  }

  public dispose() {
    PdfPreviewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _update() {
    this._panel.title = "PDF Preview";
    this._panel.webview.html = this._getWebviewContent();
  }

  private _getWebviewContent() {
    // Create base64 representations of the PDF files for embedding
    const pdfPreviews = this._pdfPaths
      .map((pdfPath, index) => {
        try {
          const pdfData = fs.readFileSync(pdfPath);
          const base64Data = pdfData.toString("base64");
          const fileName = path.basename(pdfPath);
          return {
            path: pdfPath,
            name: fileName,
            data: base64Data,
            index,
          };
        } catch (error) {
          console.error(`Error reading PDF file ${pdfPath}:`, error);
          return null;
        }
      })
      .filter(Boolean);

    // Get the URIs for local PDF.js files
    const pdfJsUri = this._getPdfJsUri();
    const pdfJsWorkerUri = this._getPdfJsWorkerUri();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PDF Preview</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
          <script>
              // Set the PDF.js worker source
              pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
          </script>
          <style>
              /* Your existing CSS here */
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                  padding: 0;
                  margin: 0;
                  color: var(--vscode-foreground);
                  background-color: var(--vscode-editor-background);
              }
              .container {
                  display: flex;
                  height: 100vh;
              }
              .sidebar {
                  width: 250px;
                  border-right: 1px solid var(--vscode-panel-border);
                  padding: 10px;
                  overflow-y: auto;
              }
              .preview-area {
                  flex: 1;
                  padding: 20px;
                  overflow-y: auto;
              }
              .pdf-item {
                  padding: 8px;
                  margin-bottom: 5px;
                  border-radius: 4px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
              }
              .pdf-item:hover {
                  background-color: var(--vscode-list-hoverBackground);
              }
              .pdf-item.selected {
                  background-color: var(--vscode-list-activeSelectionBackground);
                  color: var(--vscode-list-activeSelectionForeground);
              }
              .pdf-item input {
                  margin-right: 8px;
              }
              .action-buttons {
                  margin-top: 20px;
                  display: flex;
                  flex-direction: column;
                  gap: 10px;
              }
              button {
                  padding: 8px 12px;
                  background-color: var(--vscode-button-background);
                  color: var(--vscode-button-foreground);
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
              }
              button:hover {
                  background-color: var(--vscode-button-hoverBackground);
              }
              button:disabled {
                  opacity: 0.6;
                  cursor: not-allowed;
              }
              .page-controls {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 16px 0;
                  gap: 16px;
                  font-size: 13px;
              }
              .icon-button {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 28px;
                  height: 28px;
                  border-radius: 4px;
                  background-color: var(--vscode-button-secondaryBackground, rgba(0,0,0,0.1));
                  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
                  cursor: pointer;
                  border: none;
                  padding: 4px;
              }
              .icon-button:hover:not(:disabled) {
                  background-color: var(--vscode-button-secondaryHoverBackground, rgba(0,0,0,0.2));
              }
              .icon-button:disabled {
                  opacity: 0.4;
                  cursor: not-allowed;
              }
              #page-info {
                  min-width: 100px;
                  text-align: center;
                  font-variant-numeric: tabular-nums;
              }
              .canvas-container {
                  display: flex;
                  justify-content: center;
                  margin-bottom: 20px;
              }
              canvas {
                  border: 1px solid var(--vscode-panel-border);
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .modal {
                  display: none;
                  position: fixed;
                  z-index: 10;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
                  background-color: rgba(0,0,0,0.5);
                  backdrop-filter: blur(3px);
              }
              .modal-content {
                  background-color: var(--vscode-editor-background);
                  margin: 10% auto;
                  padding: 24px;
                  border: 1px solid var(--vscode-panel-border);
                  width: 450px;
                  border-radius: 6px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              }
              .modal-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 16px;
              }
              .modal-header h3 {
                  margin: 0;
                  font-size: 16px;
                  font-weight: 600;
              }
              .close {
                  color: var(--vscode-descriptionForeground);
                  font-size: 20px;
                  font-weight: normal;
                  cursor: pointer;
                  padding: 4px;
              }
              .split-input {
				    margin-right: 10px;
                  width: 95%;
                  padding: 8px 10px;
                  border: 1px solid var(--vscode-input-border);
                  background-color: var(--vscode-input-background);
                  color: var(--vscode-input-foreground);
                  border-radius: 3px;
                  font-size: 14px;
              }
              .split-input:focus {
                  outline: 1px solid var(--vscode-focusBorder);
                  border-color: var(--vscode-focusBorder);
              }
              .modal-footer {
                  display: flex;
                  justify-content: flex-end;
                  margin-top: 20px;
                  gap: 10px;
              }
              .modal-description {
                  font-size: 13px;
                  color: var(--vscode-descriptionForeground);
                  margin-bottom: 8px;
              }
              #page-count-info {
                  color: var(--vscode-descriptionForeground);
                  font-size: 12px;
                  margin-top: 8px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="sidebar">
                  <h3>PDF Files</h3>
                  <div class="pdf-list">
                      ${pdfPreviews
                        .map((pdf) =>
                          pdf
                            ? `
                          <div class="pdf-item" data-path="${pdf.path}" data-index="${pdf.index}">
                              <input type="checkbox" id="pdf-${pdf.index}" />
                              <span>${pdf.name}</span>
                          </div>
                      `
                            : ""
                        )
                        .join("")}
                  </div>
                  <div class="action-buttons">
                      <button id="merge-button" disabled>Merge Selected PDFs</button>
                      <button id="split-button" disabled>Split Current PDF</button>
                  </div>
              </div>
              <div class="preview-area">
                  <div class="page-controls">
                      <button id="prev-page" class="icon-button" disabled title="Previous Page">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                              <path fill-rule="evenodd" clip-rule="evenodd" d="M9.41 1.41L8 0 0 8l8 8 1.41-1.41L2.83 8l6.58-6.59z"/>
                          </svg>
                      </button>
                      <span id="page-info">Page 0 of 0</span>
                      <button id="next-page" class="icon-button" disabled title="Next Page">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                              <path fill-rule="evenodd" clip-rule="evenodd" d="M6.59 1.41L8 0l8 8-8 8-1.41-1.41L13.17 8 6.59 1.59z"/>
                          </svg>
                      </button>
                  </div>
                  <div class="canvas-container">
                      <canvas id="pdf-canvas"></canvas>
                  </div>
              </div>
          </div>

          <!-- Split PDF Modal -->
          <div id="split-modal" class="modal">
              <div class="modal-content">
                  <div class="modal-header">
                      <h3>Split PDF</h3>
                      <span class="close">&times;</span>
                  </div>
                  <p class="modal-description">Enter page ranges to split (e.g., "1-3, 4-6" or "1-1, 2-2" for single pages)</p>
                  <input type="text" id="page-ranges" class="split-input" placeholder="1-3, 4-6, 7-10" />
                  <div id="page-count-info">Current PDF has <span id="total-pages">0</span> pages</div>
                  <div class="modal-footer">
                      <button id="cancel-split">Cancel</button>
                      <button id="confirm-split">Split</button>
                  </div>
              </div>
          </div>

          <script>
              (function() {
                  const vscode = acquireVsCodeApi();
                  let pdfs = ${JSON.stringify(pdfPreviews)};
                  let currentPdfIndex = -1;
                  let pdfDoc = null;
                  let pageNum = 1;
                  let pageRendering = false;
                  let pageNumPending = null;
                  let scale = 1.5;
                  const canvas = document.getElementById('pdf-canvas');
                  const ctx = canvas.getContext('2d');

                  function renderPage(num) {
                      pageRendering = true;
                      
                      // Using the current pdf document
                      pdfDoc.getPage(num).then(function(page) {
                          const viewport = page.getViewport({ scale });
                          canvas.height = viewport.height;
                          canvas.width = viewport.width;

                          const renderContext = {
                              canvasContext: ctx,
                              viewport: viewport
                          };

                          const renderTask = page.render(renderContext);

                          // Wait for rendering to finish
                          renderTask.promise.then(function() {
                              pageRendering = false;
                              if (pageNumPending !== null) {
                                  // New page rendering is pending
                                  renderPage(pageNumPending);
                                  pageNumPending = null;
                              }
                          });
                      });

                      // Update page info
                      document.getElementById('page-info').textContent = \`Page \${num} of \${pdfDoc.numPages}\`;

                      // Update buttons
                      document.getElementById('prev-page').disabled = num <= 1;
                      document.getElementById('next-page').disabled = num >= pdfDoc.numPages;
                  }

                  function queueRenderPage(num) {
                      if (pageRendering) {
                          pageNumPending = num;
                      } else {
                          renderPage(num);
                      }
                  }

                  function onPrevPage() {
                      if (pageNum <= 1) {
                          return;
                      }
                      pageNum--;
                      queueRenderPage(pageNum);
                  }

                  function onNextPage() {
                      if (pageNum >= pdfDoc.numPages) {
                          return;
                      }
                      pageNum++;
                      queueRenderPage(pageNum);
                  }

                  document.getElementById('prev-page').addEventListener('click', onPrevPage);
                  document.getElementById('next-page').addEventListener('click', onNextPage);

                  // Load PDF and display it
                  function showPdf(index) {
                      if (index < 0 || index >= pdfs.length) return;

                      currentPdfIndex = index;
                      const pdfData = pdfs[index].data;
                      const pdfDataUri = \`data:application/pdf;base64,\${pdfData}\`;

                      // Load PDF with pdf.js
                      const loadingTask = pdfjsLib.getDocument({ url: pdfDataUri });
                      loadingTask.promise.then(function(pdf) {
                          pdfDoc = pdf;
                          pageNum = 1;
                          renderPage(pageNum);
                          
                          // Update the total pages count for the split modal
                          document.getElementById('total-pages').textContent = pdf.numPages;
                      });
                  }

                  // Select PDF item in sidebar
                  document.querySelectorAll('.pdf-item').forEach(item => {
                      item.addEventListener('click', function(event) {
                          const index = parseInt(this.dataset.index);
                          
                          // Toggle checkbox
                          const checkbox = this.querySelector('input');
                          if (event.target !== checkbox) {
                              checkbox.checked = !checkbox.checked;
                          }

                          // Show the selected PDF
                          showPdf(index);

                          // Update the selected item style
                          document.querySelectorAll('.pdf-item').forEach(i => i.classList.remove('selected'));
                          this.classList.add('selected');

                          // Update button states
                          updateButtonState();
                      });
                  });

                  // Handle checkboxes for selection
                  document.querySelectorAll('.pdf-item input').forEach(checkbox => {
                      checkbox.addEventListener('change', function() {
                          updateButtonState();
                      });
                  });

                  function updateButtonState() {
                      const checkedBoxes = document.querySelectorAll('.pdf-item input:checked');
                      const mergeButton = document.getElementById('merge-button');
                      const splitButton = document.getElementById('split-button');
                      
                      // Only enable merge if 2+ PDFs are selected
                      mergeButton.disabled = checkedBoxes.length < 2;
                      
                      // Only enable split if exactly 1 PDF is selected
                      splitButton.disabled = checkedBoxes.length !== 1;
                      
                      // If only one PDF is checked, make sure it's the one being displayed
                      if (checkedBoxes.length === 1) {
                          const selectedIndex = parseInt(checkedBoxes[0].closest('.pdf-item').dataset.index);
                          if (currentPdfIndex !== selectedIndex) {
                              showPdf(selectedIndex);
                              document.querySelectorAll('.pdf-item').forEach(i => i.classList.remove('selected'));
                              checkedBoxes[0].closest('.pdf-item').classList.add('selected');
                          }
                      }
                  }

                  // Merge selected PDFs
                  document.getElementById('merge-button').addEventListener('click', function() {
                      const checkedBoxes = document.querySelectorAll('.pdf-item input:checked');
                      const selectedPaths = Array.from(checkedBoxes).map(checkbox => {
                          const item = checkbox.closest('.pdf-item');
                          return item.dataset.path;
                      });

                      vscode.postMessage({
                          command: 'merge',
                          pdfPaths: selectedPaths
                      });
                  });

                  // Split current PDF
                  document.getElementById('split-button').addEventListener('click', function() {
                      document.getElementById('split-modal').style.display = 'block';
                  });

                  // Close the modal
                  document.querySelector('.close').addEventListener('click', function() {
                      document.getElementById('split-modal').style.display = 'none';
                  });
                  
                  // Cancel split operation
                  document.getElementById('cancel-split').addEventListener('click', function() {
                      document.getElementById('split-modal').style.display = 'none';
                  });
                  
                  // Add escape key handler for modal
                  document.addEventListener('keydown', function(event) {
                      if (event.key === 'Escape' && document.getElementById('split-modal').style.display === 'block') {
                          document.getElementById('split-modal').style.display = 'none';
                      }
                  });

                  // Handle split confirmation
                  document.getElementById('confirm-split').addEventListener('click', function() {
                      const rangeInput = document.getElementById('page-ranges').value;
                      const rangeRegex = /^(\\d+-\\d+)(,\\s*\\d+-\\d+)*$/;
                      
                      if (!rangeRegex.test(rangeInput)) {
                          alert('Please use the format "1-3, 4-6, 7-10"');
                          return;
                      }

                      // Parse the range input
                      const pageRanges = rangeInput.split(',').map(range => {
                          const [start, end] = range.trim().split('-').map(Number);
                          return { start, end };
                      });

                      // Get the current PDF path
                      const currentPdfPath = pdfs[currentPdfIndex].path;

                      vscode.postMessage({
                          command: 'split',
                          pdfPath: currentPdfPath,
                          pageRanges: pageRanges
                      });

                      document.getElementById('split-modal').style.display = 'none';
                  });

                  // Initialize with the first PDF if available
                  if (pdfs.length > 0) {
                      showPdf(0);
                      document.querySelector('.pdf-item[data-index="0"]').classList.add('selected');
                  }
                  
                  // Add keyboard navigation for pages
                  document.addEventListener('keydown', function(event) {
                      if (event.key === 'ArrowLeft' && !document.getElementById('prev-page').disabled) {
                          onPrevPage();
                      } else if (event.key === 'ArrowRight' && !document.getElementById('next-page').disabled) {
                          onNextPage();
                      }
                  });
              })();
          </script>
      </body>
      </html>`;
  }

  // Add this function at the bottom of your PdfPreviewPanel class
  private _getPdfJsUri() {
    const pdfJsPath = path.join(
      this._extensionPath,
      "media",
      "build",
      "pdf.mjs"
    );
    return this._panel.webview.asWebviewUri(vscode.Uri.file(pdfJsPath));
  }

  private _getPdfJsWorkerUri() {
    const pdfJsWorkerPath = path.join(
      this._extensionPath,
      "media",
      "build",
      "pdf.worker.mjs"
    );
    return this._panel.webview.asWebviewUri(vscode.Uri.file(pdfJsWorkerPath));
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "pdf-powertools" is now active!'
  );

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

  const previewPdfFileCommand = vscode.commands.registerCommand(
    "pdf-powertools.previewPdfFile",
    (filePath) => {
      // If filePath is a string, it's coming directly from a command
      // If it's an object, it's coming from the tree item
      const pdfPath =
        typeof filePath === "string" ? filePath : filePath.filePath;

      // Open the PDF preview panel with the single PDF
      PdfPreviewPanel.createOrShow(context.extensionPath, [pdfPath]);
    }
  );

  // Modify the existing mergePdfs command to use files from the explorer
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
              // Open the merged PDF with the default application
              const uri = vscode.Uri.file(outputPath);
              vscode.env.openExternal(uri);
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

  // Modify the splitPdf command to use the first file from the explorer if available
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

        // Ask user for page ranges
        const rangeInput = await vscode.window.showInputBox({
          prompt:
            'Enter page ranges to split (e.g., "1-3, 4-6" or "1-1, 2-2" for single pages)',
          placeHolder: "1-3, 4-6, 7-10",
          validateInput: (input) => {
            // Simple validation for the format
            if (!/^(\d+-\d+)(,\s*\d+-\d+)*$/.test(input)) {
              return 'Please use the format "1-3, 4-6, 7-10"';
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

        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Splitting PDF",
            cancellable: false,
          },
          async (progress) => {
            progress.report({ increment: 0 });

            // Split the PDF
            const outputPaths = await pdfService.splitPdf(pdfPath, pageRanges);

            progress.report({ increment: 100 });

            const openFolderButton = "Open Folder";
            const result = await vscode.window.showInformationMessage(
              `PDF split successfully into ${outputPaths.length} files!`,
              openFolderButton
            );

            if (result === openFolderButton) {
              // Open the folder containing the split PDFs
              const folderUri = vscode.Uri.file(path.dirname(outputPaths[0]));
              vscode.env.openExternal(folderUri);
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

  // Update the PDF preview command to use files from the explorer
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
        }

        // Open the PDF preview panel
        PdfPreviewPanel.createOrShow(context.extensionPath, pdfPaths);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error opening PDF preview: ${
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
