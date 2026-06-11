// SVG Optimizer — pure client-side SVG parsing and optimization

export interface OptimizationResult {
  original: string;
  optimized: string;
  originalSize: number;
  optimizedSize: number;
  savings: number;
  savingsPercent: number;
  removedElements: number;
  removedAttributes: number;
  simplifiedPaths: number;
}

// Metadata/unnecessary elements to strip
const REMOVE_ELEMENTS = new Set([
  'metadata',
  'title',
  'desc',
  'comment',
  'sodipodi:namedview',
  'inkscape:perspective',
  'rdf:RDF',
  'cc:Work',
  'dc:format',
  'dc:type',
  'dc:title',
]);

// Unnecessary attributes to strip
const REMOVE_ATTRIBUTES = new Set([
  'xmlns:dc',
  'xmlns:cc',
  'xmlns:rdf',
  'xmlns:svg',
  'xmlns:sodipodi',
  'xmlns:inkscape',
  'sodipodi:docname',
  'sodipodi:version',
  'inkscape:version',
  'inkscape:output_extension',
  'inkscape:export-filename',
  'inkscape:export-xdpi',
  'inkscape:export-ydpi',
  'inkscape:label',
  'inkscape:groupmode',
  'inkscape:pageopacity',
  'inkscape:pageshadow',
  'inkscape:zoom',
  'inkscape:cx',
  'inkscape:cy',
  'inkscape:window-x',
  'inkscape:window-y',
  'inkscape:window-width',
  'inkscape:window-height',
  'inkscape:window-maximized',
  'inkscape:current-layer',
  'inkscape:document-units',
  'inkscape:snap-global',
  'xml:space',
  'data-name',
]);

// Default attribute values that can be removed
// NOTE: Only include values that are ALWAYS safe to remove — i.e. true SVG spec defaults
// that cannot be overriding an inherited parent value in any meaningful way.
const DEFAULT_ATTRS: Record<string, string> = {
  'font-style': 'normal',
  'font-variant': 'normal',
  'font-stretch': 'normal',
  'vector-effect': 'none',
  'enable-background': 'accumulate',
};

