import os
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib import colors
import re

def convert_markdown_to_pdf(md_file, pdf_file):
    """Convert a markdown file to PDF using ReportLab"""
    # Read markdown content
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Create PDF document
    doc = SimpleDocTemplate(pdf_file, pagesize=A4,
                           rightMargin=72, leftMargin=72,
                           topMargin=72, bottomMargin=18)
    
    # Create styles
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CustomTitle',
                             parent=styles['Heading1'],
                             fontSize=20,
                             textColor=colors.HexColor('#0066CC'),
                             spaceAfter=30,
                             alignment=TA_CENTER))
    
    styles.add(ParagraphStyle(name='CustomHeading2',
                             parent=styles['Heading2'],
                             fontSize=16,
                             textColor=colors.HexColor('#FF6600'),
                             spaceAfter=12,
                             spaceBefore=20))
    
    styles.add(ParagraphStyle(name='CustomHeading3',
                             parent=styles['Heading3'],
                             fontSize=14,
                             textColor=colors.HexColor('#00CC66'),
                             spaceAfter=10,
                             spaceBefore=15))
    
    styles.add(ParagraphStyle(name='CustomBody',
                             parent=styles['Normal'],
                             fontSize=11,
                             spaceAfter=12,
                             leading=14))
    
    # Parse markdown and create story
    story = []
    lines = md_content.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            story.append(Spacer(1, 0.2*inch))
            continue
        
        # Handle headings
        if line.startswith('# '):
            text = line[2:].strip()
            story.append(Paragraph(text, styles['CustomTitle']))
        elif line.startswith('## '):
            text = line[3:].strip()
            story.append(Paragraph(text, styles['CustomHeading2']))
        elif line.startswith('### '):
            text = line[4:].strip()
            story.append(Paragraph(text, styles['CustomHeading3']))
        # Handle bold text
        else:
            # Convert markdown formatting to HTML-like tags for ReportLab
            line = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', line)
            line = re.sub(r'\*(.*?)\*', r'<i>\1</i>', line)
            line = re.sub(r'`(.*?)`', r'<font face="Courier">\1</font>', line)
            story.append(Paragraph(line, styles['CustomBody']))
    
    # Build PDF
    doc.build(story)
    print(f"Converted {md_file} to {pdf_file}")

# Convert all markdown files in knowledge_base directory
knowledge_base_dir = r'c:\Users\DAKSHI\Downloads\Final\Lead-Automation\temp_clone\Lead_Automation_V2\knowledge_base'

for root, dirs, files in os.walk(knowledge_base_dir):
    for file in files:
        if file.endswith('.md'):
            md_file = os.path.join(root, file)
            pdf_file = md_file.replace('.md', '.pdf')
            try:
                convert_markdown_to_pdf(md_file, pdf_file)
            except Exception as e:
                print(f"Error converting {md_file}: {e}")

print("PDF conversion completed!")
