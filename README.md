# PDF PowerTools for VS Code

PDF PowerTools is a Visual Studio Code extension that provides essential PDF manipulation capabilities directly within your editor. Work with your PDF files offline, without needing to use online services that might compromise document privacy or require internet connectivity.

## Features

- _Merge PDFs_: Combine multiple PDF documents into a single file
- _Split PDFs_: Divide a PDF into multiple files based on custom page ranges
- _Preview PDFs_: Open PDFs with your system's default PDF viewer

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "PDF PowerTools"
4. Click Install

## How to Use

### Managing PDF Files

- Click the PDF PowerTools icon in the Activity Bar
- Use the "Add PDF Files" button to import PDF files
- Your PDF files will appear in the "PDF Files" view
- Right-click on files or use the inline buttons to:
  1. Remove a file from the workspace
  2. Preview the PDF with your default viewer

### Merging PDFs

- Add the PDFs you want to merge to the workspace
- Click "Merge PDFs" in the Operations view (or use command palette)
- The merged PDF will be created in the same directory as the first PDF with "\_merged" suffix

### Splitting a PDF

- Select a PDF file in the workspace (or you'll be prompted to choose one)
- Click "Split PDF" in the Operations view (or use command palette)
- Enter page ranges in the format "1-3, 4-6, 7-10"
- The split PDFs will be created in the same directory with appropriate page range suffixes

## Requirements

- Visual Studio Code version 1.98.0 or higher
- A PDF viewer installed on your system

## Limitations

- Large PDFs (>100MB) may be slow to process
- The extension uses your system's default PDF viewer rather than providing an in-editor preview
- Currently limited to basic operations (merge, split, view)

## Future Plans

Upcoming features being considered for future releases:

- In-editor PDF viewer
- Deleting and reordering PDF pages
- PDF text extraction and search
- PDF compression and optimization
- PDF annotation and markup tools

## Privacy & Security

PDF PowerTools processes all files locally on your machine. Your documents are never uploaded to any server, ensuring complete privacy and security of your sensitive documents.

## Release Notes

### 0.0.1 - Initial Release

- PDF file management
- PDF merging functionality
- PDF splitting with custom page ranges
- External PDF preview

---

## Feedback & Contributions

File issues at GitHub repository

Contributions are welcome!

## License

This extension is released under the MIT License.

**Enjoy!**
