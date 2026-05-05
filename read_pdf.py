"""Script to extract text from a PDF file."""
import sys
import PyPDF2

try:
    with open('SSD Cy321 - Semester Project.pdf', 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        print(text)
except OSError as e:
    print(f"Error reading PDF: {e}", file=sys.stderr)
