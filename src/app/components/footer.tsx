import React from 'react';

function LinkedInIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 72 72"
      className="inline-block flex-shrink-0"
    >
      <rect width="72" height="72" rx="8" fill="#0A66C2" />
      <path
        d="M20.06 27.97h-0.01c-2.73 0-4.49-1.88-4.49-4.23 0-2.4 1.82-4.23 4.6-4.23s4.49 1.83 4.52 4.23c0 2.35-1.76 4.23-4.62 4.23zM16.26 52V31h7.6v21h-7.6zm27.18-21c-3.72 0-5.38 2.04-6.31 3.48V31h-7.6c0.1 2.13 0 21 0 21h7.6V40.5c0-0.68 0.05-1.37 0.25-1.86 0.55-1.37 1.8-2.78 3.9-2.78 2.75 0 3.85 2.1 3.85 5.17V52h7.6v-11.7c0-6.27-3.35-9.19-7.82-9.19z"
        fill="#fff"
      />
    </svg>
  );
}

interface FooterProps {
  name?: string;
  portfolioUrl?: string;
  linkedInUrl?: string;
  linkedInLabel?: string;
}

export function Footer({
  name = 'Tommy K.',
  portfolioUrl = 'https://tamaskiraly.com',
  linkedInUrl = 'https://www.linkedin.com/in/kiralytamas/',
  linkedInLabel = 'LinkedIn',
}: FooterProps) {
  return (
    <footer className="border-t border-border py-6 mt-12">
      <div
        className="mx-auto max-w-5xl px-6 flex flex-wrap items-center justify-center gap-1.5 text-muted-foreground"
        style={{ fontSize: '0.8125rem' }}
      >
        <span>Made with ❤️ by</span>
        <a
          href={portfolioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground hover:text-primary transition-colors"
        >
          {name}
        </a>
        <span className="mx-1">·</span>
        <a
          href={portfolioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground hover:text-primary transition-colors"
        >
          Portfolio
        </a>
        <span className="mx-1">·</span>
        <a
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
        >
          <LinkedInIcon />
          {linkedInLabel}
        </a>
      </div>
    </footer>
  );
}