#!/usr/bin/env python3
"""
PST Email Extractor
Extracts emails from Microsoft Outlook .pst files into JSON format.
Supports chunked output for large PST files.

Usage:
    python3 pst_extractor.py <path_to_pst_file> [--chunk-size MB]

    Default chunk size: 20MB per JSON file (safe for Vercel upload).
    For a 14GB PST, this might produce ~50-200 chunk files depending on email sizes.

Examples:
    python3 pst_extractor.py mailbox.pst
    python3 pst_extractor.py mailbox.pst --chunk-size 10

Output:
    mailbox_part001.json, mailbox_part002.json, ...
    (or mailbox.json if small enough for a single file)

Requirements:
    pip install pypff
"""

import pypff
import json
import sys
import os
import re
import argparse
from datetime import datetime
from pathlib import Path


def clean_text(text):
    if not text:
        return ""
    text = text.replace("\x00", "")
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_message(message, folder_path=""):
    def safe_get(fn, default=""):
        try:
            val = fn()
            return val if val else default
        except Exception:
            return default

    subject = safe_get(lambda: message.subject, "(No Subject)")
    sender = safe_get(lambda: message.sender_name)
    sender_email = safe_get(lambda: message.email_address)

    body = ""
    try:
        raw = message.plain_text_body
        if raw:
            body = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else raw
    except Exception:
        pass

    if not body:
        try:
            html = message.html_body
            if html:
                html = html.decode("utf-8", errors="replace") if isinstance(html, bytes) else html
                body = re.sub(r"<[^>]+>", " ", html)
                body = re.sub(r"\s+", " ", body)
        except Exception:
            pass

    date_str = ""
    try:
        dt = message.delivery_time
        if dt:
            date_str = dt.isoformat()
    except Exception:
        pass

    recipients = []
    try:
        for i in range(message.number_of_recipients):
            try:
                r = message.get_recipient(i)
                recipients.append(r.name or r.email_address or "Unknown")
            except Exception:
                pass
    except Exception:
        pass

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
        "sender_email": clean_text(sender_email),
        "recipients": recipients,
        "date": date_str,
        "body": clean_text(body)[:10000],
        "folder": folder_path,
        "attachments": attachments,
        "has_attachments": len(attachments) > 0,
    }


def process_folder(folder, folder_path="", emails=None, counter=None):
    if emails is None:
        emails = []
    if counter is None:
        counter = {"count": 0, "errors": 0}

    try:
        name = folder.name or "Root"
    except Exception:
        name = "Unknown"

    current_path = f"{folder_path}/{name}" if folder_path else name

    try:
        num = folder.number_of_sub_messages
        for i in range(num):
            try:
                msg = folder.get_sub_message(i)
                emails.append(extract_message(msg, current_path))
                counter["count"] += 1
                if counter["count"] % 500 == 0:
                    print(f"  Extracted {counter['count']} emails...")
            except Exception:
                counter["errors"] += 1
    except Exception:
        pass

    try:
        for i in range(folder.number_of_sub_folders):
            try:
                process_folder(folder.get_sub_folder(i), current_path, emails, counter)
            except Exception:
                pass
    except Exception:
        pass

    return emails, counter


def write_chunk(emails, output_path, chunk_num, source_file, total_chunks_so_far):
    data = {
        "source_file": source_file,
        "extraction_date": datetime.now().isoformat(),
        "chunk": chunk_num,
        "email_count": len(emails),
        "emails": emails,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"  Wrote {output_path} ({len(emails)} emails, {size_mb:.1f}MB)")


def extract_pst(pst_path, chunk_size_mb=20):
    pst_path = Path(pst_path)
    if not pst_path.exists():
        print(f"Error: File not found: {pst_path}")
        sys.exit(1)

    file_size_mb = pst_path.stat().st_size / 1024 / 1024
    print(f"Opening PST file: {pst_path} ({file_size_mb:.0f}MB)")
    print(f"Chunk size limit: {chunk_size_mb}MB per JSON file")

    pst = pypff.file()
    pst.open(str(pst_path))
    root = pst.get_root_folder()

    print("Extracting all emails (this may take a while for large files)...")
    all_emails, counter = process_folder(root)
    pst.close()

    print(f"\nExtraction complete: {counter['count']} emails, {counter['errors']} errors")

    if not all_emails:
        print("No emails found!")
        return

    # Sort by date
    all_emails.sort(key=lambda x: x.get("date", ""), reverse=True)

    # Determine output strategy
    stem = pst_path.stem
    output_dir = pst_path.parent

    # Try single file first
    test_json = json.dumps(all_emails[:10], ensure_ascii=False)
    avg_email_size = len(test_json) / max(len(all_emails[:10]), 1)
    estimated_total_mb = (avg_email_size * len(all_emails)) / 1024 / 1024

    if estimated_total_mb <= chunk_size_mb:
        # Single file
        out_path = output_dir / f"{stem}.json"
        data = {
            "source_file": pst_path.name,
            "extraction_date": datetime.now().isoformat(),
            "total_emails": len(all_emails),
            "emails": all_emails,
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        size_mb = os.path.getsize(out_path) / 1024 / 1024
        print(f"\nDone! Single file: {out_path} ({size_mb:.1f}MB)")
    else:
        # Chunked output
        print(f"\nEstimated output: ~{estimated_total_mb:.0f}MB — splitting into chunks...")
        chunk_num = 1
        chunk_emails = []
        chunk_size = 0
        max_chunk_bytes = chunk_size_mb * 1024 * 1024

        for email in all_emails:
            email_json = json.dumps(email, ensure_ascii=False)
            email_size = len(email_json.encode("utf-8"))

            if chunk_size + email_size > max_chunk_bytes and chunk_emails:
                out_path = output_dir / f"{stem}_part{chunk_num:03d}.json"
                write_chunk(chunk_emails, out_path, chunk_num, pst_path.name, chunk_num)
                chunk_num += 1
                chunk_emails = []
                chunk_size = 0

            chunk_emails.append(email)
            chunk_size += email_size

        # Write remaining
        if chunk_emails:
            out_path = output_dir / f"{stem}_part{chunk_num:03d}.json"
            write_chunk(chunk_emails, out_path, chunk_num, pst_path.name, chunk_num)

        print(f"\nDone! {chunk_num} chunk files created: {stem}_part001.json through {stem}_part{chunk_num:03d}.json")
        print(f"Total emails: {len(all_emails)}")
        print(f"\nUpload all chunk files to the app — it will merge them automatically.")

    # Folder summary
    folders = {}
    for e in all_emails:
        f = e.get("folder", "Unknown")
        folders[f] = folders.get(f, 0) + 1

    print(f"\nFolder breakdown ({len(folders)} folders):")
    for folder, count in sorted(folders.items(), key=lambda x: -x[1])[:20]:
        print(f"  {folder}: {count}")
    if len(folders) > 20:
        print(f"  ... and {len(folders) - 20} more folders")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract emails from Outlook PST files")
    parser.add_argument("pst_file", help="Path to the .pst file")
    parser.add_argument("--chunk-size", type=int, default=20,
                        help="Max size per JSON chunk in MB (default: 20)")
    args = parser.parse_args()

    extract_pst(args.pst_file, args.chunk_size)
