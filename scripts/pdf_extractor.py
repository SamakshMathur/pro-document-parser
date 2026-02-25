import sys
import json

def extract_text(file_path: str):
    """Try multiple strategies, pick the best result"""
    text = ""
    error = None
    
    # Strategy 1: Direct text (digital PDFs) with pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            if len(text.strip()) > 100:  # Got meaningful text
                print(json.dumps({"success": True, "text": text, "strategy": "pdfplumber"}))
                return
    except Exception as e:
        error = str(e)
    
    # Strategy 2: PyMuPDF (better layout preservation)  
    try:
        import fitz
        doc = fitz.open(file_path)
        text = "\n".join(page.get_text("text") for page in doc)
        if len(text.strip()) > 100:
            print(json.dumps({"success": True, "text": text, "strategy": "pymupdf"}))
            return
    except Exception as e:
        error = str(e)
        
    print(json.dumps({"success": False, "text": "", "error": error}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    extract_text(file_path)
