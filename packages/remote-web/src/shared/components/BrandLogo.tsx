interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export function BrandLogo({
  className = "h-8 w-auto",
  alt = "Kira Code",
}: BrandLogoProps) {
  return (
    <picture>
      <source
        srcSet="/kira-code-logo-dark.svg"
        media="(prefers-color-scheme: dark)"
      />
      <img src="/kira-code-logo.svg" alt={alt} className={className} />
    </picture>
  );
}
