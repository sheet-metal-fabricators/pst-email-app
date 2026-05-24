import { NextRequest, NextResponse } from "next/server";
import { PSTFile, PSTFolder, PSTMessage, PSTRecipient, PSTAttachment } from "pst-extractor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface ExtractedEmail {
  subject: string;
  sender: string;
  sender_email: string;
  recipients: string[];
  date: string;
  body: string;
  folder: string;
  attachments: { name: string; size: number }[];
  has_attachments: boolean;
}

function processFolder(folder: PSTFolder, folderPath: string, emails: ExtractedEmail[]): void {
  const folderName = folder.displayName || "Root";
  const currentPath = folderPath ? `${folderPath}/${folderName}` : folderName;

  // Process emails
  if (folder.contentCount > 0) {
    let email: PSTMessage | null = folder.getNextChild();
    while (email != null) {
      try {
        // Recipients
        const recipients: string[] = [];
        try {
          for (let i = 0; i < email.numberOfRecipients; i++) {
            try {
              const r: PSTRecipient | null = email.getRecipient(i);
              if (r) {
                recipients.push(r.smtpAddress || r.emailAddress || "Unknown");
              }
            } catch { /* skip */ }
          }
        } catch { /* no recipients */ }

        // Attachments
        const attachments: { name: string; size: number }[] = [];
        try {
          for (let i = 0; i < email.numberOfAttachments; i++) {
            try {
              const att: PSTAttachment | null = email.getAttachment(i);
              if (att) {
                attachments.push({
                  name: att.longFilename || att.filename || `attachment_${i}`,
                  size: att.size || 0,
                });
              }
            } catch { /* skip */ }
          }
        } catch { /* no attachments */ }

        // Body
        let body = "";
        try {
          body = email.body || "";
        } catch {
          try {
            const html = email.bodyHTML || "";
            body = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          } catch { /* no body */ }
        }

        // Date
        let dateStr = "";
        try {
          const d = email.clientSubmitTime;
          if (d) dateStr = d.toISOString();
        } catch { /* no date */ }

        emails.push({
          subject: email.subject || "(No Subject)",
          sender: email.senderName || "",
          sender_email: email.senderEmailAddress || "",
          recipients,
          date: dateStr,
          body: body.substring(0, 10000),
          folder: currentPath,
          attachments,
          has_attachments: attachments.length > 0,
        });
      } catch {
        // Skip problematic emails
      }

      email = folder.getNextChild();
    }
  }

  // Recurse subfolders
  if (folder.hasSubfolders) {
    try {
      const subs = folder.getSubFolders();
      for (const sub of subs) {
        processFolder(sub, currentPath, emails);
      }
    } catch { /* skip */ }
  }
}

export async function POST(req: NextRequest) {
  let tmpPath = "";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pst")) {
      return NextResponse.json({ error: "Only .pst files are accepted" }, { status: 400 });
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Max 50MB. Use pst_extractor.py locally for larger files.` },
        { status: 413 }
      );
    }

    // Write to temp file (pst-extractor needs a file path)
    const buffer = Buffer.from(await file.arrayBuffer());
    tmpPath = path.join(os.tmpdir(), `pst_${Date.now()}_${Math.random().toString(36).slice(2)}.pst`);
    fs.writeFileSync(tmpPath, buffer);

    const pstFile = new PSTFile(tmpPath);
    const emails: ExtractedEmail[] = [];
    processFolder(pstFile.getRootFolder(), "", emails);

    // Sort by date descending
    emails.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // Folder stats
    const folders: Record<string, number> = {};
    for (const e of emails) {
      const f = e.folder || "Unknown";
      folders[f] = (folders[f] || 0) + 1;
    }

    return NextResponse.json({
      filename: file.name,
      total_emails: emails.length,
      folders,
      emails,
    });
  } catch (err: any) {
    console.error("PST parse error:", err);
    return NextResponse.json(
      { error: `Failed to parse PST file: ${err.message || "Unknown error"}` },
      { status: 500 }
    );
  } finally {
    if (tmpPath) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
}
