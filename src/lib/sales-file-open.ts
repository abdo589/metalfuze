/** Only browser-previewable formats open a tab; Office/CAD/archive files download. */
export function canPreviewSalesFile(name: string): boolean {
  return /\.(pdf|png|jpe?g|gif|webp)$/i.test(name);
}

type FileWindow = { location: { href: string }; opener: unknown; close: () => void };
type Browser = { open: () => FileWindow | null; navigate: (url: string) => void };

export async function openSalesFile(
  name: string,
  signedUrl: (download: boolean) => Promise<string>,
  download = false,
  browser: Browser = {
    open: () => window.open("about:blank", "_blank"),
    navigate: (url) => window.location.assign(url),
  },
): Promise<void> {
  const preview = !download && canPreviewSalesFile(name);
  // Reserve the tab during the click, before async signing loses Safari's user gesture.
  const tab = preview ? browser.open() : null;
  if (tab) tab.opener = null;
  try {
    const url = await signedUrl(!preview);
    if (!url) throw new Error("File URL unavailable");
    if (tab) tab.location.href = url;
    else browser.navigate(url);
  } catch (error) {
    tab?.close();
    throw error;
  }
}