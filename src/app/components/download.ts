// Reliable file-download helper.
//
// A detached <a> is unreliable for triggering a download: some browsers ignore
// the `download` attribute on an anchor that isn't in the document and navigate
// to the blob instead (which is why displayable types like images/SVG "open"
// rather than download, while a ZIP downloads fine). Appending to the document
// before clicking makes `download` reliably honored across browsers.
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
