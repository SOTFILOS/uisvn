export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ExcelFile {
  fileName: string;
  fileSize: number;
  sheets: ParsedSheet[];
}
