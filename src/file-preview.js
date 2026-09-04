export const fileExtension = (file) => String(file?.name ?? '').split('.').pop()?.toLowerCase() ?? '';

export const previewType = (file) => {
  const extension = fileExtension(file);
  const mimeType = String(file?.type ?? file?.mimeType ?? file?.blob?.type ?? '').toLowerCase();
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) return 'image';
  if (['xlsx', 'xls', 'csv', 'ods'].includes(extension) || mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'spreadsheet';
  if (['docx', 'doc'].includes(extension) || mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'word';
  if (mimeType.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'csv'].includes(extension)) return 'text';
  return 'other';
};

export const previewTypeLabel = (file) => ({ pdf: 'PDF', image: 'изображение', spreadsheet: 'Excel', word: 'Word', text: 'текстовый файл', other: 'файл' }[previewType(file)]);

function base64Blob(value) {
  const binary = atob(value.data);
  return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], { type: value.type || 'application/octet-stream' });
}

export async function attachmentBlob(file) {
  const stored = file?.blob ?? file?.content;
  if (stored?.arrayBuffer) return stored;
  if (stored?.__blob && stored.data) return base64Blob(stored);
  if (file?.__blob && file.data) return base64Blob(file);
  const sourceUrl = file?.url || file?.fileUrl;
  if (sourceUrl) {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Не удалось получить файл: ${response.status}.`);
    return response.blob();
  }
  return null;
}

export function previewUrl(file, blob) {
  return file?.url?.startsWith('data:') ? file.url : URL.createObjectURL(blob);
}
