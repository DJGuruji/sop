/** Serial numbers for SOPs uploaded via the library modal (`POST /api/sop/templates`). */
export const SOP_LIBRARY_UPLOAD_SERIAL_PREFIX = "SOP-UPL-";

export function isSopLibraryUploadSerial(serialNo: string): boolean {
  return serialNo.startsWith(SOP_LIBRARY_UPLOAD_SERIAL_PREFIX);
}
