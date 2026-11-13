import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as Array<[string, number]>) blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16]] as Array<[string, number]>) {
  blocked.addSubnet(network, prefix, 'ipv6');
}

const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family === 6) return globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
  return false;
}

/** Resolve every hop and pin the actual connection to one of the returned addresses. */
export async function resolvePublicUrl(input: string, resolver: Resolver = async (hostname) => dnsLookup(hostname, { all: true, verbatim: true })): Promise<{ url: URL; addresses: Address[] }> {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsupported URL');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!hostname || hostname.toLowerCase() === 'localhost' || hostname.toLowerCase().endsWith('.localhost')) throw new Error('Unsafe host');
  const ipFamily = isIP(hostname);
  const addresses = ipFamily ? [{ address: hostname, family: ipFamily }] : await resolver(hostname);
  if (!addresses.length || addresses.some(({ address, family }) => family !== isIP(address) || !isPublicAddress(address))) throw new Error('Unsafe destination');
  return { url, addresses };
}
