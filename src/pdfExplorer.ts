import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class PdfFile extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.None
  ) {
    super(path.basename(filePath), collapsibleState);

    // Set the description to show the folder path
    this.description = path.dirname(filePath);

    // Set the icon
    this.iconPath = new vscode.ThemeIcon("file");

    // Set the tooltip to the full path
    this.tooltip = filePath;

    // Set the context value for context menu filtering
    this.contextValue = "pdfFile";

    // Set command to execute when clicking on the item
    this.command = {
      command: "pdf-powertools.previewPdfFile",
      title: "Preview PDF",
      arguments: [filePath],
    };
  }
}

export class PdfOperation extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly commandId: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);

    // Set the icon
    this.iconPath = new vscode.ThemeIcon(
      label.toLowerCase().includes("merge") ? "git-merge" : "split-horizontal"
    );

    // Set the context value for context menu filtering
    this.contextValue = "pdfOperation";

    // Set command to execute when clicking on the item
    this.command = {
      command: `pdf-powertools.${commandId}`,
      title: label,
      arguments: [],
    };
  }
}

export class PdfFilesProvider implements vscode.TreeDataProvider<PdfFile> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    PdfFile | undefined | null | void
  > = new vscode.EventEmitter<PdfFile | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    PdfFile | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private pdfFiles: Map<string, PdfFile> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    // Load any saved PDF files from workspace state
    this.loadPdfFiles();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PdfFile): vscode.TreeItem {
    return element;
  }

  getChildren(element?: PdfFile): Thenable<PdfFile[]> {
    if (element) {
      return Promise.resolve([]);
    }

    return Promise.resolve([...this.pdfFiles.values()]);
  }

  addPdfFile(filePath: string): void {
    if (!this.pdfFiles.has(filePath)) {
      this.pdfFiles.set(filePath, new PdfFile(filePath));
      this.savePdfFiles();
      this.refresh();
    }
  }

  removePdfFile(filePath: string): void {
    if (this.pdfFiles.has(filePath)) {
      this.pdfFiles.delete(filePath);
      this.savePdfFiles();
      this.refresh();
    }
  }

  getPdfFiles(): string[] {
    return [...this.pdfFiles.keys()];
  }

  private loadPdfFiles(): void {
    const savedPdfFiles = this.context.workspaceState.get<string[]>(
      "pdfFiles",
      []
    );

    // Verify files still exist and add them to the map
    for (const filePath of savedPdfFiles) {
      if (fs.existsSync(filePath)) {
        this.pdfFiles.set(filePath, new PdfFile(filePath));
      }
    }
  }

  private savePdfFiles(): void {
    this.context.workspaceState.update("pdfFiles", [...this.pdfFiles.keys()]);
  }
}

export class PdfOperationsProvider
  implements vscode.TreeDataProvider<PdfOperation>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    PdfOperation | undefined | null | void
  > = new vscode.EventEmitter<PdfOperation | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    PdfOperation | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private operations: PdfOperation[] = [
    new PdfOperation("Merge PDFs", "mergePdfs"),
    new PdfOperation("Split PDF", "splitPdf"),
    new PdfOperation("View all PDFs", "openPdfPreview"),
  ];

  getTreeItem(element: PdfOperation): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<PdfOperation[]> {
    return Promise.resolve(this.operations);
  }
}
