export function fold(s: string): string {
  return s
    .normalize("NFD")              // split base + combining marks
    .replace(/[\u0300-\u036f]/g, "") // remove combining marks
    .toLowerCase()
    .trim();
}