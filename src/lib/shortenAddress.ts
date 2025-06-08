export function shortenAddress(address: string, partCount: number = 3): string {
  if (!address) return '';
  const parts = address.split(',').map(p => p.trim());
  return parts.slice(0, partCount).join(', ');
} 