// Collect all IDs referenced elsewhere in the SVG (url(#…), xlink:href="#…", href="#…", clip-path, mask, etc.)
function collectReferencedIds(root: Element): Set<string> {
  const refs = new Set<string>();
  const serialized = new XMLSerializer().serializeToString(root);

  // Match url(#id) patterns
  const urlRefs = serialized.matchAll(/url\(\s*#([^)]+)\s*\)/g);
  for (const m of urlRefs) refs.add(m[1]);

  // Match xlink:href="#id" and href="#id" patterns
  const hrefRefs = serialized.matchAll(/(?:xlink:)?href\s*=\s*["']#([^"']+)["']/g);
  for (const m of hrefRefs) refs.add(m[1]);

  // Match clip-path="url(#id)", mask="url(#id)", filter="url(#id)", etc.
  const attrRefs = serialized.matchAll(/(?:clip-path|mask|filter|marker-start|marker-mid|marker-end|fill|stroke)\s*=\s*["']url\(\s*#([^)]+)\s*\)["']/g);
  for (const m of attrRefs) refs.add(m[1]);

  return refs;
}

function isHiddenElement(el: Element, referencedIds: Set<string>): boolean {
  // Never remove elements that are referenced by ID elsewhere
  const id = el.getAttribute('id');
  if (id && referencedIds.has(id)) return false;

  // Never remove elements inside <defs> — they're definitions, not rendered directly
  let parent = el.parentElement;
  while (parent) {
    if (parent.tagName.toLowerCase() === 'defs') return false;
    parent = parent.parentElement;
  }

  const display = el.getAttribute('display');
  const style = el.getAttribute('style') || '';

  // ONLY remove elements explicitly set to display:none — this is the only
  // truly safe "hidden" indicator. opacity:0 and visibility:hidden elements
  // may serve as hit areas, animation targets, or layered composition pieces.
  if (display === 'none') return true;
  if (style.includes('display:none') || style.includes('display: none')) return true;

  return false;
}

function simplifyPathData(d: string): { simplified: string; wasSimplified: boolean } {
  let simplified = d;
  let wasSimplified = false;

  // Only remove unnecessary whitespace — do NOT round numbers as it
  // can shift curves, thin lines, and fine details visibly.
  const before = simplified;
  simplified = simplified
    .replace(/\s+/g, ' ')
    .replace(/\s*([MLHVCSQTAZmlhvcsqtaz])\s*/g, '$1')
    .replace(/,\s*/g, ',')
    .replace(/\s+,/g, ',')
    .trim();

  if (simplified !== before) wasSimplified = true;

  return { simplified, wasSimplified };
}

function cleanStyles(style: string): string {
  // Only remove truly safe default values from inline styles.
  // Use a more careful split that handles colons inside values (e.g. data URIs).
  const parts = style.split(';').filter(Boolean);
  const cleaned = parts.filter((part) => {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) return false;
    const prop = part.slice(0, colonIdx).trim();
    const val = part.slice(colonIdx + 1).trim();
    if (!prop || !val) return false;
    if (DEFAULT_ATTRS[prop] === val) return false;
    return true;
  });
  return cleaned.join(';');
}

function removeComments(svgString: string): string {
  return svgString.replace(/<!--[\s\S]*?-->/g, '');
}

function removeProcessingInstructions(svgString: string): string {
  return svgString.replace(/<\?xml[^?]*\?>/gi, '');
}

function removeDoctypes(svgString: string): string {
  return svgString.replace(/<!DOCTYPE[^>]*>/gi, '');
}

function removeCDATA(svgString: string): string {
  // Only strip CDATA markers, preserve the content inside
  return svgString
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '');
}

export function optimizeSVG(svgString: string): OptimizationResult {
  const originalSize = new Blob([svgString]).size;
  let removedElements = 0;
  let removedAttributes = 0;
  let simplifiedPaths = 0;

  // Pre-processing: remove comments, PIs, doctypes
  let cleaned = svgString;
  cleaned = removeComments(cleaned);
  cleaned = removeProcessingInstructions(cleaned);
  cleaned = removeDoctypes(cleaned);
  cleaned = removeCDATA(cleaned);

  // Parse
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, 'image/svg+xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return {
      original: svgString,
      optimized: svgString,
      originalSize,
      optimizedSize: originalSize,
      savings: 0,
      savingsPercent: 0,
      removedElements: 0,
      removedAttributes: 0,
      simplifiedPaths: 0,
    };
  }

  const svgEl = doc.documentElement;

  // Check if the SVG uses <style> blocks — if so, class attributes are meaningful
  const hasStyleBlocks = svgEl.querySelectorAll('style').length > 0;

  // Collect all referenced IDs so we don't remove elements that are used
  const referencedIds = collectReferencedIds(svgEl);

  // Remove metadata elements
  const toRemove: Element[] = [];
  function walkForRemoval(el: Element) {
    const localName = el.localName || el.tagName.toLowerCase();
    const fullName = el.tagName.toLowerCase();

    if (REMOVE_ELEMENTS.has(localName) || REMOVE_ELEMENTS.has(fullName)) {
      toRemove.push(el);
      return;
    }

    if (isHiddenElement(el, referencedIds)) {
      toRemove.push(el);
      return;
    }

    Array.from(el.children).forEach(walkForRemoval);
  }

  Array.from(svgEl.children).forEach(walkForRemoval);
  toRemove.forEach((el) => {
    el.parentNode?.removeChild(el);
    removedElements++;
  });

  // Clean attributes and paths
  function walkForClean(el: Element) {
    // Remove unnecessary attributes
    const attrsToRemove: string[] = [];
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      const name = attr.name;
      const value = attr.value;

      if (REMOVE_ATTRIBUTES.has(name)) {
        attrsToRemove.push(name);
        continue;
      }

      // Only remove class if the SVG has no <style> blocks
      if (name === 'class' && !hasStyleBlocks) {
        attrsToRemove.push(name);
        continue;
      }

      // Remove attributes with default values — but only if not overriding
      // an inherited value (skip if element is inside a group that sets the same attr)
      if (DEFAULT_ATTRS[name] === value) {
        attrsToRemove.push(name);
        continue;
      }

      // Remove empty id attributes
      if (name === 'id' && !value.trim()) {
        attrsToRemove.push(name);
        continue;
      }
    }

    attrsToRemove.forEach((name) => {
      el.removeAttribute(name);
      removedAttributes++;
    });

    // Clean inline styles
    const style = el.getAttribute('style');
    if (style) {
      const cleanedStyle = cleanStyles(style);
      if (!cleanedStyle) {
        el.removeAttribute('style');
        removedAttributes++;
      } else if (cleanedStyle !== style) {
        el.setAttribute('style', cleanedStyle);
      }
    }

    // Simplify path data
    if (el.tagName === 'path' || el.tagName === 'PATH') {
      const d = el.getAttribute('d');
      if (d) {
        const { simplified, wasSimplified } = simplifyPathData(d);
        if (wasSimplified) {
          el.setAttribute('d', simplified);
          simplifiedPaths++;
        }
      }
    }

    // Simplify polygon/polyline points
    if (el.tagName === 'polygon' || el.tagName === 'polyline') {
      const points = el.getAttribute('points');
      if (points) {
        const simplified = points.replace(/\s+/g, ' ').trim();
        if (simplified !== points) {
          el.setAttribute('points', simplified);
        }
      }
    }

    Array.from(el.children).forEach(walkForClean);
  }

  walkForClean(svgEl);

  // Remove empty groups left behind (but preserve <defs> and groups with meaningful attributes)
  const MEANINGFUL_GROUP_ATTRS = new Set([
    'transform', 'clip-path', 'mask', 'filter', 'opacity',
    'id', 'class', 'style', 'fill', 'stroke',
  ]);

  function removeEmptyGroups(el: Element): boolean {
    const children = Array.from(el.children);
    children.forEach((child) => {
      if (removeEmptyGroups(child)) {
        el.removeChild(child);
        removedElements++;
      }
    });

    if (
      el.tagName === 'g' &&
      el.children.length === 0 &&
      !el.textContent?.trim()
    ) {
      // Keep the group if it has any meaningful attributes
      for (let i = 0; i < el.attributes.length; i++) {
        if (MEANINGFUL_GROUP_ATTRS.has(el.attributes[i].name)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  Array.from(svgEl.children).forEach((child) => {
    if (removeEmptyGroups(child)) {
      svgEl.removeChild(child);
      removedElements++;
    }
  });

  // Serialize
  const serializer = new XMLSerializer();
  let optimized = serializer.serializeToString(doc);

  // Post-processing cleanup — only collapse whitespace BETWEEN tags,
  // never inside <style>, <text>, or attribute values.
  // First, extract and protect <style> block contents
  const styleBlocks: string[] = [];
  optimized = optimized.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_match, open, content, close) => {
    const idx = styleBlocks.length;
    styleBlocks.push(content);
    return `${open}__STYLE_BLOCK_${idx}__${close}`;
  });

  // Now safe to collapse inter-tag whitespace
  optimized = optimized.replace(/>\s+</g, '>\n<');
  optimized = optimized.replace(/ >/g, '>');
  optimized = optimized.replace(/ \/>/g, '/>');

  // Restore style blocks
  styleBlocks.forEach((content, idx) => {
    optimized = optimized.replace(`__STYLE_BLOCK_${idx}__`, content);
  });

  // Pretty-print lightly
  let indent = 0;
  const lines = optimized.split('\n');
  const formatted = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('</')) {
      indent = Math.max(0, indent - 1);
    }

    const result = '  '.repeat(indent) + trimmed;

    if (
      trimmed.startsWith('<') &&
      !trimmed.startsWith('</') &&
      !trimmed.startsWith('<?') &&
      !trimmed.endsWith('/>') &&
      !trimmed.includes('</') 
    ) {
      indent++;
    }

    return result;
  });

  optimized = formatted.join('\n').trim() + '\n';

  const optimizedSize = new Blob([optimized]).size;
  const savings = originalSize - optimizedSize;
  const savingsPercent = originalSize > 0 ? (savings / originalSize) * 100 : 0;

  return {
    original: svgString,
    optimized,
    originalSize,
    optimizedSize,
    savings,
    savingsPercent: Math.max(0, savingsPercent),
    removedElements,
    removedAttributes,
    simplifiedPaths,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}