export interface EmailData {
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

export interface SearchResult {
  answer: string;
  relevant_emails: {
    index: number;
    subject: string;
    relevance: string;
    extracted_info: string;
  }[];
  summary_table: { label: string; value: string }[];
}

export interface ParsedPST {
  source_file?: string;
  extraction_date?: string;
  total_emails?: number;
  emails: EmailData[];
}
