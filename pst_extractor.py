#!/usr/bin/env python3
"""
PST Email Extractor
Extracts emails from Microsoft Outlook .pst files into JSON format
that can be loaded into the AI-powered email search app.

Usage:
    python3 pst_extractor.py <path_to_pst_file> [output.json]

Requirements:
    pip install pypff --break-system-packages
"""

import pypff
import json
import sys
import os
import email
import re
from datetime import datetime
from pathlib import Path


def clean_text(text):
    """Clean and normalize email text."""
    if not text:
        return ""
    # Remove null bytes and excessive whitespace
    text = text.replace("\x00", "")
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_message(message, folder_path=""):
    """Extract data from a single PST message."""
    try:
        subject = message.subject or "(No Subject)"
    except Exception:
        subject = "(No Subject)"

    try:
        sender = message.sender_name or ""
    except Exception:
        sender = ""

    try:
        email_addr = message.email_address or ""
    except Exception:
        email_addr = ""

    try:
        body = message.plain_text_body
        if body:
            body = body.decode("utf-8", errors="replace") if isinstance(body, bytes) else body
        else:
            body = ""
    except Exception:
        body = ""

    try:
        html_body = message.html_body
        if html_body:
            html_body = html_body.decode("utf-8", errors="replace") if isinstance(html_body, bytes) else html_body
            # Strip HTML tags for searchable text if no plain text
            if not body:
                body = re.sub(r"<[^>]+>", " ", html_body)
                body = re.sub(r"\s+", " ", body)
        else:
            html_body = ""
    except Exception:
        html_body = ""

    try:
        delivery_time = message.delivery_time
        if delivery_time:
            date_str = delivery_time.isoformat()
        else:
            date_str = ""
    except Exception:
        date_str = ""

    # Get recipients
    recipients = []
    try:
        for i in range(message.number_of_recipients):
            try:
                recip = message.get_recipient(i)
                recipients.append(recip.name or recip.email_address or "Unknown")
            except Exception:
                pass
    except Exception:
        pass

    # Get attachments info
    attachments = []
    try:
        for i in range(message.number_of_attachments):
            try:
                att = message.get_attachment(i)
                attachments.append({
                    "name": att.name or f"attachment_{i}",
                    "size": att.size if hasattr(att, "size") else 0,
                })
            except Exception:
                pass
    except Exception:
        pass

    return {
        "subject": clean_text(subject),
        "sender": clean_text(sender),
        "sender_email": clean_text(email_addr),
        "recipients": recipients,
        "date": date_str,
        "body": clean_text(body)[:10000],  # Cap at 10K chars per email
        "folder": folder_path,
        "attachments": attachments,
        "has_attachments": len(attachments) > 0,
    }


def process_folder(folder, folder_path="", emails=None):
    """Recursively process PST folders."""
    if emails is None:
        emails = []

    try:
        folder_name = folder.name or "Root"
    except Exception:
        folder_name = "Unknown"

    current_path = f"{folder_path}/{folder_name}" if folder_path else folder_name

    # Extract messages from this folder
    try:
        num_messages = folder.number_of_sub_messages
        for i in range(num_messages):
            try:
                message = folder.get_sub_message(i)
                email_data = extract_message(message, current_path)
                emails.append(email_data)
                if len(emails) % 100 == 0:
                    print(f"  Extracted {len(emails)} emails so far...")
            except Exception as e:
                print(f"  Warning: Could not read message {i} in {current_path}: {e}")
    except Exception as e:
        print(f"  Warning: Could not read messages in {current_path}: {e}")

    # Recurse into subfolders
    try:
        num_folders = folder.number_of_sub_folders
        for i in range(num_folders):
            try:
                subfolder = folder.get_sub_folder(i)
                process_folder(subfolder, current_path, emails)
            except Exception as e:
                print(f"  Warning: Could not access subfolder {i} in {current_path}: {e}")
    except Exception:
        pass

    return emails


def extract_pst(pst_path, output_path=None):
    """Main extraction function."""
    pst_path = Path(pst_path)

    if not pst_path.exists():
        print(f"Error: File not found: {pst_path}")
        sys.exit(1)

    if not output_path:
        output_path = pst_path.with_suffix(".json")

    print(f"Opening PST file: {pst_path}")
    print(f"Output will be saved to: {output_path}")

    pst = pypff.file()
    pst.open(str(pst_path))

    root = pst.get_root_folder()
    print("Extracting emails...")

    emails = process_folder(root)

    pst.close()

    # Sort by date
    emails.sort(key=lambda x: x.get("date", ""), reverse=True)

    # Write output
    output = {
        "source_file": str(pst_path.name),
        "extraction_date": datetime.now().isoformat(),
        "total_emails": len(emails),
        "emails": emails,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nDone! Extracted {len(emails)} emails to {output_path}")
    print(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")

    # Print folder summary
    folders = {}
    for e in emails:
        folder = e.get("folder", "Unknown")
        folders[folder] = folders.get(folder, 0) + 1

    print("\nFolder breakdown:")
    for folder, count in sorted(folders.items(), key=lambda x: -x[1]):
        print(f"  {folder}: {count} emails")

    return output


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 pst_extractor.py <path_to_pst_file> [output.json]")
        print("\nThis script extracts emails from Outlook .pst files into JSON format")
        print("for use with the AI-powered email search application.")
        sys.exit(1)

    pst_file = sys.argv[1]
    out_file = sys.argv[2] if len(sys.argv) > 2 else None
    extract_pst(pst_file, out_file)
