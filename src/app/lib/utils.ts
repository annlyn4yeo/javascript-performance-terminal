import { BYTES_PER_KILOBYTE, BYTES_PER_MEGABYTE } from "./constants";

export const formatBytes = (sizeBytes: number | null): string | null => {
  if (sizeBytes === null) {
    return null;
  }

  if (sizeBytes < BYTES_PER_KILOBYTE) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < BYTES_PER_MEGABYTE) {
    return `${Math.round(sizeBytes / 102.4) / 10} KB`;
  }

  return `${Math.round(sizeBytes / (BYTES_PER_KILOBYTE * 102.4)) / 10} MB`;
};

export const bytesToKilobytes = (value: number): number =>
  Math.round(value / BYTES_PER_KILOBYTE);
