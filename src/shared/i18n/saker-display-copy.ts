export function sakerDisplayCopy(value: string): string {
  return value.replace(/\b(?:Orca|ORCA)\b/g, 'Saker')
}
