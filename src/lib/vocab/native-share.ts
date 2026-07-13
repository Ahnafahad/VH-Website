import { Capacitor } from '@capacitor/core';

export async function shareLexiCore(input: { title: string; text: string; path?: string }): Promise<boolean> {
  const url = new URL(input.path ?? '/vocab/home', 'https://www.vh-beyondthehorizons.org').toString();
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: input.title, text: input.text, url, dialogTitle: 'Share from LexiCore' });
      return true;
    }
    if (navigator.share) {
      await navigator.share({ title: input.title, text: input.text, url });
      return true;
    }
    await navigator.clipboard.writeText(`${input.text} ${url}`);
    return true;
  } catch {
    return false;
  }
}
